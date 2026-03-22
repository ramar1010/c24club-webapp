import { AlertTriangle } from "lucide-react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

interface NsfwConfirmOverlayProps {
  onConfirmBan: () => void;
  onDismiss: () => void;
}

const NsfwConfirmOverlay = ({ onConfirmBan, onDismiss }: NsfwConfirmOverlayProps) => {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-6 text-center shadow-2xl pointer-events-auto">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <AlertTriangle className="h-8 w-8" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-foreground">
          Is this person doing something inappropriate?
        </h2>

        <p className="text-sm text-muted-foreground">
          Our system detected potential inappropriate content. Please confirm — is the other person showing something they shouldn't be?
        </p>

        <div className="flex flex-col gap-3 pt-2">
          <Button
            type="button"
            onClick={onConfirmBan}
            variant="destructive"
            className="w-full py-3 text-base font-semibold"
          >
            Yes, ban them
          </Button>
          <Button
            type="button"
            onClick={onDismiss}
            variant="outline"
            className="w-full py-3 text-base font-semibold"
          >
            No, they're fine
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default NsfwConfirmOverlay;
