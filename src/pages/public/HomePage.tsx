import { useEffect, useRef } from "react";
import { Gift, Video, ShoppingBag, ArrowRight, Clock, DollarSign, Users, Sparkles, Eye } from "lucide-react";
import PublicNav from "@/components/public/PublicNav";
import PublicFooter from "@/components/public/PublicFooter";

// Reward carousel data (placeholder images replaced with colored cards)
const rewards = [
  { label: "PayPal", minutes: 400, color: "from-blue-500 to-blue-700", icon: "💳" },
  { label: "Cash App", minutes: 400, color: "from-green-400 to-green-600", icon: "💵" },
  { label: "Headset", minutes: 90, color: "from-purple-400 to-purple-600", icon: "🎧" },
  { label: "Bag", minutes: 150, color: "from-pink-400 to-pink-600", icon: "👜" },
  { label: "Shoes", minutes: 200, color: "from-cyan-400 to-cyan-600", icon: "👟" },
  { label: "Gift Card", minutes: 100, color: "from-yellow-400 to-orange-500", icon: "🎁" },
  { label: "Clothes", minutes: 80, color: "from-rose-400 to-rose-600", icon: "👗" },
  { label: "Accessories", minutes: 95, color: "from-indigo-400 to-indigo-600", icon: "💎" },
];

const sideRewards = [
  { icon: "👗", color: "from-pink-300 to-pink-500" },
  { icon: "👜", color: "from-blue-300 to-blue-500" },
  { icon: "🧸", color: "from-amber-300 to-amber-500" },
  { icon: "💵", color: "from-green-400 to-green-600" },
  { icon: "💳", color: "from-blue-500 to-blue-700" },
  { icon: "👟", color: "from-gray-300 to-gray-500" },
];

const RewardCarousel = () => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let pos = 0;
    let animId: number;
    const speed = 0.5;
    const totalWidth = el.scrollWidth / 2;

    const animate = () => {
      pos -= speed;
      if (pos <= -totalWidth) pos += totalWidth;
      el.style.transform = `translateX(${pos}px)`;
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  const items = [...rewards, ...rewards]; // duplicate for seamless loop

  return (
    <div className="w-full overflow-hidden rounded-xl bg-gradient-to-r from-yellow-400 via-pink-500 to-pink-400 py-6 cursor-grab">
      <div ref={scrollRef} className="flex w-max will-change-transform">
        {items.map((r, i) => (
          <div key={i} className="flex-shrink-0 mx-3">
            <div className={`w-40 h-40 rounded-2xl bg-gradient-to-br ${r.color} flex flex-col items-center justify-center shadow-lg`}>
              <span className="text-4xl mb-1">{r.icon}</span>
              <span className="text-white font-bold text-sm">{r.label}</span>
            </div>
            <p className="text-center text-white font-bold text-sm mt-2 drop-shadow">{r.minutes} Minutes</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const SideCard = ({ icon, color }: { icon: string; color: string }) => (
  <div className={`w-16 h-16 lg:w-20 lg:h-20 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md text-2xl lg:text-3xl`}>
    {icon}
  </div>
);

const HomePage = () => {
  return (
    <div className="relative">
      <PublicNav />

      {/* ===== HERO ===== */}
      <section className="pt-24 pb-12 px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black uppercase leading-tight tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
            <span className="text-white">C24 CLUB</span>
            <br />
            <span className="text-white">The Omegle Alternative</span>
            <br />
            <span className="text-yellow-300">That </span>
            <span className="bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">Rewards You!</span>
          </h1>
          <p className="mt-4 text-lg md:text-xl font-bold text-white">
            Video Chat Online With Strangers & <span className="text-green-400">Earn!</span>
          </p>
        </div>

        {/* Hero card with side rewards */}
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-3 lg:gap-5">
          {/* Left side rewards */}
          <div className="hidden sm:flex flex-col gap-3">
            {sideRewards.slice(0, 6).map((r, i) => (
              <SideCard key={`l-${i}`} icon={r.icon} color={r.color} />
            ))}
          </div>

          {/* Main hero card */}
          <div className="flex-1 max-w-2xl rounded-2xl overflow-hidden bg-gradient-to-b from-orange-300 via-orange-200 to-pink-300 p-1 shadow-2xl">
            <div className="rounded-xl bg-gradient-to-b from-orange-200/80 to-pink-200/80 p-6 space-y-4">
              {/* C24 Club badge */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">C24</div>
                <span className="text-gray-700 font-semibold text-sm">CLUB</span>
              </div>

              {/* Timer */}
              <div className="flex items-center justify-center gap-2 text-gray-800">
                <Clock className="h-6 w-6" />
                <span className="text-2xl md:text-3xl font-black">5 Minutes</span>
              </div>

              {/* Video preview placeholder */}
              <div className="flex gap-2 h-48 md:h-64">
                <div className="flex-1 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                  <div className="text-center">
                    <Video className="h-10 w-10 mx-auto text-white/50 mb-2" />
                    <span className="text-white/50 text-sm">You</span>
                  </div>
                </div>
                <div className="flex-1 rounded-xl bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center">
                  <div className="text-center">
                    <Users className="h-10 w-10 mx-auto text-white/50 mb-2" />
                    <span className="text-white/50 text-sm">Stranger</span>
                  </div>
                </div>
              </div>

              {/* Bottom text */}
              <p className="text-center text-xl md:text-2xl font-black text-gray-800" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Video Chat = <span className="text-orange-600">Rewards!</span>
              </p>
            </div>
          </div>

          {/* Right side rewards */}
          <div className="hidden sm:flex flex-col gap-3">
            {[...sideRewards].reverse().map((r, i) => (
              <SideCard key={`r-${i}`} icon={r.icon} color={r.color} />
            ))}
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col items-center gap-3 mt-8">
          <button className="group relative px-10 py-4 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-black text-lg uppercase tracking-wide shadow-xl hover:shadow-2xl transition-all transform hover:scale-105">
            <span className="flex items-center gap-2">
              Get Rewards Now <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </span>
            <span className="block text-sm font-bold opacity-90 mt-0.5">Sign Up Today</span>
          </button>
          <button className="px-8 py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-black text-base uppercase tracking-wide shadow-lg transition-all transform hover:scale-105">
            Sign In
          </button>
        </div>
      </section>

      {/* ===== STEPS ===== */}
      <section className="px-4 py-12 max-w-5xl mx-auto space-y-16">
        {/* Intro text */}
        <div className="text-center">
          <h4 className="text-xl md:text-2xl font-bold text-white leading-relaxed">
            Stop talking for free....<br />
            On C24Club, every chat pays you back<br />
            with rewards, perks, and real prizes.
          </h4>
        </div>

        {/* Step 1 */}
        <div className="space-y-6">
          <h3 className="text-2xl md:text-3xl font-black text-white text-center" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Step 1: Video Chat With Anyone & Earn Minutes!
          </h3>
          <div className="max-w-3xl mx-auto rounded-2xl overflow-hidden bg-gradient-to-br from-orange-200 to-pink-200 p-8 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-4">
                <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                  <Video className="h-8 w-8 text-white/50" />
                </div>
                <Sparkles className="h-8 w-8 text-yellow-500" />
                <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center">
                  <Users className="h-8 w-8 text-white/50" />
                </div>
              </div>
              <div className="bg-orange-500 text-white font-black text-xl px-6 py-2 rounded-lg inline-block">
                200 Minutes Earned
              </div>
              <p className="text-lg font-black text-gray-800" style={{ fontFamily: "'Poppins', sans-serif" }}>
                VIDEO <span className="text-3xl">CHAT & EARN!</span> REWARDS
              </p>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="space-y-6">
          <h3 className="text-2xl md:text-3xl font-black text-white text-center" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Step 2: Exchange your earned minutes for cash & rewards!
          </h3>
          <RewardCarousel />
        </div>

        {/* Step 3 */}
        <div className="space-y-6">
          <h3 className="text-2xl md:text-3xl font-black text-white text-center" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Step 3. Don't want to video chat...Create post to reach more people to chat elsewhere!
          </h3>
          <div className="max-w-3xl mx-auto rounded-2xl overflow-hidden bg-gradient-to-br from-cyan-300 via-blue-300 to-purple-300 p-8">
            <div className="text-center space-y-4">
              <h4 className="text-2xl md:text-3xl font-black text-blue-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Display Anything<br />Between Chat Sessions!
              </h4>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                {[
                  { views: 500, label: "Dm ME!" },
                  { views: 800, label: "Follow!" },
                  { views: 1000, label: "Check it out!" },
                ].map((card) => (
                  <div key={card.label} className="w-36 h-40 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 flex flex-col items-center justify-center shadow-lg">
                    <Eye className="h-6 w-6 text-white/60 mb-1" />
                    <span className="text-white font-bold text-sm">{card.views} Views</span>
                    <span className="text-orange-400 font-black text-xs mt-2">{card.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="flex flex-col items-center gap-3 pt-8">
          <button className="group px-10 py-4 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-black text-lg uppercase tracking-wide shadow-xl hover:shadow-2xl transition-all transform hover:scale-105">
            <span className="flex items-center gap-2">
              Get Rewards Now <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </span>
            <span className="block text-sm font-bold opacity-90 mt-0.5">Sign Up Today</span>
          </button>
          <button className="px-8 py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-black text-base uppercase tracking-wide shadow-lg transition-all transform hover:scale-105">
            Sign In
          </button>
        </div>
      </section>

      <div className="mt-12" />
      <PublicFooter />
    </div>
  );
};

export default HomePage;
