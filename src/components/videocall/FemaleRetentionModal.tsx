import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
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
  onLeaveAnyway?: () => void;
}

export interface FemaleRetentionModalRef {
  /** Returns true if modal was shown (intercept succeeded), false if already shown before */
  tryShow: () => boolean;
}

const FemaleRetentionModal = forwardRef<FemaleRetentionModalRef, FemaleRetentionModalProps>(
  ({ isFemale, callState, isMobile, onStayAndEarn, onLeaveAnyway }, ref) => {
    const [open, setOpen] = useState(false);
    const shownRef = useRef(false);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingLeaveRef = useRef(false);

    const triggerModal = useCallback(() => {
      if (shownRef.current || !isFemale) return false;
      shownRef.current = true;
      setOpen(true);
      return true;
    }, [isFemale]);

    // Expose tryShow to parent so back/X button can intercept
    useImperativeHandle(ref, () => ({
      tryShow: () => {
        if (shownRef.current || !isFemale) return false;
        return triggerModal();
      },
    }), [triggerModal, isFemale]);

    // Desktop: exit-intent (mouse leaves viewport top) while searching
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

    // Tab close: native beforeunload prompt (browsers don't allow custom UI here)
    useEffect(() => {
      if (!isFemale || shownRef.current) return;

      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (callState === "waiting" || callState === "connected") {
          e.preventDefault();
          // Modern browsers ignore custom messages but still show native prompt
          e.returnValue = "";
        }
      };

      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isFemale, callState]);

    const handleStay = () => {
      setOpen(false);
      pendingLeaveRef.current = false;
      onStayAndEarn();
    };

    const handleLeave = () => {
      setOpen(false);
      if (pendingLeaveRef.current && onLeaveAnyway) {
        pendingLeaveRef.current = false;
        onLeaveAnyway();
      }
    };

    // Allow parent to mark that a leave action is pending
    useEffect(() => {
      if (open && !pendingLeaveRef.current) {
        // If opened by exit-intent or timer, no pending leave
      }
    }, [open]);

    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleLeave(); }}>
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
              onClick={handleLeave}
              className="text-neutral-500 hover:text-neutral-300 text-sm transition-colors text-center"
            >
              Leave Anyway
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

FemaleRetentionModal.displayName = "FemaleRetentionModal";

export default FemaleRetentionModal;
