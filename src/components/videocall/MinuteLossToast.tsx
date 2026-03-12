import { useEffect, useState } from "react";

interface MinuteLossToastProps {
  minutesLost: number;
  onDone: () => void;
}

const MinuteLossToast = ({ minutesLost, onDone }: MinuteLossToastProps) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2200);
    const remove = setTimeout(onDone, 2800);
    return () => { clearTimeout(timer); clearTimeout(remove); };
  }, [onDone]);

  return (
    <div
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-[70] pointer-events-none transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
      }`}
    >
      <div className="bg-red-900/90 border border-red-600 backdrop-blur-md rounded-xl px-5 py-3 shadow-2xl">
        <span className="text-white font-black text-lg tracking-wide">
          🚫 -{minutesLost} Minutes
        </span>
        <span className="block text-red-300 text-xs font-bold mt-0.5">
          Don't Quick Skip
        </span>
      </div>
    </div>
  );
};

export default MinuteLossToast;
