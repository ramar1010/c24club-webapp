import { Link } from "react-router-dom";

const footerLinks = [
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Site Rules", href: "/rules" },
  { label: "How To Guide", href: "/how-to-guide" },
  { label: "Safety Center", href: "/safety" },
  { label: "Omegle Alternative", href: "/omegle-alternative" },
  { label: "Top Omegle Alternatives", href: "/top-omegle-alternatives" },
];

const PublicFooter = () => {
  return (
    <footer className="w-full bg-gradient-to-r from-orange-500 via-orange-400 to-yellow-500 py-3 px-4">
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        {footerLinks.map((link, i) => (
          <span key={link.label} className="flex items-center gap-2">
            <Link
              to={link.href}
              className="text-sm font-bold text-white hover:text-white/80 transition-colors"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {link.label}
            </Link>
            {i < footerLinks.length - 1 && <span className="text-white/60">|</span>}
          </span>
        ))}
      </div>
    </footer>
  );
};

export default PublicFooter;
