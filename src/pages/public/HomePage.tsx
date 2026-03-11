import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import step1Img from "@/assets/index-step1.png";
import step3Img from "@/assets/index-step3.png";
import PublicNav from "@/components/public/PublicNav";
import PublicFooter from "@/components/public/PublicFooter";

import reward1 from "@/assets/rewards/reward1.jpg";
import reward3 from "@/assets/rewards/reward3.jpg";
import reward4 from "@/assets/rewards/reward4.jpeg";
import reward5 from "@/assets/rewards/reward5.jpg";
import reward6 from "@/assets/rewards/reward6.jpg";
import reward7 from "@/assets/rewards/reward7.jpg";
import bagImg from "@/assets/rewards/bag.png";
import cashImg from "@/assets/rewards/cash.png";

// Reward carousel data with real images
const rewards = [
  { label: "PayPal", minutes: 400, image: reward1 },
  { label: "Cash App", minutes: 400, image: cashImg },
  { label: "Bucket Hat", minutes: 80, image: reward4 },
  { label: "Bag", minutes: 150, image: bagImg },
  { label: "Boots", minutes: 200, image: reward3 },
  { label: "Dress", minutes: 100, image: reward5 },
  { label: "Heart Bag", minutes: 95, image: reward6 },
  { label: "Phone Cases", minutes: 90, image: reward7 },
];

// Side reward images (3 per side)
const leftSideRewards = [reward5, bagImg, reward1];
const rightSideRewards = [reward6, cashImg, reward3];

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

  const items = [...rewards, ...rewards];

  return (
    <div className="w-full overflow-hidden rounded-xl bg-gradient-to-r from-yellow-400 via-pink-500 to-pink-400 py-6 cursor-grab">
      <div ref={scrollRef} className="flex w-max will-change-transform">
        {items.map((r, i) => (
          <div key={i} className="flex-shrink-0 mx-3">
            <div className="w-40 h-40 rounded-2xl overflow-hidden shadow-lg">
              <img src={r.image} alt={r.label} className="w-full h-full object-cover" />
            </div>
            <p className="text-center text-white font-bold text-sm mt-2 drop-shadow">{r.minutes} Minutes</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const SideCard = ({ image }: { image: string }) => (
  <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-xl overflow-hidden shadow-md">
    <img src={image} alt="Reward" className="w-full h-full object-cover" />
  </div>
);

const HomePage = () => {
  return (
    <div className="relative">
      <PublicNav />

      {/* ===== HERO ===== */}
      <section className="pt-24 pb-12 px-4">
        <div className="text-center mb-8">
          <h1
            className="text-4xl md:text-6xl lg:text-7xl font-black uppercase leading-tight tracking-tight"
            style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}
          >
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
            {leftSideRewards.map((img, i) => (
              <SideCard key={`l-${i}`} image={img} />
            ))}
          </div>

          {/* Main hero video */}
          <div className="flex-1 max-w-2xl rounded-2xl overflow-hidden shadow-2xl">
            <div className="relative w-full" style={{ paddingBottom: "75%" }}>
              <iframe
                src="https://streamable.com/e/esjsr0?autoplay=1&muted=1&loop=1"
                allow="autoplay; fullscreen"
                allowFullScreen
                className="absolute inset-0 w-full h-full border-0"
                title="C24 Club Video Chat Preview"
              />
            </div>
          </div>

          {/* Right side rewards */}
          <div className="hidden sm:flex flex-col gap-3">
            {rightSideRewards.map((img, i) => (
              <SideCard key={`r-${i}`} image={img} />
            ))}
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col items-center gap-3 mt-8">
          <button
            onClick={async () => {
              const { error } = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
              });
              if (error) toast.error("Sign in failed", { description: String(error) });
            }}
            className="group relative px-10 py-4 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-black text-lg uppercase tracking-wide shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
          >
            <span className="flex items-center gap-2">
              Get Rewards Now <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </span>
            <span className="block text-sm font-bold opacity-90 mt-0.5">Sign Up Today</span>
          </button>
          <button
            onClick={async () => {
              const { error } = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
              });
              if (error) toast.error("Sign in failed", { description: String(error) });
            }}
            className="flex items-center gap-2 px-8 py-3 rounded-lg bg-white hover:bg-gray-100 text-gray-800 font-bold text-base shadow-lg transition-all transform hover:scale-105"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Sign in with Google
          </button>
          <button
            onClick={async () => {
              const { error } = await lovable.auth.signInWithOAuth("apple", {
                redirect_uri: window.location.origin,
              });
              if (error) toast.error("Sign in failed", { description: String(error) });
            }}
            className="flex items-center gap-2 px-8 py-3 rounded-lg bg-black hover:bg-gray-900 text-white font-bold text-base shadow-lg transition-all transform hover:scale-105"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
            Sign in with Apple
        </div>
      </section>

      {/* ===== STEPS ===== */}
      <section className="px-4 py-12 max-w-5xl mx-auto space-y-16">
        <div className="text-center">
          <h4 className="text-xl md:text-2xl font-bold text-white leading-relaxed">
            Stop talking for free....<br />
            On C24Club, every chat pays you back<br />
            with rewards, perks, and real prizes.
          </h4>
        </div>

        {/* Step 1 */}
        <div className="space-y-6">
          <h3
            className="text-2xl md:text-3xl font-black text-white text-center"
            style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}
          >
            Step 1: Video Chat With Anyone & Earn Minutes!
          </h3>
          <div className="max-w-3xl mx-auto rounded-2xl overflow-hidden">
            <img src={step1Img} alt="Video Chat & Earn Rewards" className="w-full h-auto" />
          </div>
        </div>

        {/* Step 2 */}
        <div className="space-y-6">
          <h3
            className="text-2xl md:text-3xl font-black text-white text-center"
            style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}
          >
            Step 2: Exchange your earned minutes for cash & rewards!
          </h3>
          <RewardCarousel />
        </div>

        {/* Step 3 */}
        <div className="space-y-6">
          <h3
            className="text-2xl md:text-3xl font-black text-white text-center"
            style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}
          >
            Step 3. Don't want to video chat...Create post to reach more people to chat elsewhere!
          </h3>
          <div className="max-w-3xl mx-auto rounded-2xl overflow-hidden">
            <img src={step3Img} alt="Display Anything Between Chat Sessions" className="w-full h-auto" />
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="flex flex-col items-center gap-3 pt-8">
          <button
            onClick={async () => {
              const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
              if (error) toast.error("Sign in failed", { description: String(error) });
            }}
            className="group px-10 py-4 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-black text-lg uppercase tracking-wide shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
          >
            <span className="flex items-center gap-2">
              Get Rewards Now <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </span>
            <span className="block text-sm font-bold opacity-90 mt-0.5">Sign Up Today</span>
          </button>
          <button
            onClick={async () => {
              const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
              if (error) toast.error("Sign in failed", { description: String(error) });
            }}
            className="flex items-center gap-2 px-8 py-3 rounded-lg bg-white hover:bg-gray-100 text-gray-800 font-bold text-base shadow-lg transition-all transform hover:scale-105"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Sign in with Google
          </button>
        </div>
      </section>

      <div className="mt-12" />
      <PublicFooter />
    </div>
  );
};

export default HomePage;
