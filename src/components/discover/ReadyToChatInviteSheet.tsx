import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, MessageSquare, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Mode = "text" | "video" | "both";

interface Sender {
  id: string;
  name: string | null;
  image_thumb_url: string | null;
  image_url: string | null;
}

interface Props {
  /** Opens the DM thread with the sender. */
  onOpenDm: (memberId: string) => void;
}

/**
 * Handles taps on a "Ready to Chat" notification.
 * The push carries: ?rtc=<sessionId>&from=<senderId>&mode=<text|video|both>
 */
const ReadyToChatInviteSheet = ({ onOpenDm }: Props) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionId = searchParams.get("rtc");
  const senderId = searchParams.get("from");
  const rawMode = searchParams.get("mode");
  const mode: Mode = rawMode === "video" || rawMode === "both" ? rawMode : "text";

  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [expired, setExpired] = useState(false);
  const [sender, setSender] = useState<Sender | null>(null);

  const clearParams = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("rtc");
    next.delete("from");
    next.delete("mode");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!sessionId || !senderId) return;
    let cancelled = false;

    const load = async () => {
      setOpen(true);
      setChecking(true);
      setExpired(false);

      const [{ data: member }, validation] = await Promise.all([
        supabase
          .from("members")
          .select("id, name, image_thumb_url, image_url")
          .eq("id", senderId)
          .maybeSingle(),
        supabase.functions.invoke("ready-to-chat", {
          body: { action: "validate", sessionId, mode },
        }),
      ]);

      if (cancelled) return;
      setSender((member as Sender) ?? null);
      const allowed = (validation.data as { allowed?: boolean } | null)?.allowed === true;
      setExpired(!allowed);
      setChecking(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId, senderId, mode]);

  const close = () => {
    setOpen(false);
    clearParams();
  };

  const handleChatNow = () => {
    if (!senderId) return;
    close();
    onOpenDm(senderId);
  };

  if (!sessionId || !senderId) return null;

  const name = sender?.name || "Someone";
  const avatar = sender?.image_thumb_url || sender?.image_url;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm border-white/10 bg-[#171717] text-white">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-3">
            {avatar ? (
              <img src={avatar} alt={name} className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-500/20 text-pink-300">
                {mode === "video" ? <Video className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
              </span>
            )}
            <div className="min-w-0">
              <DialogTitle className="truncate text-left">
                {checking ? "Checking…" : expired ? `${name} is no longer available` : `💬 ${name} is ready to chat`}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-left text-white/60">
            {checking
              ? "Making sure they're still available…"
              : expired
                ? "They've finished chatting for now. Browse Discover to find someone else who's around."
                : mode === "video"
                  ? "They're up for a video call right now. Say hi and start the call from your chat."
                  : mode === "both"
                    ? "They're up for a message or a video call right now."
                    : "They're around right now — send them a message."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          {expired ? (
            <Button type="button" onClick={close} className="bg-pink-500 text-white hover:bg-pink-600">
              Browse Discover
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={close}
                className="text-white/60 hover:bg-white/10 hover:text-white"
              >
                Not now
              </Button>
              <Button
                type="button"
                disabled={checking}
                onClick={handleChatNow}
                className="bg-pink-500 text-white hover:bg-pink-600"
              >
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                Chat now
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReadyToChatInviteSheet;
