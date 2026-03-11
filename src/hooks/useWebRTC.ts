import { useRef, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

type CallState = "idle" | "waiting" | "connecting" | "connected" | "disconnected";

interface UseWebRTCOptions {
  memberId: string;
  genderPreference?: string;
  memberGender?: string;
}

export function useWebRTC({ memberId, genderPreference = "Both", memberGender }: UseWebRTCOptions) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const channelId = useRef<string>(crypto.randomUUID());
  const signalingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const currentRoomId = useRef<string | null>(null);
  const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStream.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      setError("Camera/microphone access denied. Please allow access and try again.");
      throw err;
    }
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current!);
      });
    }

    pc.ontrack = (event) => {
      console.log("[WebRTC] Remote track received", event.streams.length);
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && signalingChannel.current) {
        console.log("[WebRTC] Sending ICE candidate");
        signalingChannel.current.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: {
            candidate: event.candidate.toJSON(),
            from: channelId.current,
          },
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE state:", pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log("[WebRTC] Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setCallState("connected");
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setCallState("disconnected");
      }
    };

    peerConnection.current = pc;
    return pc;
  }, []);

  // Set up signaling and return a promise that resolves when subscribed
  const setupSignaling = useCallback(
    (roomId: string): Promise<void> => {
      return new Promise((resolve) => {
        // Clean up any existing channel
        if (signalingChannel.current) {
          supabase.removeChannel(signalingChannel.current);
        }

        const channel = supabase.channel(`room:${roomId}`, {
          config: { broadcast: { self: false } },
        });

        channel
          .on("broadcast", { event: "offer" }, async ({ payload }) => {
            if (payload.from === channelId.current) return;
            console.log("[Signaling] Received offer");
            const pc = peerConnection.current;
            if (!pc) return;

            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            console.log("[Signaling] Sending answer");
            channel.send({
              type: "broadcast",
              event: "answer",
              payload: { sdp: answer, from: channelId.current },
            });
          })
          .on("broadcast", { event: "answer" }, async ({ payload }) => {
            if (payload.from === channelId.current) return;
            console.log("[Signaling] Received answer");
            const pc = peerConnection.current;
            if (!pc) return;
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          })
          .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
            if (payload.from === channelId.current) return;
            const pc = peerConnection.current;
            if (!pc) return;
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (e) {
              console.warn("[WebRTC] Failed to add ICE candidate", e);
            }
          })
          .on("broadcast", { event: "partner-disconnected" }, () => {
            console.log("[Signaling] Partner disconnected");
            setCallState("disconnected");
            cleanupPeer();
          })
          .subscribe((status) => {
            console.log("[Signaling] Channel status:", status);
            if (status === "SUBSCRIBED") {
              resolve();
            }
          });

        signalingChannel.current = channel;
      });
    },
    []
  );

  const startCall = useCallback(async () => {
    try {
      setError(null);
      setCallState("waiting");

      await getLocalStream();

      const { data, error: fnError } = await supabase.functions.invoke(
        "videocall-match",
        {
          body: {
            type: "join",
            memberId,
            channelId: channelId.current,
            genderPreference,
            memberGender,
          },
        }
      );

      if (fnError) throw new Error(fnError.message);
      console.log("[Match] Response:", data);

      if (data.message === "partner_found") {
        currentRoomId.current = data.roomId;
        setCallState("connecting");

        // We are the joiner — we create the offer
        const pc = createPeerConnection();
        await setupSignaling(data.roomId);

        console.log("[WebRTC] Creating and sending offer");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signalingChannel.current?.send({
          type: "broadcast",
          event: "offer",
          payload: { sdp: offer, from: channelId.current },
        });
      } else if (data.message === "added_to_queue") {
        console.log("[Match] Added to queue, starting poll");
        startPolling();
      }
    } catch (err: any) {
      console.error("[Match] Error:", err);
      setError(err.message || "Failed to start call");
      setCallState("idle");
    }
  }, [memberId, genderPreference, memberGender, getLocalStream, createPeerConnection, setupSignaling]);

  // Poll for match — user1 was queued, user2 matched and created the room
  const startPolling = useCallback(() => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);

    pollingInterval.current = setInterval(async () => {
      // Check rooms where we are member1 (we were in queue first)
      const { data: rooms1 } = await supabase
        .from("rooms")
        .select("*")
        .eq("member1", memberId)
        .eq("status", "connected")
        .order("created_at", { ascending: false })
        .limit(1);

      // Also check rooms where we are member2
      const { data: rooms2 } = await supabase
        .from("rooms")
        .select("*")
        .eq("member2", memberId)
        .eq("status", "connected")
        .order("created_at", { ascending: false })
        .limit(1);

      const allRooms = [...(rooms1 || []), ...(rooms2 || [])];

      if (allRooms.length > 0) {
        const room = allRooms[0];
        console.log("[Poll] Found room!", room.id);
        clearInterval(pollingInterval.current!);
        pollingInterval.current = null;

        currentRoomId.current = room.id;
        setCallState("connecting");

        // We were waiting — set up peer connection and signaling
        // The joiner (user2) will send the offer
        createPeerConnection();
        await setupSignaling(room.id);
        console.log("[Poll] Signaling ready, waiting for offer from joiner");
      }
    }, 2000);
  }, [memberId, createPeerConnection, setupSignaling]);

  const cleanupPeer = useCallback(() => {
    peerConnection.current?.close();
    peerConnection.current = null;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, []);

  const disconnect = useCallback(async () => {
    signalingChannel.current?.send({
      type: "broadcast",
      event: "partner-disconnected",
      payload: { from: channelId.current },
    });

    cleanupPeer();

    if (signalingChannel.current) {
      supabase.removeChannel(signalingChannel.current);
      signalingChannel.current = null;
    }

    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }

    await supabase.functions.invoke("videocall-match", {
      body: { type: "disconnect", memberId },
    });

    currentRoomId.current = null;
    setCallState("idle");
  }, [memberId, cleanupPeer]);

  const next = useCallback(async () => {
    await disconnect();
    channelId.current = crypto.randomUUID();
    await startCall();
  }, [disconnect, startCall]);

  const stop = useCallback(async () => {
    await disconnect();
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    await supabase.functions.invoke("videocall-match", {
      body: { type: "leave_queue", memberId },
    });
    setCallState("idle");
  }, [disconnect, memberId]);

  useEffect(() => {
    return () => {
      localStream.current?.getTracks().forEach((t) => t.stop());
      peerConnection.current?.close();
      if (signalingChannel.current) {
        supabase.removeChannel(signalingChannel.current);
      }
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
      supabase.functions.invoke("videocall-match", {
        body: { type: "leave_queue", memberId },
      });
      supabase.functions.invoke("videocall-match", {
        body: { type: "disconnect", memberId },
      });
    };
  }, [memberId]);

  return {
    callState,
    error,
    localVideoRef,
    remoteVideoRef,
    startCall,
    next,
    stop,
    disconnect,
  };
}
