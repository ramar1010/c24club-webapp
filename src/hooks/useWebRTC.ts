import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { attachStreamToVideo, getTrackEventStream } from "@/lib/mediaStream";

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
  voiceMode?: boolean;
}

export function useWebRTC({ memberId, genderPreference = "Both", memberGender, voiceMode = false }: UseWebRTCOptions) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [hasStartedMatchmaking, setHasStartedMatchmaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPartnerId, setCurrentPartnerId] = useState<string | null>(null);
  const [partnerVoiceMode, setPartnerVoiceMode] = useState(false);
  const [partnerGender, setPartnerGender] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const signalingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const signalPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelIdRef = useRef<string>(crypto.randomUUID());
  const roomIdRef = useRef<string | null>(null);

  const memberIdRef = useRef(memberId);
  const genderPreferenceRef = useRef(genderPreference);
  const memberGenderRef = useRef(memberGender);
  const voiceModeRef = useRef(voiceMode);

  useEffect(() => {
    memberIdRef.current = memberId;
  }, [memberId]);

  useEffect(() => {
    genderPreferenceRef.current = genderPreference;
  }, [genderPreference]);

  useEffect(() => {
    memberGenderRef.current = memberGender;
  }, [memberGender]);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  useEffect(() => {
    if (callState === "idle") {
      setHasStartedMatchmaking(false);
    }
  }, [callState]);

  useEffect(() => {
    attachStreamToVideo(localVideoRef.current, localStreamRef.current, { muted: true });
    attachStreamToVideo(remoteVideoRef.current, remoteStreamRef.current);
  });

  function clearPolling() {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }

  function clearSignalPolling() {
    if (signalPollIntervalRef.current) {
      clearInterval(signalPollIntervalRef.current);
      signalPollIntervalRef.current = null;
    }
  }

  function clearRemoteVideo() {
    remoteStreamRef.current = null;
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
    clearSignalPolling();
    if (signalingChannelRef.current) {
      supabase.removeChannel(signalingChannelRef.current);
      signalingChannelRef.current = null;
    }
  }

  // --- Database signaling helpers ---
  async function dbSendSignal(roomId: string, signalType: string, payload: any) {
    await supabase.from("room_signals").insert({
      room_id: roomId,
      sender_channel: channelIdRef.current,
      signal_type: signalType,
      payload,
    } as any);
  }

  function startSignalPolling(roomId: string) {
    clearSignalPolling();
    const processedIds = new Set<string>();

    signalPollIntervalRef.current = setInterval(async () => {
      const { data: signals } = await supabase
        .from("room_signals")
        .select("*")
        .eq("room_id", roomId)
        .neq("sender_channel", channelIdRef.current)
        .order("created_at", { ascending: true }) as any;

      if (!signals) return;

      for (const sig of signals) {
        if (processedIds.has(sig.id)) continue;
        processedIds.add(sig.id);

        const pc = peerConnectionRef.current;
        if (!pc) continue;

        try {
          if (sig.signal_type === "offer") {
            console.log("[WebRTC] DB: Received offer");
            await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            // Send answer via DB
            await dbSendSignal(roomId, "answer", answer);
            // Also try broadcast
            signalingChannelRef.current?.send({
              type: "broadcast",
              event: "answer",
              payload: { from: channelIdRef.current, sdp: answer },
            }).catch(() => {});
          } else if (sig.signal_type === "answer") {
            console.log("[WebRTC] DB: Received answer");
            if (pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
            }
          } else if (sig.signal_type === "ice-candidate") {
            await pc.addIceCandidate(new RTCIceCandidate(sig.payload)).catch(() => {});
          } else if (sig.signal_type === "partner-disconnected") {
            handlePartnerLeft();
          }
        } catch (e) {
          console.warn("[WebRTC] DB signal processing error:", e);
        }
      }
    }, 1000);
  }

  async function cleanupRoomSignals(roomId: string) {
    await supabase.from("room_signals").delete().eq("room_id", roomId).catch(() => {});
  }

  // --- End database signaling helpers ---

  async function getLocalStream() {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: !voiceModeRef.current,
      audio: true,
    });

    localStreamRef.current = stream;
    attachStreamToVideo(localVideoRef.current, stream, { muted: true });

    return stream;
  }
  const autoReconnectingRef = useRef(false);

  async function handlePartnerLeft() {
    if (autoReconnectingRef.current) return;
    autoReconnectingRef.current = true;

    const oldRoomId = roomIdRef.current;
    cleanupPeerConnection();
    cleanupSignalingChannel();
    clearPolling();

    if (oldRoomId) cleanupRoomSignals(oldRoomId);

    await supabase.functions.invoke("videocall-match", {
      body: { type: "disconnect", memberId: memberIdRef.current },
    }).catch(() => {});

    roomIdRef.current = null;
    setCurrentPartnerId(null);
    setPartnerVoiceMode(false);
    setPartnerGender(null);

    channelIdRef.current = crypto.randomUUID();
    setCallState("waiting");

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("videocall-match", {
        body: {
          type: "join",
          memberId: memberIdRef.current,
          channelId: channelIdRef.current,
          genderPreference: genderPreferenceRef.current,
          memberGender: memberGenderRef.current,
          voiceMode: voiceModeRef.current,
        },
      });

      if (invokeError) throw invokeError;

      if (data?.message === "partner_found") {
        roomIdRef.current = data.roomId;
        setCurrentPartnerId(data.partnerId);
        setPartnerVoiceMode(data.partnerVoiceMode ?? false);
        setPartnerGender(data.partnerGender ?? null);
        setCallState("connecting");
        createPeerConnection();
        await setupSignaling(data.roomId);
      } else if (data?.message === "added_to_queue") {
        await pollForMatch();
      }
    } catch (err) {
      console.error("[WebRTC] Auto-reconnect failed:", err);
      setCallState("idle");
    } finally {
      autoReconnectingRef.current = false;
    }
  }

  function createPeerConnection() {
    cleanupPeerConnection();

    const pc = new RTCPeerConnection(ICE_SERVERS);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    if (voiceModeRef.current) {
      pc.addTransceiver("video", { direction: "recvonly" });
    }

    pc.ontrack = (event) => {
      const stream = getTrackEventStream(event, remoteStreamRef.current);
      remoteStreamRef.current = stream;
      attachStreamToVideo(remoteVideoRef.current, stream);
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const candidateJson = event.candidate.toJSON();
      const rid = roomIdRef.current;

      // Send via broadcast
      signalingChannelRef.current?.send({
        type: "broadcast",
        event: "ice-candidate",
        payload: {
          from: channelIdRef.current,
          candidate: candidateJson,
        },
      }).catch(() => {});

      // Also send via DB fallback
      if (rid) {
        dbSendSignal(rid, "ice-candidate", candidateJson).catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        clearSignalPolling(); // Stop polling once connected
        attachStreamToVideo(remoteVideoRef.current, remoteStreamRef.current);
        setCallState("connected");
      }

      if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
        handlePartnerLeft();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }

  async function setupSignaling(roomId: string) {
    cleanupSignalingChannel();

    // Start DB signal polling as fallback
    startSignalPolling(roomId);

    return new Promise<void>((resolve) => {
      const channel = supabase.channel(`room:${roomId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          if (payload.from === channelIdRef.current) return;

          const pc = peerConnectionRef.current;
          if (!pc) return;

          console.log("[WebRTC] Broadcast: Received offer");
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          await channel.send({
            type: "broadcast",
            event: "answer",
            payload: { from: channelIdRef.current, sdp: answer },
          }).catch(() => {});

          // Also send answer via DB
          dbSendSignal(roomId, "answer", answer).catch(() => {});
        })
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          if (payload.from === channelIdRef.current) return;

          const pc = peerConnectionRef.current;
          if (!pc) return;

          console.log("[WebRTC] Broadcast: Received answer");
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          }
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
          handlePartnerLeft();
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            resolve();
          }
        });

      signalingChannelRef.current = channel;

      // Resolve after timeout if WebSocket subscription doesn't complete
      setTimeout(() => resolve(), 3000);
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
      const pid = room.member1 === mid ? room.member2 : room.member1;
      const pVoiceMode = room.member1 === mid ? room.member2_voice_mode : room.member1_voice_mode;
      const pGender = room.member1 === mid ? room.member2_gender : room.member1_gender;
      setCurrentPartnerId(pid);
      setPartnerVoiceMode(pVoiceMode ?? false);
      setPartnerGender(pGender ?? null);
      setCallState("connecting");

      const pc = createPeerConnection();
      await setupSignaling(room.id);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log("[WebRTC] Sending offer from poller");
      // Send via broadcast
      signalingChannelRef.current?.send({
        type: "broadcast",
        event: "offer",
        payload: { from: channelIdRef.current, sdp: offer },
      }).catch(() => {});

      // Also send via DB fallback
      dbSendSignal(room.id, "offer", offer).catch(() => {});
    }, 2000);
  }

  async function disconnect() {
    const rid = roomIdRef.current;

    signalingChannelRef.current?.send({
      type: "broadcast",
      event: "partner-disconnected",
      payload: { from: channelIdRef.current },
    }).catch(() => {});

    // Also signal disconnect via DB
    if (rid) {
      dbSendSignal(rid, "partner-disconnected", {}).catch(() => {});
    }

    cleanupPeerConnection();
    cleanupSignalingChannel();
    clearPolling();

    await supabase.functions.invoke("videocall-match", {
      body: { type: "disconnect", memberId: memberIdRef.current },
    });

    if (rid) cleanupRoomSignals(rid);
    roomIdRef.current = null;
    setCurrentPartnerId(null);
    setPartnerVoiceMode(false);
    setPartnerGender(null);
    setCallState("idle");
  }

  async function startCall() {
    try {
      setError(null);
      setHasStartedMatchmaking(true);
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
          voiceMode: voiceModeRef.current,
        },
      });

      console.log("[WebRTC] videocall-match response:", { data, invokeError });

      if (invokeError) throw invokeError;

      if (data?.message === "partner_found") {
        console.log("[WebRTC] Partner found! Room:", data.roomId);
        roomIdRef.current = data.roomId;
        setCurrentPartnerId(data.partnerId);
        setPartnerVoiceMode(data.partnerVoiceMode ?? false);
        setPartnerGender(data.partnerGender ?? null);
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
    const rid = roomIdRef.current;

    signalingChannelRef.current?.send({
      type: "broadcast",
      event: "partner-disconnected",
      payload: { from: channelIdRef.current },
    }).catch(() => {});

    if (rid) {
      dbSendSignal(rid, "partner-disconnected", {}).catch(() => {});
    }

    cleanupPeerConnection();
    cleanupSignalingChannel();
    clearPolling();

    await supabase.functions.invoke("videocall-match", {
      body: { type: "disconnect", memberId: memberIdRef.current },
    });

    if (rid) cleanupRoomSignals(rid);
    roomIdRef.current = null;
    setCurrentPartnerId(null);
    setPartnerVoiceMode(false);
    setPartnerGender(null);
    setCallState("waiting");

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
      clearSignalPolling();
      cleanupSignalingChannel();
      cleanupPeerConnection();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;

      const mid = memberIdRef.current;
      supabase.functions.invoke("videocall-match", { body: { type: "leave_queue", memberId: mid } });
      supabase.functions.invoke("videocall-match", { body: { type: "disconnect", memberId: mid } });
    };
  }, []);

  // Enable camera mid-call (for voice-mode users who accept a camera unlock)
  async function enableCamera() {
    try {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      // Get video stream
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const videoTrack = videoStream.getVideoTracks()[0];
      if (!videoTrack) return;

      // Add track to local stream
      if (localStreamRef.current) {
        localStreamRef.current.addTrack(videoTrack);
      } else {
        localStreamRef.current = videoStream;
      }

      // Show local video
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      // Find the recvonly video transceiver and replace/add
      const videoTransceiver = pc.getTransceivers().find(
        (t) => t.receiver.track?.kind === "video" && t.direction === "recvonly"
      );

      if (videoTransceiver) {
        videoTransceiver.direction = "sendrecv";
        await videoTransceiver.sender.replaceTrack(videoTrack);
      } else {
        pc.addTrack(videoTrack, localStreamRef.current!);
      }

      // Renegotiate
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (signalingChannelRef.current) {
        signalingChannelRef.current.send({
          type: "broadcast",
          event: "offer",
          payload: {
            from: channelIdRef.current,
            sdp: offer,
          },
        }).catch(() => {});
      }

      // Also send via DB
      if (roomIdRef.current) {
        dbSendSignal(roomIdRef.current, "offer", offer).catch(() => {});
      }
    } catch (err) {
      console.error("[WebRTC] enableCamera error:", err);
    }
  }

  return {
    localVideoRef,
    remoteVideoRef,
    callState,
    error,
    currentPartnerId,
    partnerVoiceMode,
    partnerGender,
    hasStartedMatchmaking,
    startCall,
    next,
    stop,
    disconnect,
    enableCamera,
    localStreamRef,
    remoteStreamRef,
  };
}
