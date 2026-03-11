import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "About CEP", href: "#about" },
  { label: "Why Us?", href: "#why-us" },
  { label: "FAQ", href: "/faq" },
  { label: "Rules", href: "/rules" },
  { label: "Blog", href: "/blog" },
  { label: "Milestones", href: "/milestones-page" },
];

const PublicNav = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-3">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2.5 no-underline">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-lg font-black text-white shadow-lg">
          🎁
        </div>
        <span className="font-extrabold text-xl text-white uppercase tracking-wide drop-shadow-lg" style={{ fontFamily: "'Poppins', sans-serif" }}>
          C24CLUB
        </span>
      </Link>

      {/* Desktop nav */}
      <ul className="hidden md:flex items-center gap-1">
        {navLinks.map((link) => (
          <li key={link.label}>
            {link.href.startsWith("#") ? (
              <a href={link.href} className="px-3 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors rounded-md hover:bg-white/10">
                {link.label}
              </a>
            ) : (
              <Link to={link.href} className="px-3 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors rounded-md hover:bg-white/10">
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>

      {/* Mobile toggle */}
      <button onClick={() => setOpen(!open)} className="md:hidden text-white p-2">
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Mobile menu */}
      {open && (
        <div className="absolute top-full left-0 right-0 bg-[#1a1a1a]/95 backdrop-blur-md border-t border-white/10 md:hidden">
          <ul className="flex flex-col p-4 gap-1">
            {navLinks.map((link) => (
              <li key={link.label}>
                {link.href.startsWith("#") ? (
                  <a href={link.href} onClick={() => setOpen(false)} className="block px-4 py-3 text-sm font-medium text-white/80 hover:text-white rounded-md hover:bg-white/10">
                    {link.label}
                  </a>
                ) : (
                  <Link to={link.href} onClick={() => setOpen(false)} className="block px-4 py-3 text-sm font-medium text-white/80 hover:text-white rounded-md hover:bg-white/10">
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
};

export default PublicNav;
