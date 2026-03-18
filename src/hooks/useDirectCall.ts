import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  iceTransportPolicy: "all",
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

export function useDirectCall({ myUserId, partnerId, inviteId, isInitiator }: UseDirectCallOptions) {
  const [callState, setCallState] = useState<DirectCallState>("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoElRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const cleanedUpRef = useRef(false);

  const channelName = `direct-call-${inviteId}`;

  const cleanup = useCallback(() => {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;

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
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoElRef.current) remoteVideoElRef.current.srcObject = null;
    setRemoteStream(null);
    setCallState("ended");
  }, []);

  const endCall = useCallback(() => {
    channelRef.current?.send({
      type: "broadcast",
      event: "call-ended",
      payload: {},
    });
    supabase.from("direct_call_invites").update({ status: "ended" } as any).eq("id", inviteId).then();
    cleanup();
  }, [cleanup, inviteId]);

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
          } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            cleanup();
          }
        };

        const pendingLocalCandidates: RTCIceCandidateInit[] = [];
        const pendingRemoteCandidates: RTCIceCandidateInit[] = [];
        let channelReady = false;
        let remoteDescriptionSet = false;

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

        const channel = supabase.channel(channelName, {
          config: { broadcast: { self: false } },
        });
        channelRef.current = channel;

        let offerSent = false;

        const sendOffer = async () => {
          if (!isInitiator || offerSent || cancelled) return;
          offerSent = true;
          console.log("[DirectCall] Creating and sending offer");
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.send({
            type: "broadcast",
            event: "offer",
            payload: { sdp: offer, from: myUserId },
          });
        };

        pc.onicecandidate = (event) => {
          if (!event.candidate) return;
          const candidateJson = event.candidate.toJSON();
          if (channelReady) {
            channel.send({
              type: "broadcast",
              event: "ice-candidate",
              payload: { candidate: candidateJson, from: myUserId },
            });
          } else {
            pendingLocalCandidates.push(candidateJson);
          }
        };

        channel
          .on("broadcast", { event: "offer" }, async ({ payload }) => {
            if (payload.from === myUserId) return;
            console.log("[DirectCall] Received offer");
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            remoteDescriptionSet = true;
            await flushRemoteCandidates();
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.send({
              type: "broadcast",
              event: "answer",
              payload: { sdp: answer, from: myUserId },
            });
          })
          .on("broadcast", { event: "answer" }, async ({ payload }) => {
            if (payload.from === myUserId) return;
            console.log("[DirectCall] Received answer");
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            remoteDescriptionSet = true;
            await flushRemoteCandidates();
          })
          .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
            if (payload.from === myUserId) return;
            if (!remoteDescriptionSet || !pc.remoteDescription) {
              pendingRemoteCandidates.push(payload.candidate);
              return;
            }
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (e) {
              console.warn("[DirectCall] Failed to add ICE candidate", e);
            }
          })
          .on("broadcast", { event: "call-ended" }, () => {
            cleanup();
          })
          .on("broadcast", { event: "peer-ready" }, () => {
            console.log("[DirectCall] Peer ready received, isInitiator:", isInitiator);
            if (isInitiator) {
              sendOffer();
            } else {
              console.log("[DirectCall] Echoing peer-ready back to initiator");
              channel.send({ type: "broadcast", event: "peer-ready", payload: {} });
            }
          })
          .subscribe((status) => {
            console.log("[DirectCall] Channel status:", status);
            if (status === "SUBSCRIBED") {
              channelReady = true;
              setCallState("ringing");

              for (const candidate of pendingLocalCandidates) {
                channel.send({
                  type: "broadcast",
                  event: "ice-candidate",
                  payload: { candidate, from: myUserId },
                });
              }
              pendingLocalCandidates.length = 0;

              console.log("[DirectCall] Sending peer-ready");
              channel.send({ type: "broadcast", event: "peer-ready", payload: {} });

              if (isInitiator) {
                const retryInterval = setInterval(() => {
                  if (offerSent || cancelled || cleanedUpRef.current) {
                    clearInterval(retryInterval);
                    return;
                  }
                  console.log("[DirectCall] Retrying peer-ready");
                  channel.send({ type: "broadcast", event: "peer-ready", payload: {} });
                }, 1500);

                setTimeout(() => clearInterval(retryInterval), 30000);
              }
            }
          });
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