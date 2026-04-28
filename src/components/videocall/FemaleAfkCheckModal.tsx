import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const WORDS = [
  "flower", "sunset", "happy", "smile", "ocean", "sparkle", "kitten", "puppy",
  "rainbow", "coffee", "magic", "honey", "peach", "cherry", "vanilla", "sugar",
  "starlight", "bubble", "dream", "glow", "lemon", "berry", "cookie", "candy",
  "moonlight", "breeze", "petal", "blossom", "feather", "cuddle",
];

const RESPONSE_WINDOW_SEC = 60;

function pickWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

export default function FemaleAfkCheckModal({
  open,
  onPass,
  onFail,
}: {
  open: boolean;
  onPass: () => void;
  onFail: () => void;
}) {
  const [word, setWord] = useState<string>(() => pickWord());
  const [input, setInput] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(RESPONSE_WINDOW_SEC);
  const failedRef = useRef(false);

  // Reset state every time the modal opens
  useEffect(() => {
    if (open) {
      setWord(pickWord());
      setInput("");
      setSecondsLeft(RESPONSE_WINDOW_SEC);
      failedRef.current = false;
    }
  }, [open]);

  // Countdown
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          if (!failedRef.current) {
            failedRef.current = true;
            onFail();
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [open, onFail]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim().toLowerCase() === word.toLowerCase()) {
      toast.success("You're still here! Earning continues 💖");
      onPass();
    } else {
      toast.error("That doesn't match — try again");
      setInput("");
    }
  };

  const progressPct = useMemo(
    () => (secondsLeft / RESPONSE_WINDOW_SEC) * 100,
    [secondsLeft],
  );
  const isPaused = secondsLeft === 0;

  return (
    <Dialog open={open} onOpenChange={() => { /* not dismissible */ }}>
      <DialogContent
        className="max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {isPaused ? "Earning paused 💤" : "Quick check ✨"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isPaused
              ? "Type the word below to resume earning."
              : "Type the word below to keep earning. This proves you're still here!"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Type this word:</p>
            <p className="text-3xl font-bold tracking-wider select-none">{word}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type the word here…"
              maxLength={50}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <Button type="submit" className="w-full" disabled={!input.trim()}>
              {isPaused ? "Resume earning" : "Confirm"}
            </Button>
          </form>

          {!isPaused && (
            <div className="space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-1000 ease-linear"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                {secondsLeft}s to respond
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}