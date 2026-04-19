import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
    },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
        "turns:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceTransportPolicy: "all",
  iceCandidatePoolSize: 10,
};

const playVideoElement = (video: HTMLVideoElement | null) => {
  if (!video) return;
  const playPromise = video.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
};

const attachStreamToVideo = (video: HTMLVideoElement | null, stream: MediaStream | null) => {
  if (!video || !stream) return;
  if (video.srcObject !== stream) {
    video.srcObject = stream;
  }
  playVideoElement(video);
};

export type DirectCallState = "connecting" | "ringing" | "connected" | "ended";

interface UseDirectCallOptions {
  myUserId: string;
  partnerId: string;
  inviteId: string;
  isInitiator: boolean;
}

/** Send a signal via the room_signals DB table */
async function dbSendSignal(roomId: string, senderChannel: string, signalType: string, payload: Record<string, unknown>) {
  try {
    await supabase.from("room_signals").insert({
      room_id: roomId,
      sender_channel: senderChannel,
      signal_type: signalType,
      payload: payload as any,
    });
  } catch (e) {
    console.warn("[DirectCall] DB signal send failed:", e);
  }
}

export function useDirectCall({ myUserId, partnerId, inviteId, isInitiator }: UseDirectCallOptions) {
  const [callState, setCallState] = useState<DirectCallState>("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoElRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cleanedUpRef = useRef(false);

  const roomId = `direct-${inviteId}`;

  const cleanup = useCallback(() => {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;

    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoElRef.current) remoteVideoElRef.current.srcObject = null;
    setRemoteStream(null);
    setCallState("ended");

    // Cleanup DB signals
    supabase.from("room_signals").delete().eq("room_id", roomId).then(() => {});
  }, [roomId]);

  const endCall = useCallback(() => {
    void dbSendSignal(roomId, myUserId, "call-ended", { from: myUserId });
    supabase.from("direct_call_invites").update({ status: "ended" } as any).eq("id", inviteId).then();
    cleanup();
  }, [cleanup, inviteId, myUserId, roomId]);

  const toggleMute = useCallback(() => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOff(!videoTrack.enabled);
    }
  }, []);

  const remoteVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      remoteVideoElRef.current = el;
      attachStreamToVideo(el, remoteStream);
    },
    [remoteStream],
  );

  useEffect(() => {
    attachStreamToVideo(remoteVideoElRef.current, remoteStream);
  }, [remoteStream]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        window.dispatchEvent(new CustomEvent("prepare-direct-call"));
        await new Promise((resolve) => setTimeout(resolve, 250));

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        attachStreamToVideo(localVideoRef.current, stream);

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          console.log("[DirectCall] Remote track received", event.streams.length);
          if (event.streams[0]) {
            setRemoteStream(event.streams[0]);
          }
        };

        pc.onconnectionstatechange = () => {
          console.log("[DirectCall] Connection state:", pc.connectionState);
          if (pc.connectionState === "connected") {
            setCallState("connected");
            // Stop polling once connected
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            cleanup();
          }
        };

        const pendingRemoteCandidates: RTCIceCandidateInit[] = [];
        let remoteDescriptionSet = false;
        let offerSent = false;
        const processedSignalIds = new Set<string>();

        const flushRemoteCandidates = async () => {
          while (pendingRemoteCandidates.length > 0) {
            const candidate = pendingRemoteCandidates.shift();
            if (!candidate) continue;
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.warn("[DirectCall] Failed to add queued ICE candidate", e);
            }
          }
        };

        pc.onicecandidate = (event) => {
          if (!event.candidate) return;
          void dbSendSignal(roomId, myUserId, "ice-candidate", {
            candidate: event.candidate.toJSON(),
            from: myUserId,
          });
        };

        const sendOffer = async () => {
          if (!isInitiator || offerSent || cancelled) return;
          offerSent = true;
          console.log("[DirectCall] Creating and sending offer");
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await dbSendSignal(roomId, myUserId, "offer", { sdp: offer, from: myUserId });
        };

        // Process signals from DB polling
        const processSignal = async (signal: { id: string; signal_type: string; payload: any; sender_channel: string }) => {
          if (signal.sender_channel === myUserId) return;
          if (processedSignalIds.has(signal.id)) return;
          processedSignalIds.add(signal.id);

          switch (signal.signal_type) {
            case "offer": {
              if (!signal.payload.sdp) return;
              console.log("[DirectCall] Received offer");
              await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
              remoteDescriptionSet = true;
              await flushRemoteCandidates();
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await dbSendSignal(roomId, myUserId, "answer", { sdp: answer, from: myUserId });
              break;
            }
            case "answer": {
              if (!signal.payload.sdp) return;
              console.log("[DirectCall] Received answer");
              await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
              remoteDescriptionSet = true;
              await flushRemoteCandidates();
              break;
            }
            case "ice-candidate": {
              if (!signal.payload.candidate) return;
              if (!remoteDescriptionSet || !pc.remoteDescription) {
                pendingRemoteCandidates.push(signal.payload.candidate);
                return;
              }
              try {
                await pc.addIceCandidate(new RTCIceCandidate(signal.payload.candidate));
              } catch (e) {
                console.warn("[DirectCall] Failed to add ICE candidate", e);
              }
              break;
            }
            case "peer-ready": {
              console.log("[DirectCall] Peer ready received, isInitiator:", isInitiator);
              if (isInitiator) {
                void sendOffer();
              } else {
                void dbSendSignal(roomId, myUserId, "peer-ready", { from: myUserId });
              }
              break;
            }
            case "call-ended": {
              cleanup();
              break;
            }
          }
        };

        // Only the initiator clears stale signals (callee must NEVER delete,
        // or it will wipe the initiator's peer-ready/offer that already arrived).
        if (isInitiator) {
          await supabase.from("room_signals").delete().eq("room_id", roomId);
        }

        // Start polling for signals
        const pollSignals = async () => {
          try {
            const { data } = await supabase
              .from("room_signals")
              .select("id, signal_type, payload, sender_channel, created_at")
              .eq("room_id", roomId)
              .neq("sender_channel", myUserId)
              .order("created_at", { ascending: true });

            if (data && data.length > 0) {
              for (const signal of data) {
                await processSignal(signal as any);
              }
            }
          } catch (e) {
            console.warn("[DirectCall] Poll error:", e);
          }
        };

        // Signal ready and start polling
        setCallState("ringing");
        await dbSendSignal(roomId, myUserId, "peer-ready", { from: myUserId });

        pollRef.current = setInterval(pollSignals, 500);
        // Initial poll after a short delay to let partner's signal land
        setTimeout(() => pollSignals(), 300);

        // Retry peer-ready for initiator
        if (isInitiator) {
          const retryInterval = setInterval(() => {
            if (offerSent || cancelled || cleanedUpRef.current) {
              clearInterval(retryInterval);
              return;
            }
            console.log("[DirectCall] Retrying peer-ready");
            void dbSendSignal(roomId, myUserId, "peer-ready", { from: myUserId });
          }, 1500);
          setTimeout(() => clearInterval(retryInterval), 30000);
        }
      } catch (err) {
        console.error("[DirectCall] Error:", err);
        cleanup();
      }
    }

    start();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    callState,
    localVideoRef,
    remoteVideoRef,
    isMuted,
    isCameraOff,
    toggleMute,
    toggleCamera,
    endCall,
  };
}
