import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  iceTransportPolicy: "all",
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
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
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
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
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

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        // Get local media
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        // Create peer connection
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          console.log("[DirectCall] Remote track received", event.streams.length);
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
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

        // Queue ICE candidates until channel is ready
        const pendingCandidates: RTCIceCandidateInit[] = [];
        let channelReady = false;

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
          if (event.candidate) {
            const candidateJson = event.candidate.toJSON();
            if (channelReady) {
              channel.send({
                type: "broadcast",
                event: "ice-candidate",
                payload: { candidate: candidateJson, from: myUserId },
              });
            } else {
              pendingCandidates.push(candidateJson);
            }
          }
        };

        channel
          .on("broadcast", { event: "offer" }, async ({ payload }) => {
            if (payload.from === myUserId) return;
            console.log("[DirectCall] Received offer");
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
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
          })
          .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
            if (payload.from === myUserId) return;
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
              // The other peer is subscribed — initiator can now safely send offer
              sendOffer();
            } else {
              // Echo back peer-ready so the initiator knows we're here
              console.log("[DirectCall] Echoing peer-ready back to initiator");
              channel.send({ type: "broadcast", event: "peer-ready", payload: {} });
            }
          })
          .subscribe((status) => {
            console.log("[DirectCall] Channel status:", status);
            if (status === "SUBSCRIBED") {
              channelReady = true;
              setCallState("ringing");

              // Flush any queued ICE candidates
              for (const candidate of pendingCandidates) {
                channel.send({
                  type: "broadcast",
                  event: "ice-candidate",
                  payload: { candidate, from: myUserId },
                });
              }
              pendingCandidates.length = 0;

              // Signal readiness to peer
              console.log("[DirectCall] Sending peer-ready");
              channel.send({ type: "broadcast", event: "peer-ready", payload: {} });

              // Initiator: retry peer-ready periodically in case the receiver joins later
              if (isInitiator) {
                const retryInterval = setInterval(() => {
                  if (offerSent || cancelled || cleanedUpRef.current) {
                    clearInterval(retryInterval);
                    return;
                  }
                  console.log("[DirectCall] Retrying peer-ready");
                  channel.send({ type: "broadcast", event: "peer-ready", payload: {} });
                }, 1500);

                // Stop retrying after 30s
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
