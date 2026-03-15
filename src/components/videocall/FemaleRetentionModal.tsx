import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FemaleRetentionModalProps {
  isFemale: boolean;
  callState: string;
  isMobile: boolean;
  onStayAndEarn: () => void;
}

const FemaleRetentionModal = ({
  isFemale,
  callState,
  isMobile,
  onStayAndEarn,
}: FemaleRetentionModalProps) => {
  const [open, setOpen] = useState(false);
  const shownRef = useRef(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerModal = useCallback(() => {
    if (shownRef.current || !isFemale || callState !== "waiting") return;
    shownRef.current = true;
    setOpen(true);
  }, [isFemale, callState]);

  // Desktop: exit-intent (mouse leaves viewport top)
  useEffect(() => {
    if (isMobile || !isFemale || callState !== "waiting" || shownRef.current) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) triggerModal();
    };

    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, [isMobile, isFemale, callState, triggerModal]);

  // Mobile: 30s timeout while searching
  useEffect(() => {
    if (!isMobile || !isFemale || shownRef.current) {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      return;
    }

    if (callState === "waiting") {
      searchTimerRef.current = setTimeout(() => triggerModal(), 30_000);
    } else {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    }

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [isMobile, isFemale, callState, triggerModal]);

  const handleStay = () => {
    setOpen(false);
    onStayAndEarn();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-neutral-900 border-neutral-700 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            DON'T LEAVE! 🛑
          </DialogTitle>
          <DialogDescription className="text-neutral-300 text-center text-base pt-3">
            You could earn <span className="font-bold text-green-400">$$</span> just
            by being a female user and idling on our website. Click the{" "}
            <span className="font-semibold text-pink-400">"Tap Me"</span> button
            right below the video box in pink!
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-4">
          <Button
            onClick={handleStay}
            className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold text-lg py-6"
          >
            Stay & Earn 💰
          </Button>
          <button
            onClick={() => setOpen(false)}
            className="text-neutral-500 hover:text-neutral-300 text-sm transition-colors text-center"
          >
            Leave Anyway
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FemaleRetentionModal;
