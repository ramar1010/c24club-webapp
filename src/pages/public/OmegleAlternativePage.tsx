import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Video, Gift, Shield, Users, Clock, DollarSign, MessageCircle, Zap, Star, ChevronRight } from "lucide-react";
import PublicNav from "@/components/public/PublicNav";
import PublicFooter from "@/components/public/PublicFooter";

const features = [
  {
    icon: Video,
    title: "Random 1-on-1 Video Chat",
    description:
      "Instantly connect with strangers worldwide for real-time face-to-face conversations. No need to download anything; just click and chat.",
  },
  {
    icon: Gift,
    title: "Earn Real Rewards",
    description:
      "Unlike Omegle, you earn rewards for every minute you spend talking to strangers. You can use these rewards to buy PayPal money, gift cards, designer products, etc.",
  },
  {
    icon: Shield,
    title: "Safer Than Omegle",
    description:
      "Our platform uses AI moderation, NSFW content detection, reporting, and a strict community policy to create a safe environment for users.",
  },
  {
    icon: Users,
    title: "Active Community",
    description:
      "Thousands of users are online during scheduled call windows. Meet strangers from all over the world and create real connections.",
  },
  {
    icon: Clock,
    title: "Scheduled Sessions",
    description:
      "Scheduled calls ensure that there are always people available for you to talk to during the scheduled call window. Forget about waiting in empty lobbies for strangers to appear, unlike other Omegle alternatives.",
  },
  {
    icon: DollarSign,
    title: "Female Earning Bonus",
    description:
      "Female users earn bonus minutes and can cash out via PayPal. The anchor program lets women earn real money just for chatting.",
  },
];

const faqs = [
  {
    q: "What is the best Omegle alternative in 2026?",
    a: "It is considered the best alternative to Omegle as it includes a reward feature along with random video chat. You can earn money by having a conversation on C24 Club. The earned minutes can be redeemed as real money through PayPal, gift cards, and other products.",
  },
  {
    q: "Is C24 Club free to use?",
    a: "Yes, C24 Club is free to join and use. You can video chat and earn money by chatting with strangers. You don't need to pay anything to join C24 Club.",
  },
  {
    q: "Is C24 Club safer than Omegle?",
    a: "Yes, C24 Club is a lot safer compared to Omegle. C24 Club uses NSFW detection, a report feature, IP blocking, and moderation. The age limit to join C24 Club is 18+, and the user must agree to the community guidelines. Omegle was not moderated before it was shut down.",
  },
  {
    q: "How does C24 Club compare to other Omegle alternatives like Chatroulette?",
    a: "Chatroulette and OmeTV are video chat alternatives to Omegle. C24 Club is the best alternative as it rewards its users for video chatting. You can earn money by chatting and playing games on C24 Club. No other alternative to Omegle offers this feature.",
  },
  {
    q: "Can I earn money on C24 Club?",
    a: "Yes! Every minute of video chat earns you reward minutes. Once you hit the threshold, you can cash out via PayPal or Cash App. Female anchors can earn even more through the dedicated anchor earning program.",
  },
  {
    q: "Does C24 Club work on mobile?",
    a: "Yes, C24 Club works on any device with a browser and camera — phones, tablets, laptops, and desktops. No app download required.",
  },
];

const OmegleAlternativePage = () => {
  useEffect(() => {
    document.title = "Best Omegle Alternative 2026 — Video Chat & Earn Rewards | C24 Club";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Looking for an Omegle alternative? C24 Club lets you video chat with strangers 1-on-1 and earn real rewards like PayPal cash, gift cards & more. Free, safe, and fun.",
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
            "@type": "WebApplication",
            name: "C24 Club — Best Omegle Alternative",
            url: "https://c24club.com/omegle-alternative",
            description:
              "C24 Club is the best free Omegle alternative where you video chat 1-on-1 with strangers and earn real rewards.",
            applicationCategory: "SocialNetworkingApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
      <PublicNav />

      {/* Hero */}
      <section className="pt-28 pb-16 px-4 text-center">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-orange-400 mb-4">The #1 Omegle Alternative</p>
        <h1
          className="text-4xl md:text-6xl lg:text-7xl font-black uppercase leading-tight tracking-tight max-w-4xl mx-auto"
          style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}
        >
          <span className="text-white">The Best </span>
          <span className="bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
            Omegle Alternative
          </span>
          <br />
          <span className="text-white">That </span>
          <span className="text-yellow-300">Pays You To Chat</span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
          Omegle shut down, but the fun didn't stop. C24 Club is a free random video chat platform where you meet
          strangers 1-on-1 and <span className="text-green-400 font-bold">earn real rewards</span> for every
          conversation.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/"
            className="px-10 py-4 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-black text-lg uppercase tracking-wide shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 flex items-center gap-2"
          >
            Start Chatting Now <ChevronRight className="h-5 w-5" />
          </Link>
          <Link
            to="/how-to-guide"
            className="px-8 py-3 rounded-full border-2 border-white/20 hover:border-white/40 text-white font-bold text-sm uppercase tracking-wide transition-all"
          >
            How It Works
          </Link>
        </div>
      </section>

      {/* What is C24 Club */}
      <section className="px-4 py-16 max-w-4xl mx-auto">
        <h2
          className="text-3xl md:text-4xl font-black text-white text-center mb-6"
          style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}
        >
          What Is C24 Club? The <span className="text-yellow-400">Omegle Replacement</span> You've Been Waiting For
        </h2>
        <div className="text-white/60 text-base md:text-lg leading-relaxed space-y-4 text-center max-w-3xl mx-auto">
          <p>
            After Omegle shut down in November 2023, millions of users worldwide were on the lookout for the next great
            random video chat site. C24 Club is here to fill that void, and then some. We are not just another Omegle
            clone; we are a <strong className="text-white">video chat site that rewards you</strong> for socializing.
          </p>
          <p>
            Every minute you spend in a video call earns you reward minutes. Trade those minutes for{" "}
            <strong className="text-white">
              {" "}
              PayPal cash, Cash App payouts, gift cards, designer bags, clothing, tech accessories
            </strong>
            , and over 100 other prizes in our Reward Store.
          </p>
          <p>
            You might have called it Omegle, Chatroulette, OmeTV, or whatever other names you came up with for "that
            random video chat site." Whatever you want to call it, C24 Club is here, and we are better in every way,
            with safer moderation, better features, and actual rewards for your time.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 py-16 max-w-6xl mx-auto">
        <h2
          className="text-3xl md:text-4xl font-black text-white text-center mb-4"
          style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}
        >
          Why C24 Club Is The Best <span className="text-orange-400">Omegle Alternative</span>
        </h2>
        <p className="text-white/50 text-center mb-12 max-w-2xl mx-auto">
          Here's what makes us different from every other random video chat site.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="relative bg-[#1a1a2e] rounded-2xl p-6 border border-white/10 hover:border-orange-500/30 transition-colors group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-yellow-600/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <f.icon className="h-6 w-6 text-orange-400" />
              </div>
              <h3 className="text-lg font-black text-white mb-2">{f.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="px-4 py-16 max-w-4xl mx-auto">
        <h2
          className="text-3xl md:text-4xl font-black text-white text-center mb-8"
          style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}
        >
          C24 Club vs Other <span className="text-yellow-400">Omegle Alternatives</span>
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/5">
                <th className="text-left px-5 py-4 text-white/80 font-bold">Feature</th>
                <th className="px-5 py-4 text-orange-400 font-black">C24 Club</th>
                <th className="px-5 py-4 text-white/50 font-bold">Omegle</th>
                <th className="px-5 py-4 text-white/50 font-bold">Chatroulette</th>
                <th className="px-5 py-4 text-white/50 font-bold">OmeTV</th>
              </tr>
            </thead>
            <tbody className="text-center">
              {[
                ["Free to use", "✅", "✅", "✅", "✅"],
                ["Earn rewards", "✅", "❌", "❌", "❌"],
                ["Cash out (PayPal)", "✅", "❌", "❌", "❌"],
                ["AI moderation", "✅", "❌", "✅", "✅"],
                ["No download needed", "✅", "✅", "✅", "❌"],
                ["Spin to win prizes", "✅", "❌", "❌", "❌"],
                ["Weekly challenges", "✅", "❌", "❌", "❌"],
                ["Still active (2026)", "✅", "❌", "✅", "✅"],
              ].map(([feat, ...vals], i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white/[0.02]" : ""}>
                  <td className="text-left px-5 py-3 text-white/70 font-medium">{feat}</td>
                  {vals.map((v, j) => (
                    <td key={j} className={`px-5 py-3 ${j === 0 ? "text-base" : "text-base"}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-4 py-16 max-w-3xl mx-auto">
        <h2
          className="text-3xl md:text-4xl font-black text-white text-center mb-10"
          style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}
        >
          Frequently Asked Questions About <span className="text-orange-400">Omegle Alternatives</span>
        </h2>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <details key={i} className="group bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
              <summary className="flex items-center justify-between cursor-pointer px-6 py-5 text-white font-bold text-base hover:text-orange-400 transition-colors list-none">
                {faq.q}
                <ChevronRight className="h-5 w-5 text-white/30 group-open:rotate-90 transition-transform flex-shrink-0 ml-4" />
              </summary>
              <div className="px-6 pb-5 text-white/60 text-sm leading-relaxed">{faq.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-4 py-16 text-center">
        <h2
          className="text-3xl md:text-4xl font-black text-white mb-4"
          style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}
        >
          Ready To Try The Best <span className="text-yellow-400">Omegle Alternative</span>?
        </h2>
        <p className="text-white/50 mb-8 max-w-xl mx-auto">
          Join thousands of users who switched from Omegle to C24 Club. Start chatting, start earning.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-10 py-4 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-black text-lg uppercase tracking-wide shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
        >
          Start Video Chatting Free <ChevronRight className="h-5 w-5" />
        </Link>
      </section>

      <PublicFooter />
    </div>
  );
};

export default OmegleAlternativePage;
