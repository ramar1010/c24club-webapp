import { useEffect, useRef, useState } from "react";
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
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const signalingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelIdRef = useRef<string>(crypto.randomUUID());
  const roomIdRef = useRef<string | null>(null);

  const memberIdRef = useRef(memberId);
  const genderPreferenceRef = useRef(genderPreference);
  const memberGenderRef = useRef(memberGender);

  useEffect(() => {
    memberIdRef.current = memberId;
  }, [memberId]);

  useEffect(() => {
    genderPreferenceRef.current = genderPreference;
  }, [genderPreference]);

  useEffect(() => {
    memberGenderRef.current = memberGender;
  }, [memberGender]);

  function clearPolling() {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }

  function clearRemoteVideo() {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }

  function cleanupPeerConnection() {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    clearRemoteVideo();
  }

  function cleanupSignalingChannel() {
    if (signalingChannelRef.current) {
      supabase.removeChannel(signalingChannelRef.current);
      signalingChannelRef.current = null;
    }
  }

  async function getLocalStream() {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    return stream;
  }

  function createPeerConnection() {
    cleanupPeerConnection();

    const pc = new RTCPeerConnection(ICE_SERVERS);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate || !signalingChannelRef.current) return;

      signalingChannelRef.current.send({
        type: "broadcast",
        event: "ice-candidate",
        payload: {
          from: channelIdRef.current,
          candidate: event.candidate.toJSON(),
        },
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallState("connected");
      }

      if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
        setCallState("disconnected");
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }

  async function setupSignaling(roomId: string) {
    cleanupSignalingChannel();

    return new Promise<void>((resolve) => {
      const channel = supabase.channel(`room:${roomId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          if (payload.from === channelIdRef.current) return;

          const pc = peerConnectionRef.current;
          if (!pc) return;

          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          await channel.send({
            type: "broadcast",
            event: "answer",
            payload: { from: channelIdRef.current, sdp: answer },
          });
        })
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          if (payload.from === channelIdRef.current) return;

          const pc = peerConnectionRef.current;
          if (!pc) return;

          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        })
        .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
          if (payload.from === channelIdRef.current) return;

          const pc = peerConnectionRef.current;
          if (!pc) return;

          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (candidateError) {
            console.warn("Failed to add ICE candidate", candidateError);
          }
        })
        .on("broadcast", { event: "partner-disconnected" }, () => {
          setCallState("disconnected");
          cleanupPeerConnection();
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            resolve();
          }
        });

      signalingChannelRef.current = channel;
    });
  }

  async function pollForMatch() {
    clearPolling();

    pollingIntervalRef.current = setInterval(async () => {
      const mid = memberIdRef.current;

      const [{ data: roomsAsMember1 }, { data: roomsAsMember2 }] = await Promise.all([
        supabase
          .from("rooms")
          .select("*")
          .eq("member1", mid)
          .eq("status", "connected")
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("rooms")
          .select("*")
          .eq("member2", mid)
          .eq("status", "connected")
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      const room = roomsAsMember1?.[0] || roomsAsMember2?.[0];
      if (!room) return;

      clearPolling();
      roomIdRef.current = room.id;
      setCallState("connecting");
      createPeerConnection();
      await setupSignaling(room.id);
    }, 2000);
  }

  async function disconnect() {
    signalingChannelRef.current?.send({
      type: "broadcast",
      event: "partner-disconnected",
      payload: { from: channelIdRef.current },
    });

    cleanupPeerConnection();
    cleanupSignalingChannel();
    clearPolling();

    await supabase.functions.invoke("videocall-match", {
      body: { type: "disconnect", memberId: memberIdRef.current },
    });

    roomIdRef.current = null;
    setCallState("idle");
  }

  async function startCall() {
    try {
      setError(null);
      setCallState("waiting");

      await getLocalStream();

      const { data, error: invokeError } = await supabase.functions.invoke("videocall-match", {
        body: {
          type: "join",
          memberId: memberIdRef.current,
          channelId: channelIdRef.current,
          genderPreference: genderPreferenceRef.current,
          memberGender: memberGenderRef.current,
        },
      });

      if (invokeError) throw invokeError;

      if (data?.message === "partner_found") {
        roomIdRef.current = data.roomId;
        setCallState("connecting");

        // We found someone in the queue — they'll poll, find the room,
        // and send us the offer. We just set up and wait.
        createPeerConnection();
        await setupSignaling(data.roomId);
        return;
      }

      if (data?.message === "added_to_queue") {
        await pollForMatch();
        return;
      }

      throw new Error("Unexpected matchmaking response");
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : "Failed to start call";
      setError(message === "Requested device not found" ? "Camera or microphone not found." : message);
      setCallState("idle");
    }
  }

  async function next() {
    await disconnect();
    channelIdRef.current = crypto.randomUUID();
    await startCall();
  }

  async function stop() {
    await disconnect();

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    await supabase.functions.invoke("videocall-match", {
      body: { type: "leave_queue", memberId: memberIdRef.current },
    });
  }

  useEffect(() => {
    return () => {
      clearPolling();
      cleanupSignalingChannel();
      cleanupPeerConnection();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;

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
    disconnect,
  };
}
