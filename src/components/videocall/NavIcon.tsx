interface NavIconProps {
  src: string;
  label: string;
  onClick?: () => void;
  highlight?: boolean;
  shake?: boolean;
}

const NavIcon = ({ src, label, onClick, highlight, shake }: NavIconProps) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1 hover:scale-110 transition-transform ${
      highlight ? "scale-105" : ""
    } ${shake ? "animate-shake" : ""}`}
  >
    <img src={src} alt={label} className="w-14 h-14 md:w-20 md:h-20 object-contain" />
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
