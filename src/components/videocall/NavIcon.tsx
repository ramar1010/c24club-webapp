interface NavIconProps {
  src: string;
  label: string;
  onClick?: () => void;
  highlight?: boolean;
}

const NavIcon = ({ src, label, onClick, highlight }: NavIconProps) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1 hover:scale-110 transition-transform ${
      highlight ? "scale-105" : ""
    }`}
  >
    <img src={src} alt={label} className="w-14 h-14 object-contain" />
    <span
      className={`text-[11px] font-black tracking-wider ${
        highlight ? "text-white text-sm" : "text-white"
      }`}
    >
      {label}
    </span>
  </button>
);

export default NavIcon;
