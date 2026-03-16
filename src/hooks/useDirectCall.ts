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
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") {
            setCallState("connected");
          } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            cleanup();
          }
        };

        const channel = supabase.channel(channelName);
        channelRef.current = channel;

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            channel.send({
              type: "broadcast",
              event: "ice-candidate",
              payload: { candidate: event.candidate.toJSON(), from: myUserId },
            });
          }
        };

        // Track whether we've already sent an offer to avoid duplicates
        let offerSent = false;

        const sendOffer = async () => {
          if (!isInitiator || offerSent || cancelled) return;
          offerSent = true;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.send({
            type: "broadcast",
            event: "offer",
            payload: { sdp: offer, from: myUserId },
          });
        };

        channel
          .on("broadcast", { event: "offer" }, async ({ payload }) => {
            if (payload.from === myUserId) return;
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
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          })
          .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
            if (payload.from === myUserId) return;
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch {}
          })
          .on("broadcast", { event: "call-ended" }, () => {
            cleanup();
          })
          .on("broadcast", { event: "peer-ready" }, () => {
            // The other peer is subscribed and ready — initiator can now safely send offer
            sendOffer();
          });

        await channel.subscribe();

        setCallState("ringing");

        // Both sides broadcast readiness after subscribing.
        // When the initiator receives "peer-ready" from the receiver, it sends the offer.
        channel.send({ type: "broadcast", event: "peer-ready", payload: {} });

        // If both are already subscribed (e.g. initiator joined second),
        // the "peer-ready" from the other side triggers sendOffer.
        // As a fallback for timing, initiator also retries a few times.
        if (isInitiator) {
          for (let i = 0; i < 5; i++) {
            await new Promise(r => setTimeout(r, 1000));
            if (offerSent || cancelled) break;
            // Re-broadcast readiness to prompt receiver to reply
            channel.send({ type: "broadcast", event: "peer-ready", payload: {} });
          }
        }
      } catch (err) {
        console.error("Direct call error:", err);
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
