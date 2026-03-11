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
  const channelIdRef = useRef<string>(crypto.randomUUID());
  const signalingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const currentRoomId = useRef<string | null>(null);
  const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Store changing props in refs so callbacks don't need them as deps
  const genderPrefRef = useRef(genderPreference);
  const memberGenderRef = useRef(memberGender);
  const memberIdRef = useRef(memberId);

  useEffect(() => { genderPrefRef.current = genderPreference; }, [genderPreference]);
  useEffect(() => { memberGenderRef.current = memberGender; }, [memberGender]);
  useEffect(() => { memberIdRef.current = memberId; }, [memberId]);

  const cleanupPeer = useCallback(() => {
    peerConnection.current?.close();
    peerConnection.current = null;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, []);

  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch {
      setError("Camera/microphone access denied. Please allow access and try again.");
      throw new Error("Media access denied");
    }
  }, []);

  const createPeerConnection = useCallback(() => {
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current!);
      });
    }

    pc.ontrack = (event) => {
      console.log("[WebRTC] Remote track received");
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && signalingChannel.current) {
        signalingChannel.current.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: { candidate: event.candidate.toJSON(), from: channelIdRef.current },
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

  const setupSignaling = useCallback((roomId: string): Promise<void> => {
    return new Promise((resolve) => {
      if (signalingChannel.current) {
        supabase.removeChannel(signalingChannel.current);
      }

      const channel = supabase.channel(`room:${roomId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          if (payload.from === channelIdRef.current) return;
          console.log("[Signaling] Received offer");
          const pc = peerConnection.current;
          if (!pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: "broadcast",
            event: "answer",
            payload: { sdp: answer, from: channelIdRef.current },
          });
        })
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          if (payload.from === channelIdRef.current) return;
          console.log("[Signaling] Received answer");
          const pc = peerConnection.current;
          if (!pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        })
        .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
          if (payload.from === channelIdRef.current) return;
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
  }, [cleanupPeer]);

  const clearPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  }, []);

  const disconnectInternal = useCallback(async () => {
    signalingChannel.current?.send({
      type: "broadcast",
      event: "partner-disconnected",
      payload: { from: channelIdRef.current },
    });

    cleanupPeer();

    if (signalingChannel.current) {
      supabase.removeChannel(signalingChannel.current);
      signalingChannel.current = null;
    }

    clearPolling();

    await supabase.functions.invoke("videocall-match", {
      body: { type: "disconnect", memberId: memberIdRef.current },
    });

    currentRoomId.current = null;
    setCallState("idle");
  }, [cleanupPeer, clearPolling]);

  const startCall = useCallback(async () => {
    try {
      setError(null);
      setCallState("waiting");

      await getLocalStream();

      const { data, error: fnError } = await supabase.functions.invoke("videocall-match", {
        body: {
          type: "join",
          memberId: memberIdRef.current,
          channelId: channelIdRef.current,
          genderPreference: genderPrefRef.current,
          memberGender: memberGenderRef.current,
        },
      });

      if (fnError) throw new Error(fnError.message);
      console.log("[Match] Response:", data);

      if (data.message === "partner_found") {
        currentRoomId.current = data.roomId;
        setCallState("connecting");

        const pc = createPeerConnection();
        await setupSignaling(data.roomId);

        console.log("[WebRTC] Creating and sending offer");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signalingChannel.current?.send({
          type: "broadcast",
          event: "offer",
          payload: { sdp: offer, from: channelIdRef.current },
        });
      } else if (data.message === "added_to_queue") {
        console.log("[Match] Added to queue, starting poll");
        // Start polling for a match
        clearPolling();
        pollingInterval.current = setInterval(async () => {
          const mid = memberIdRef.current;
          const { data: rooms1 } = await supabase
            .from("rooms")
            .select("*")
            .eq("member1", mid)
            .eq("status", "connected")
            .order("created_at", { ascending: false })
            .limit(1);

          const { data: rooms2 } = await supabase
            .from("rooms")
            .select("*")
            .eq("member2", mid)
            .eq("status", "connected")
            .order("created_at", { ascending: false })
            .limit(1);

          const allRooms = [...(rooms1 || []), ...(rooms2 || [])];

          if (allRooms.length > 0) {
            const room = allRooms[0];
            console.log("[Poll] Found room!", room.id);
            clearPolling();

            currentRoomId.current = room.id;
            setCallState("connecting");

            createPeerConnection();
            await setupSignaling(room.id);
            console.log("[Poll] Signaling ready, waiting for offer");
          }
        }, 2000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start call";
      console.error("[Match] Error:", message);
      setError(message);
      setCallState("idle");
    }
  }, [getLocalStream, createPeerConnection, setupSignaling, clearPolling]);

  const next = useCallback(async () => {
    await disconnectInternal();
    channelIdRef.current = crypto.randomUUID();
    await startCall();
  }, [disconnectInternal, startCall]);

  const stop = useCallback(async () => {
    await disconnectInternal();
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    await supabase.functions.invoke("videocall-match", {
      body: { type: "leave_queue", memberId: memberIdRef.current },
    });
    setCallState("idle");
  }, [disconnectInternal]);

  // Cleanup on unmount
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
      const mid = memberIdRef.current;
      supabase.functions.invoke("videocall-match", { body: { type: "leave_queue", memberId: mid } });
      supabase.functions.invoke("videocall-match", { body: { type: "disconnect", memberId: mid } });
    };
  }, []);

  return {
    callState,
    error,
    localVideoRef,
    remoteVideoRef,
    startCall,
    next,
    stop,
    disconnect: disconnectInternal,
  };
}
