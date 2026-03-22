import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NsfwConfirmOverlayProps {
  onConfirmBan: () => void;
  onDismiss: () => void;
}

const NsfwConfirmOverlay = ({ onConfirmBan, onDismiss }: NsfwConfirmOverlayProps) => {
  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-sm w-full p-6 text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-white">
          Is this person doing something inappropriate?
        </h2>

        <p className="text-neutral-400 text-sm">
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
            className="w-full py-3 text-base font-semibold border-neutral-600 text-neutral-300 hover:bg-neutral-800"
          >
            No, they're fine
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NsfwConfirmOverlay;
