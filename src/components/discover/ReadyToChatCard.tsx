import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, Loader2, MessageCircle, Radio, Video } from "lucide-react";
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

type ReadyMode = "text" | "video" | "both";

interface ActiveReadySession {
  id: string;
  mode: ReadyMode;
  expiresAt: string;
  recipientCount: number;
}

interface ReadyToChatCardProps {
  userId: string;
  enabled: boolean;
  openRequest?: number;
  onActiveChange?: (active: boolean) => void;
}

const modeOptions: Array<{ mode: ReadyMode; label: string; description: string; icon: typeof MessageCircle }> = [
  { mode: "text", label: "Text", description: "Invite people to message you", icon: MessageCircle },
  { mode: "video", label: "Video", description: "Invite eligible people to call", icon: Video },
  { mode: "both", label: "Both", description: "Let each person choose", icon: Radio },
];

const reasonMessages: Record<string, string> = {
  banned: "Your account is not eligible to start an alert.",
  daily_limit_reached: "You've reached today's Ready to Chat limit.",
  invalid_mode: "Choose Text, Video, or Both.",
  no_profile: "Finish setting up your profile first.",
  not_discoverable: "Your approved selfie must be listed before you can start an alert.",
  restart_cooldown: "Please wait a few minutes before starting another alert.",
  session_already_active: "You already have an active Ready to Chat alert.",
  unauthenticated: "Please sign in again to continue.",
};

const storageKey = (userId: string) => `c24-ready-to-chat:${userId}`;

const readStoredSession = (userId: string): ActiveReadySession | null => {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveReadySession;
    if (!parsed.id || !parsed.expiresAt || new Date(parsed.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(storageKey(userId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const ReadyToChatCard = ({ userId, enabled, openRequest = 0, onActiveChange }: ReadyToChatCardProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ReadyMode | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveReadySession | null>(() => readStoredSession(userId));
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeSession) return;
    if (new Date(activeSession.expiresAt).getTime() > now) return;
    window.localStorage.removeItem(storageKey(userId));
    setActiveSession(null);
  }, [activeSession, now, userId]);

  useEffect(() => {
    onActiveChange?.(activeSession !== null);
  }, [activeSession, onActiveChange]);

  useEffect(() => {
    if (openRequest <= 0 || activeSession || !enabled) return;
    setError(null);
    setSelectedMode(null);
    setConfirming(false);
    setDialogOpen(true);
  }, [openRequest, activeSession, enabled]);

  const remaining = useMemo(() => {
    if (!activeSession) return "";
    const seconds = Math.max(0, Math.ceil((new Date(activeSession.expiresAt).getTime() - now) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }, [activeSession, now]);

  const closeDialog = () => {
    if (submitting) return;
    setDialogOpen(false);
    setSelectedMode(null);
    setConfirming(false);
    setError(null);
  };

  const openDialog = () => {
    setError(null);
    setSelectedMode(null);
    setConfirming(false);
    setDialogOpen(true);
  };

  const startSession = async () => {
    if (!selectedMode || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("ready-to-chat", {
        body: { action: "start", mode: selectedMode },
      });
      if (invokeError) throw invokeError;
      if (!data?.success) {
        setError(reasonMessages[data?.reason] || "Ready to Chat could not be started. Please try again.");
        return;
      }

      const session: ActiveReadySession = {
        id: data.session_id,
        mode: data.mode,
        expiresAt: data.expires_at,
        recipientCount: Number(data.recipient_count) || 0,
      };
      window.localStorage.setItem(storageKey(userId), JSON.stringify(session));
      setActiveSession(session);
      setDialogOpen(false);
      setSelectedMode(null);
      setConfirming(false);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ready to Chat could not be started. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelSession = async () => {
    if (!activeSession || cancelling) return;
    setCancelling(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("ready-to-chat", {
        body: { action: "cancel", sessionId: activeSession.id },
      });
      if (invokeError) throw invokeError;
      if (data?.success === false) throw new Error(data.reason || "Unable to cancel this alert.");
      window.localStorage.removeItem(storageKey(userId));
      setActiveSession(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to cancel this alert.");
    } finally {
      setCancelling(false);
    }
  };

  const activeLabel = activeSession
    ? modeOptions.find((option) => option.mode === activeSession.mode)?.label || activeSession.mode
    : "";

  return (
    <>
      <section className="mx-3 mt-3 sm:mx-4">
        {activeSession ? (
          <div className="overflow-hidden rounded-lg border border-emerald-500/40 bg-emerald-500/10">
            <div className="flex items-center gap-3 p-3 sm:p-4">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                <Radio className="h-5 w-5" />
                <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-[#111] bg-emerald-400 animate-pulse" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <h2 className="text-sm font-bold text-white">Ready to Chat is active</h2>
                  <span className="text-xs font-semibold text-emerald-300">{activeLabel}</span>
                </div>
                <p className="mt-0.5 text-xs text-white/60">
                  {activeSession.recipientCount} eligible {activeSession.recipientCount === 1 ? "person was" : "people were"} notified
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="flex items-center justify-end gap-1 text-sm font-bold tabular-nums text-emerald-300">
                  <Clock3 className="h-3.5 w-3.5" /> {remaining}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void cancelSession()}
                  disabled={cancelling}
                  className="mt-0.5 h-7 px-2 text-xs text-white/60 hover:bg-white/10 hover:text-white"
                >
                  {cancelling && <Loader2 className="animate-spin" />}
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={openDialog}
            disabled={!enabled}
            className="group flex w-full items-center gap-3 rounded-lg border border-pink-500/40 bg-pink-500/10 p-3 text-left transition-colors hover:bg-pink-500/15 disabled:cursor-not-allowed disabled:opacity-60 sm:p-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-500 text-white shadow-lg shadow-pink-500/20">
              <Radio className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold text-white">Ready to Chat</span>
              <span className="block text-xs leading-relaxed text-white/60 sm:text-sm">
                Choose Text, Video, or Both and notify eligible people who were active today.
              </span>
            </span>
            <span className="hidden text-sm font-semibold text-pink-300 sm:block">Start alert</span>
          </button>
        )}
        {error && !dialogOpen && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </section>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md border-white/10 bg-[#171717] text-white">
          <DialogHeader>
            <DialogTitle>{confirming ? "Confirm Ready to Chat" : "How do you want to chat?"}</DialogTitle>
            <DialogDescription className="text-white/55">
              {confirming
                ? "Your alert will remain active for 15 minutes."
                : "Choose one option. Only eligible people who were active today can be notified."}
            </DialogDescription>
          </DialogHeader>

          {!confirming ? (
            <div className="grid gap-2" role="radiogroup" aria-label="Ready to Chat mode">
              {modeOptions.map(({ mode, label, description, icon: Icon }) => {
                const selected = selectedMode === mode;
                return (
                  <Button
                    key={mode}
                    type="button"
                    variant="outline"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedMode(mode)}
                    className={`h-auto justify-start whitespace-normal border-white/10 bg-white/5 px-3 py-3 text-left text-white hover:bg-white/10 hover:text-white ${selected ? "border-pink-500/70 bg-pink-500/15" : ""}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${selected ? "bg-pink-500" : "bg-white/10"}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{label}</span>
                      <span className="block text-xs font-normal text-white/50">{description}</span>
                    </span>
                    {selected && <Check className="text-pink-300" />}
                  </Button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-pink-500/30 bg-pink-500/10 p-4">
              <p className="text-sm text-white/70">Start a 15-minute alert for</p>
              <p className="mt-1 text-lg font-bold text-pink-300">
                {modeOptions.find((option) => option.mode === selectedMode)?.label}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-white/50">
                C24 Club chooses eligible recipients. Their names are never shown here.
              </p>
            </div>
          )}

          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

          <DialogFooter className="gap-2 sm:space-x-0">
            <Button type="button" variant="ghost" onClick={confirming ? () => setConfirming(false) : closeDialog} disabled={submitting} className="text-white/60 hover:bg-white/10 hover:text-white">
              {confirming ? "Back" : "Cancel"}
            </Button>
            {confirming ? (
              <Button type="button" onClick={() => void startSession()} disabled={submitting} className="bg-pink-500 text-white hover:bg-pink-600">
                {submitting && <Loader2 className="animate-spin" />}
                {submitting ? "Starting…" : "Confirm & start"}
              </Button>
            ) : (
              <Button type="button" onClick={() => setConfirming(true)} disabled={!selectedMode} className="bg-pink-500 text-white hover:bg-pink-600">
                Continue
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReadyToChatCard;