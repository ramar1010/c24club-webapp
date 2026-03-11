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
  const [currentPartnerId, setCurrentPartnerId] = useState<string | null>(null);

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
    console.log("[WebRTC] Starting poll for match, memberId:", memberIdRef.current);

    pollingIntervalRef.current = setInterval(async () => {
      const mid = memberIdRef.current;

      const { data, error: pollError } = await supabase.functions.invoke("videocall-match", {
        body: { type: "poll", memberId: mid },
      });

      console.log("[WebRTC] Poll result:", data, pollError);

      if (pollError || !data?.room) return;

      const room = data.room;
      console.log("[WebRTC] Room found via polling:", room.id);
      clearPolling();
      roomIdRef.current = room.id;
      // Determine partner ID from the room
      const pid = room.member1 === mid ? room.member2 : room.member1;
      setCurrentPartnerId(pid);
      setCallState("connecting");

      const pc = createPeerConnection();
      await setupSignaling(room.id);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log("[WebRTC] Sending offer from poller");
      await signalingChannelRef.current?.send({
        type: "broadcast",
        event: "offer",
        payload: { from: channelIdRef.current, sdp: offer },
      });
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

      console.log("[WebRTC] Calling videocall-match join", {
        memberId: memberIdRef.current,
        channelId: channelIdRef.current,
        genderPreference: genderPreferenceRef.current,
      });

      const { data, error: invokeError } = await supabase.functions.invoke("videocall-match", {
        body: {
          type: "join",
          memberId: memberIdRef.current,
          channelId: channelIdRef.current,
          genderPreference: genderPreferenceRef.current,
          memberGender: memberGenderRef.current,
        },
      });

      console.log("[WebRTC] videocall-match response:", { data, invokeError });

      if (invokeError) throw invokeError;

      if (data?.message === "partner_found") {
        console.log("[WebRTC] Partner found! Room:", data.roomId);
        roomIdRef.current = data.roomId;
        setCurrentPartnerId(data.partnerId);
        setCallState("connecting");
        createPeerConnection();
        await setupSignaling(data.roomId);
        console.log("[WebRTC] Signaling ready, waiting for poller's offer");
        return;
      }

      if (data?.message === "added_to_queue") {
        console.log("[WebRTC] Added to queue, starting to poll");
        await pollForMatch();
        return;
      }

      throw new Error("Unexpected matchmaking response");
    } catch (startError) {
      console.error("[WebRTC] startCall error:", startError);
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
