import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Star, ChevronRight, Video, Gift, Check, X } from "lucide-react";
import PublicNav from "@/components/public/PublicNav";
import PublicFooter from "@/components/public/PublicFooter";

interface Alternative {
  rank: number;
  name: string;
  tagline: string;
  description: string;
  tags: string[];
  pros: string[];
  cons: string[];
  rating: number;
  isBest?: boolean;
  blogSlug?: string;
  externalUrl?: string;
}

const alternatives: Alternative[] = [
  {
    rank: 1,
    name: "C24 Club",
    tagline: "The Omegle alternative with a built-in rewards program",
    description:
      "C24 Club is the only random video chat site where every minute of conversation collects reward minutes. Redeem your minutes for gift cards, designer prizes, and participate in weekly challenges. With AI moderation, scheduled call windows to ensure active users, and a thriving user base of thousands, C24 Club is not just a replacement for Omegle but a huge upgrade.",
    tags: ["Rewards Program", "Prize Redemption", "AI Moderation", "No Download", "Weekly Challenges", "Spin to Win"],
    pros: [
      "Collect real rewards for chatting",
      "AI-powered NSFW moderation",
      "100+ redeemable prizes",
      "Active community with scheduled sessions",
    ],
    cons: ["Requires account signup", "Call windows mean you can't chat 24/7"],
    rating: 4.8,
    isBest: true,
  },
  {
    rank: 2,
    name: "Monkey App",
    tagline: "Mobile-first video chat app popular with Gen Z",
    description:
      "Monkey App became popular as a mobile-oriented alternative to Omegle, especially designed for young people. The platform offers a chance to make video matches lasting 15 seconds, which can be extended if both users agree. Although the swipe feature is modern, it lacks a rewards program offered by C24 Club.",
    tags: ["Mobile App", "Quick Matching", "Young Community"],
    pros: ["Fast matching speed", "Mobile-optimized experience", "Simple swipe interface"],
    cons: ["No rewards or earning system", "Requires app download", "Limited moderation", "Primarily mobile only"],
    rating: 3.5,
    blogSlug: "c24-club-vs-monkey-app",
  },
  {
    rank: 3,
    name: "Chatroulette",
    tagline: "The original random video chat pioneer",
    description:
      "Chatroulette was another pioneer of random video chat, along with Omegle. Although the site is still active, the site has been struggling with issues of content moderation and the number of users on the site has also been decreasing significantly. The site does not have any of the gamification and reward aspects that the modern version of the site, i.e., C24 Club, has to offer.",
    tags: ["No Signup", "Web-Based", "Classic"],
    pros: ["No account required", "Simple interface", "Established brand"],
    cons: ["Persistent moderation problems", "No rewards system", "Declining user base", "Outdated interface"],
    rating: 3.0,
    blogSlug: "c24-club-vs-chatroulette",
  },
  {
    rank: 4,
    name: "OmeTV",
    tagline: "International video chat with country filters",
    description:
      "OmeTV provides a random video chat feature that also allows for filtering by country, as well as translating messages in real-time. It has a large international user base and is available as a web app and a mobile app. However, instead of rewarding its users, OmeTV uses ads for profit, and users have to pay for premium features.",
    tags: ["Country Filter", "Translation", "Multi-Platform"],
    pros: ["Country-based filtering", "Real-time translation", "Large user base"],
    cons: ["Ad-heavy experience", "No earning system", "Premium features cost money", "Reports of bots"],
    rating: 3.2,
    blogSlug: "c24-club-vs-ometv",
  },
  {
    rank: 5,
    name: "Tinychat",
    tagline: "Group video chat rooms with themed communities",
    description:
      "Tinychat takes a different approach by offering themed group video chat rooms rather than 1-on-1 random matching. Users can create or join rooms based on interests. While the group format has its appeal, it lacks the intimate 1-on-1 experience and reward system that platforms like C24 Club offer.",
    tags: ["Group Chat", "Themed Rooms", "Community"],
    pros: ["Group video chat option", "Themed room categories", "Long-running platform"],
    cons: ["Not truly random 1-on-1", "No rewards", "Dated interface", "Premium required for best features"],
    rating: 2.8,
    blogSlug: "c24-club-vs-tinychat",
  },
  {
    rank: 6,
    name: "Uhmegle",
    tagline: "Free no-signup video chat inspired by Omegle",
    description:
      "Uhmegle is a free, no-signup random video chat platform that closely mirrors the original Omegle experience. Users simply open the website, enable their camera, and start matching with strangers worldwide. While its simplicity and zero-barrier entry are appealing, Uhmegle lacks any reward system, advanced moderation, or gamification features that keep users engaged long-term.",
    tags: ["No Signup", "Free", "Web-Based", "Omegle Clone"],
    pros: ["No account required", "Completely free to use", "Simple and familiar interface", "Works on mobile browsers"],
    cons: ["No rewards or earning system", "Limited moderation tools", "No unique features beyond basic chat", "No community or social features"],
    rating: 2.5,
    blogSlug: "c24-club-vs-uhmegle",
    externalUrl: "https://uhmegle.com",
  },
  {
    rank: 7,
    name: "Emerald Chat",
    tagline: "Moderated video chat with matching filters",
    description:
      "Emerald Chat positions itself as a safer Omegle alternative with 24/7 moderation, age verification, and interest-based matching. It offers both 1-on-1 video chat and group chat rooms. While it has better safety features than many competitors, it lacks the earning and reward mechanics that make platforms like C24 Club stand out.",
    tags: ["Moderated", "Interest Matching", "Group Chat", "Age Verified"],
    pros: ["24/7 moderation team", "Interest-based matching", "Age verification system", "Group chat option"],
    cons: ["No rewards or earning system", "Premium features behind paywall", "Smaller user base", "Can be slow to find matches"],
    rating: 3.1,
    blogSlug: "c24-club-vs-emerald-chat",
    externalUrl: "https://emeraldchat.com",
  },
  {
    rank: 8,
    name: "Vooz Video Chat",
    tagline: "Social video chat with themed virtual rooms",
    description:
      "Vooz Video Chat offers a mix of random matching and themed virtual rooms, letting users jump into conversations based on shared interests. While the platform provides a modern interface and supports both web and mobile, it doesn't offer any earning or rewards for time spent chatting. Users looking for a gamified, incentive-driven experience will find C24 Club's reward system more compelling.",
    tags: ["Themed Rooms", "Interest Matching", "Web + Mobile"],
    pros: ["Interest-based virtual rooms", "Clean modern UI", "Works on web and mobile"],
    cons: ["No rewards or earning system", "Smaller active user base", "Limited moderation tools", "Ads interrupt the experience"],
    rating: 2.6,
    blogSlug: "c24-club-vs-vooz-video-chat",
  },
];

const StarRating = ({ rating }: { rating: number }) => {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < full ? "text-yellow-400 fill-yellow-400" : i === full && half ? "text-yellow-400 fill-yellow-400/50" : "text-white/20"}`}
        />
      ))}
      <span className="text-white/60 text-sm font-bold ml-1">{rating}/5</span>
    </div>
  );
};

const AlternativeCard = ({ alt }: { alt: Alternative }) => (
  <div
    className={`relative rounded-2xl border overflow-hidden ${alt.isBest ? "border-orange-500/50 bg-gradient-to-br from-[#1a1a2e] to-[#2a1a1e]" : "border-white/10 bg-[#1a1a2e]"}`}
  >
    {alt.isBest && (
      <div className="absolute top-0 right-0 px-4 py-1.5 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-bl-xl">
        <span className="text-white font-black text-xs uppercase tracking-wider">🏆 #1 Best Choice</span>
      </div>
    )}
    <div className="p-6 md:p-8">
      <div className="flex items-start gap-4 mb-4">
        <div
          className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl ${alt.isBest ? "bg-gradient-to-br from-orange-500 to-yellow-500 text-white" : "bg-white/10 text-white/60"}`}
        >
          #{alt.rank}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-2xl font-black text-white">{alt.name}</h3>
          <p className="text-white/50 text-sm">{alt.tagline}</p>
          <div className="mt-1">
            <StarRating rating={alt.rating} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {alt.tags.map((tag) => (
          <span
            key={tag}
            className={`px-3 py-1 rounded-full text-xs font-bold ${alt.isBest ? "bg-orange-500/20 text-orange-300 border border-orange-500/30" : "bg-white/5 text-white/60 border border-white/10"}`}
          >
            {tag}
          </span>
        ))}
      </div>

      <p className="text-white/60 text-sm leading-relaxed mb-6">{alt.description}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-green-400 font-bold text-xs uppercase tracking-wider mb-2">✅ Pros</p>
          <ul className="space-y-1">
            {alt.pros.map((p) => (
              <li key={p} className="text-white/70 text-sm flex items-start gap-2">
                <span className="text-green-400 mt-0.5">•</span> {p}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-red-400 font-bold text-xs uppercase tracking-wider mb-2">❌ Cons</p>
          <ul className="space-y-1">
            {alt.cons.map((c) => (
              <li key={c} className="text-white/70 text-sm flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span> {c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {alt.isBest ? (
          <Link
            to="/"
            className="flex-1 text-center px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-black text-sm uppercase tracking-wide shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            Try C24 Club Free <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <>
            {alt.blogSlug && (
              <Link
                to={`/blog/${alt.blogSlug}`}
                className="flex-1 text-center px-6 py-3 rounded-xl border border-orange-500/30 hover:bg-orange-500/10 text-orange-400 font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                C24 Club vs {alt.name} <ChevronRight className="h-4 w-4" />
              </Link>
            )}
            <Link
              to="/"
              className="flex-1 text-center px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 font-bold text-sm transition-all"
            >
              Try C24 Club Instead
            </Link>
          </>
        )}
      </div>
    </div>
  </div>
);

const featureRows = [
  { label: "Rewards / Earning System", key: "rewards" as const },
  { label: "AI / Active Moderation", key: "moderation" as const },
  { label: "Mobile App Available", key: "mobileApp" as const },
  { label: "No Signup Required", key: "noSignup" as const },
  { label: "Interest / Topic Matching", key: "interestMatch" as const },
  { label: "Group Chat Rooms", key: "groupChat" as const },
  { label: "Country / Gender Filters", key: "filters" as const },
  { label: "Free to Use", key: "free" as const },
];

const featureData: Record<string, Record<string, boolean>> = {
  "C24 Club":          { rewards: true,  moderation: true,  mobileApp: false, noSignup: false, interestMatch: true,  groupChat: false, filters: true,  free: true },
  "Monkey App":        { rewards: false, moderation: false, mobileApp: true,  noSignup: false, interestMatch: true,  groupChat: false, filters: true,  free: true },
  "Chatroulette":      { rewards: false, moderation: false, mobileApp: false, noSignup: true,  interestMatch: false, groupChat: false, filters: false, free: true },
  "OmeTV":             { rewards: false, moderation: false, mobileApp: true,  noSignup: false, interestMatch: false, groupChat: false, filters: true,  free: true },
  "Tinychat":          { rewards: false, moderation: false, mobileApp: false, noSignup: true,  interestMatch: true,  groupChat: true,  filters: false, free: true },
  "Uhmegle":           { rewards: false, moderation: false, mobileApp: false, noSignup: true,  interestMatch: false, groupChat: false, filters: false, free: true },
  "Emerald Chat":      { rewards: false, moderation: true,  mobileApp: false, noSignup: false, interestMatch: true,  groupChat: true,  filters: true,  free: true },
  "Vooz Video Chat":   { rewards: false, moderation: false, mobileApp: true,  noSignup: false, interestMatch: true,  groupChat: true,  filters: false, free: true },
};

const ComparisonTable = () => {
  return (
    <section className="px-4 max-w-5xl mx-auto mb-16">
      <h2
        className="text-2xl md:text-3xl font-black text-white text-center mb-2"
        style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}
      >
        Feature Comparison Table
      </h2>
      <p className="text-white/50 text-center text-sm mb-8 max-w-xl mx-auto">
        See how each platform stacks up across the features that matter most.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[#0f0f1a] px-4 py-3 text-xs font-bold text-white/40 uppercase tracking-wider border-b border-white/10 min-w-[180px]">
                Feature
              </th>
              {alternatives.map((alt) => (
                <th
                  key={alt.name}
                  className={`px-3 py-3 text-center text-xs font-black uppercase tracking-wider border-b border-white/10 min-w-[100px] ${
                    alt.isBest ? "text-orange-400" : "text-white/70"
                  }`}
                >
                  {alt.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-white/5">
              <td className="sticky left-0 z-10 bg-[#0f0f1a] px-4 py-3 text-sm font-bold text-white/80">Rating</td>
              {alternatives.map((alt) => (
                <td key={alt.name} className="px-3 py-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`text-sm font-black ${alt.isBest ? "text-orange-400" : "text-white/70"}`}>
                      {alt.rating}
                    </span>
                    <StarRating rating={alt.rating} />
                  </div>
                </td>
              ))}
            </tr>
            {featureRows.map((row) => (
              <tr key={row.key} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="sticky left-0 z-10 bg-[#0f0f1a] px-4 py-3 text-sm font-bold text-white/80">
                  {row.label}
                </td>
                {alternatives.map((alt) => {
                  const val = featureData[alt.name]?.[row.key] ?? false;
                  return (
                    <td key={alt.name} className="px-3 py-3 text-center">
                      {val ? (
                        <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20">
                          <Check className="h-3.5 w-3.5 text-green-400" />
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/10">
                          <X className="h-3.5 w-3.5 text-red-400/60" />
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const TopOmegleAlternativesPage = () => {
  useEffect(() => {
    document.title = "Top 8 Omegle Alternatives in 2026 — Best Random Video Chat Sites | C24 Club";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Compare the top 8 Omegle alternatives in 2026. C24 Club, Monkey App, Chatroulette, OmeTV, Tinychat, Uhmegle, Emerald Chat & Vooz — find the best random video chat site that pays you to chat.",
      );
    }
  }, []);

  return (
    <div className="relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "Top 8 Omegle Alternatives in 2026",
            description:
              "Compare the best Omegle alternatives including C24 Club, Monkey App, Chatroulette, OmeTV, Tinychat, Uhmegle, Emerald Chat, and Vooz Video Chat.",
            author: { "@type": "Organization", name: "C24 Club" },
            publisher: { "@type": "Organization", name: "C24 Club", url: "https://c24club.com" },
            datePublished: "2026-01-15",
            dateModified: "2026-04-24",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Top 8 Omegle Alternatives in 2026",
            description:
              "A ranked list of the best Omegle alternatives for random video chat in 2026.",
            url: "https://c24club.com/top-omegle-alternatives",
            numberOfItems: alternatives.length,
            itemListOrder: "https://schema.org/ItemListOrderAscending",
            itemListElement: alternatives.map((alt) => ({
              "@type": "ListItem",
              position: alt.rank,
              url: `https://c24club.com/top-omegle-alternatives#rank-${alt.rank}`,
              item: {
                "@type": "SoftwareApplication",
                name: alt.name,
                description: alt.tagline,
                applicationCategory: "SocialNetworkingApplication",
                operatingSystem: "Web, iOS, Android",
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: alt.rating,
                  bestRating: 5,
                  worstRating: 1,
                  ratingCount: 100,
                },
              },
            })),
          }),
        }}
      />
      <PublicNav />

      {/* Hero */}
      <section className="pt-28 pb-12 px-4 text-center">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-orange-400 mb-4">Updated April 2026</p>
        <h1
          className="text-4xl md:text-5xl lg:text-6xl font-black uppercase leading-tight tracking-tight max-w-4xl mx-auto"
          style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}
        >
          <span className="text-white">Top 8 </span>
          <span className="bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
            Omegle Alternatives
          </span>
          <span className="text-white"> in 2026</span>
        </h1>
        <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
          Find the best platform for random video chatting with strangers. We compared features, safety, rewards, and
          user experience.
        </p>
      </section>

      {/* Quick comparison strip */}
      <section className="px-4 max-w-4xl mx-auto mb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {alternatives.map((alt) => (
            <a
              key={alt.rank}
              href={`#rank-${alt.rank}`}
              className={`text-center px-3 py-3 rounded-xl border transition-all hover:scale-105 ${
                alt.isBest
                  ? "border-orange-500/50 bg-orange-500/10"
                  : "border-white/10 bg-white/5 hover:border-white/20"
              }`}
            >
              <span className={`block text-xs font-black ${alt.isBest ? "text-orange-400" : "text-white/40"}`}>
                #{alt.rank}
              </span>
              <span className={`block text-sm font-bold ${alt.isBest ? "text-white" : "text-white/70"}`}>
                {alt.name}
              </span>
              <StarRating rating={alt.rating} />
            </a>
          ))}
        </div>
      </section>

      {/* Cards */}
      <section className="px-4 max-w-4xl mx-auto space-y-6 pb-16">
        {alternatives.map((alt) => (
          <div key={alt.rank} id={`rank-${alt.rank}`}>
            <AlternativeCard alt={alt} />
          </div>
        ))}
      </section>

      <ComparisonTable />

      {/* Internal links to related content */}
      <section className="px-4 py-16 max-w-4xl mx-auto border-t border-white/10">
        <h2
          className="text-2xl font-black text-white text-center mb-8"
          style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}
        >
          Read Our Detailed Comparisons
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {alternatives
            .filter((a) => a.blogSlug)
            .map((a) => (
              <Link
                key={a.blogSlug}
                to={`/blog/${a.blogSlug}`}
                className="flex items-center gap-3 px-5 py-4 rounded-xl border border-white/10 hover:border-orange-500/30 bg-white/[0.02] hover:bg-white/[0.05] transition-all group"
              >
                <Video className="h-5 w-5 text-orange-400 flex-shrink-0" />
                <span className="text-white/80 font-bold text-sm group-hover:text-white transition-colors">
                  C24 Club vs {a.name} — Full Comparison
                </span>
                <ChevronRight className="h-4 w-4 text-white/30 ml-auto group-hover:text-orange-400 transition-colors" />
              </Link>
            ))}
          <Link
            to="/omegle-alternative"
            className="flex items-center gap-3 px-5 py-4 rounded-xl border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 transition-all group"
          >
            <Gift className="h-5 w-5 text-orange-400 flex-shrink-0" />
            <span className="text-orange-300 font-bold text-sm group-hover:text-orange-200 transition-colors">
              Why C24 Club Is The Best Omegle Alternative
            </span>
            <ChevronRight className="h-4 w-4 text-orange-400/50 ml-auto group-hover:text-orange-400 transition-colors" />
          </Link>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-4 py-16 text-center bg-gradient-to-b from-transparent to-orange-500/5">
        <h2 className="text-3xl font-black text-white mb-3" style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}>
          Stop Searching. Start <span className="text-yellow-400">Chatting.</span>
        </h2>
        <p className="text-white/50 mb-8 max-w-lg mx-auto">
          C24 Club is the only Omegle alternative with a built-in rewards program. Join free today.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-10 py-4 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-black text-lg uppercase tracking-wide shadow-xl transition-all hover:scale-105"
        >
          Join C24 Club Free <ChevronRight className="h-5 w-5" />
        </Link>
      </section>

      <PublicFooter />
    </div>
  );
};

export default TopOmegleAlternativesPage;
