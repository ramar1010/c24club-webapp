import { X } from "lucide-react";

interface FullScreenOverlayProps {
  children: React.ReactNode;
  onClose: () => void;
}

const FullScreenOverlay = ({ children, onClose }: FullScreenOverlayProps) => {
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-[60] bg-neutral-800 hover:bg-neutral-700 rounded-full p-2 transition-colors"
      >
        <X className="w-6 h-6 text-white" />
      </button>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
};

export default FullScreenOverlay;
