interface NavIconProps {
  src: string;
  label: string;
  onClick?: () => void;
  highlight?: boolean;
  shake?: boolean;
  badge?: string | null;
}

const NavIcon = ({ src, label, onClick, highlight, shake, badge }: NavIconProps) => (
  <button
    onClick={onClick}
    className={`relative flex flex-col items-center gap-1 hover:scale-110 transition-transform ${
      highlight ? "scale-105" : ""
    } ${shake ? "animate-shake" : ""}`}
  >
    <div className="relative">
      <img src={src} alt={label} className="w-14 h-14 md:w-20 md:h-20 object-contain" />
      {badge && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-bounce shadow-lg shadow-red-500/40">
          {badge}
        </span>
      )}
    </div>
    <span
      className={`text-[11px] md:text-sm font-black tracking-wider ${
        highlight ? "text-white md:text-base" : "text-white"
      }`}
    >
      {label}
    </span>
  </button>
);

export default NavIcon;
