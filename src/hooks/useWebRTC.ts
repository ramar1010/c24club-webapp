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
  const isInitiator = useRef(false);
  const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get local camera/mic stream
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

  // Create peer connection
  const createPeerConnection = useCallback((partnerChannelId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current!);
      });
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Handle ICE candidates — send via Realtime
    pc.onicecandidate = (event) => {
      if (event.candidate && signalingChannel.current) {
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

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallState("connected");
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setCallState("disconnected");
      }
    };

    peerConnection.current = pc;
    return pc;
  }, []);

  // Set up signaling channel
  const setupSignaling = useCallback(
    (roomId: string, partnerChannelId: string) => {
      const channel = supabase.channel(`room:${roomId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          if (payload.from === channelId.current) return;
          const pc = peerConnection.current;
          if (!pc) return;

          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          channel.send({
            type: "broadcast",
            event: "answer",
            payload: { sdp: answer, from: channelId.current },
          });
        })
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          if (payload.from === channelId.current) return;
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
            console.warn("Failed to add ICE candidate", e);
          }
        })
        .on("broadcast", { event: "partner-disconnected" }, () => {
          setCallState("disconnected");
          cleanupPeer();
        })
        .subscribe();

      signalingChannel.current = channel;
    },
    []
  );

  // Start the call flow
  const startCall = useCallback(async () => {
    try {
      setError(null);
      setCallState("waiting");

      // Get camera first
      await getLocalStream();

      // Call edge function to join queue / find match
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

      if (data.message === "partner_found") {
        // Matched! Set up WebRTC
        currentRoomId.current = data.roomId;
        isInitiator.current = false; // we joined an existing partner
        setCallState("connecting");

        const pc = createPeerConnection(data.partnerChannelId);
        setupSignaling(data.roomId, data.partnerChannelId);

        // Small delay to let channel subscribe, then create offer
        setTimeout(async () => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          signalingChannel.current?.send({
            type: "broadcast",
            event: "offer",
            payload: { sdp: offer, from: channelId.current },
          });
        }, 1000);
      } else if (data.message === "added_to_queue") {
        // Waiting for a partner — poll for match
        startPolling();
      }
    } catch (err: any) {
      setError(err.message || "Failed to start call");
      setCallState("idle");
    }
  }, [memberId, genderPreference, memberGender, getLocalStream, createPeerConnection, setupSignaling]);

  // Poll queue to see if someone matched us
  const startPolling = useCallback(() => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);

    pollingInterval.current = setInterval(async () => {
      // Check if we've been pulled from queue (a room was created with us)
      const { data: rooms } = await supabase
        .from("rooms")
        .select("*")
        .or(`member1.eq.${memberId},member2.eq.${memberId}`)
        .eq("status", "connected")
        .order("created_at", { ascending: false })
        .limit(1);

      if (rooms && rooms.length > 0) {
        const room = rooms[0];
        clearInterval(pollingInterval.current!);
        pollingInterval.current = null;

        currentRoomId.current = room.id;
        isInitiator.current = true; // we were waiting, partner initiated
        setCallState("connecting");

        const partnerChannelId =
          room.member1 === memberId ? room.channel2 : room.channel1;

        createPeerConnection(partnerChannelId!);
        setupSignaling(room.id, partnerChannelId!);
        // Don't create offer — the joiner will send it
      }
    }, 2000);
  }, [memberId, createPeerConnection, setupSignaling]);

  // Cleanup peer connection
  const cleanupPeer = useCallback(() => {
    peerConnection.current?.close();
    peerConnection.current = null;

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, []);

  // Disconnect current call
  const disconnect = useCallback(async () => {
    // Notify partner
    signalingChannel.current?.send({
      type: "broadcast",
      event: "partner-disconnected",
      payload: { from: channelId.current },
    });

    cleanupPeer();

    // Unsubscribe signaling
    if (signalingChannel.current) {
      supabase.removeChannel(signalingChannel.current);
      signalingChannel.current = null;
    }

    // Clear polling
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }

    // Update server
    await supabase.functions.invoke("videocall-match", {
      body: { type: "disconnect", memberId },
    });

    currentRoomId.current = null;
    setCallState("idle");
  }, [memberId, cleanupPeer]);

  // Next: disconnect current + immediately find new match
  const next = useCallback(async () => {
    await disconnect();
    // Generate new channel ID for next connection
    channelId.current = crypto.randomUUID();
    await startCall();
  }, [disconnect, startCall]);

  // Stop everything (leave page)
  const stop = useCallback(async () => {
    await disconnect();

    // Stop local stream
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
      // Fire and forget cleanup
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
