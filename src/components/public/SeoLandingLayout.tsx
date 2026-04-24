import { ReactNode, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Video, Gift, Shield, Sparkles } from "lucide-react";
import PublicNav from "@/components/public/PublicNav";
import PublicFooter from "@/components/public/PublicFooter";

interface SeoLandingLayoutProps {
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  children: ReactNode;
  /** Sibling pages to internally link to (excluding current page). */
  siblingLinks?: { label: string; to: string }[];
  canonical: string;
}

/**
 * Shared layout for SEO sibling-cluster landing pages.
 * - Sets <title>, meta description, and canonical
 * - Renders consistent hero, content slot, CTA back to /, and internal link block
 */
const SeoLandingLayout = ({
  title,
  metaDescription,
  h1,
  intro,
  children,
  siblingLinks = [],
  canonical,
}: SeoLandingLayoutProps) => {
  useEffect(() => {
    document.title = title;

    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    setMeta("description", metaDescription);

    let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalEl) {
      canonicalEl = document.createElement("link");
      canonicalEl.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute("href", canonical);
  }, [title, metaDescription, canonical]);

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <PublicNav />

      {/* Hero */}
      <section className="pt-28 pb-10 px-4 max-w-4xl mx-auto text-center">
        <h1
          className="text-4xl md:text-5xl font-bold mb-5 bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent"
          style={{ fontFamily: "'Antigone', sans-serif" }}
        >
          {h1}
        </h1>
        <p className="text-white/70 text-lg max-w-2xl mx-auto">{intro}</p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 text-black font-bold hover:scale-105 transition-transform"
          >
            <Video className="w-5 h-5" />
            Start Chatting Free
          </Link>
          <Link
            to="/how-to-guide"
            className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-white/10 hover:bg-white/15 text-white font-medium transition"
          >
            How It Works
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Body content */}
      <article className="max-w-3xl mx-auto px-4 pb-12 prose prose-invert prose-headings:text-white prose-p:text-white/75 prose-a:text-amber-400 prose-strong:text-white prose-li:text-white/75 max-w-none">
        {children}
      </article>

      {/* Mid-page CTA */}
      <section className="max-w-3xl mx-auto px-4 pb-12">
        <div className="rounded-2xl bg-gradient-to-br from-orange-500/15 to-yellow-500/10 border border-orange-500/30 p-8 text-center">
          <Sparkles className="w-8 h-8 text-amber-400 mx-auto mb-3" />
          <h2 className="text-2xl font-bold mb-2">Ready to meet someone new?</h2>
          <p className="text-white/70 mb-5">
            Join C24 Club for free — no sign-up barriers, no downloads. Earn reward minutes for every
            conversation and redeem them for gift cards, designer products, or PayPal cash.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 text-black font-bold hover:scale-105 transition-transform"
          >
            <Gift className="w-5 h-5" />
            Start Earning Now
          </Link>
        </div>
      </section>

      {/* Internal sibling links */}
      {siblingLinks.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 pb-16">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            Explore More
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {siblingLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="group flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition"
              >
                <span className="font-medium text-white">{link.label}</span>
                <ArrowRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <PublicFooter />
    </div>
  );
};

export default SeoLandingLayout;