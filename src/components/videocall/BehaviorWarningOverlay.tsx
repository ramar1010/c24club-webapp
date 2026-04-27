import { AlertTriangle } from "lucide-react";

interface BehaviorWarningOverlayProps {
  visible: boolean;
  variant: "no-face" | "tilt";
}

/**
 * Translucent overlay that covers the LOCAL video preview when the user is
 * either out of frame (no face) or pointing the camera downward.
 */
const BehaviorWarningOverlay = ({ visible, variant }: BehaviorWarningOverlayProps) => {
  if (!visible) return null;

  const title = variant === "no-face" ? "We can't see your face" : "Camera angle looks off";
  const subtitle =
    variant === "no-face"
      ? "Show yourself or your partner can skip you."
      : "Hold your phone upright at face level.";

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 rounded-lg bg-destructive/85 p-4 text-center text-destructive-foreground backdrop-blur-md pointer-events-none">
      <AlertTriangle className="h-10 w-10" />
      <p className="text-base font-bold leading-tight">{title}</p>
      <p className="text-xs opacity-90">{subtitle}</p>
    </div>
  );
};

export default BehaviorWarningOverlay;