import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

// Slide 1 - Video Chat
import boySelfie from "@/assets/quickstart/boy-selfie.jpg";
import girlSelfie from "@/assets/quickstart/girl-selfie.jpg";
import moneyBag from "@/assets/quickstart/money-bag.png";
import topicBubble from "@/assets/quickstart/topic-bubble.png";
import giftEmoji from "@/assets/quickstart/gift-emoji.png";
import shoppingBags2 from "@/assets/quickstart/shopping-bags2.png";

// Slide 2 - Earn Minutes
import stopwatch from "@/assets/quickstart/stopwatch.png";

// Slide 3 - Redeem
import shoppingBags from "@/assets/quickstart/shopping-bags.png";
import rewardHat from "@/assets/quickstart/reward-hat.jpg";
import rewardJeans from "@/assets/quickstart/reward-jeans.jpg";
import rewardBag from "@/assets/quickstart/reward-bag.jpg";
import rewardBoots from "@/assets/quickstart/reward-boots.png";
import rewardPhonecase from "@/assets/quickstart/reward-phonecase.png";
import rewardRedbag from "@/assets/quickstart/reward-redbag.jpg";
import rewardHeartbag from "@/assets/quickstart/reward-heartbag.jpg";
import rewardShorts from "@/assets/quickstart/reward-shorts.jpg";
import paypalLogo from "@/assets/quickstart/paypal-logo.png";

// Slide 4 - Challenges
import trophyIcon from "@/assets/quickstart/trophy-icon.png";
import cashIcon from "@/assets/quickstart/cash-icon.png";

// Slide 5 - Beware
import noFrame1 from "@/assets/quickstart/no-frame1.jpg";
import noFrame2 from "@/assets/quickstart/no-frame2.png";
import fastForward from "@/assets/quickstart/fast-forward.png";

/* ── Slide visual components ── */

const Slide1Visual = () => (
  <div className="relative w-60 h-60 flex items-center justify-center">
    {/* Two video feeds side by side */}
    <div className="flex gap-2 items-end animate-fade-in">
      <div className="relative">
        <div className="w-24 h-32 rounded-xl overflow-hidden border-2 border-emerald-400 shadow-lg shadow-emerald-400/30 animate-[pulse_3s_ease-in-out_infinite]">
          <img src={boySelfie} alt="Boy" className="w-full h-full object-cover" />
        </div>
        {/* Boy's chat bubble - top left */}
        <div className="absolute -top-10 -left-3" style={{ animation: "floatUp 3s ease-in-out 0s infinite" }}>
          <img src={topicBubble} alt="" className="w-12 h-10 object-contain" />
          <img src={giftEmoji} alt="" className="absolute top-1.5 left-2.5 w-5 h-5" />
        </div>
      </div>
      <div className="relative">
        <div className="w-24 h-32 rounded-xl overflow-hidden border-2 border-pink-400 shadow-lg shadow-pink-400/30 animate-[pulse_3s_ease-in-out_infinite_0.5s]">
          <img src={girlSelfie} alt="Girl" className="w-full h-full object-cover" />
        </div>
        {/* Girl's chat bubble - top right */}
        <div className="absolute -top-10 -right-3" style={{ animation: "floatUp 3s ease-in-out 1s infinite" }}>
          <img src={topicBubble} alt="" className="w-12 h-10 object-contain" />
          <img src={shoppingBags2} alt="" className="absolute top-1.5 left-2.5 w-5 h-5" />
        </div>
      </div>
    </div>
    {/* Floating money bag */}
    <img
      src={moneyBag}
      alt="Earn"
      className="absolute -bottom-1 right-1 w-11 h-11 animate-[bounce_2s_ease-in-out_infinite]"
    />
    {/* Connection line */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-emerald-400/20 animate-[ping_2s_ease-in-out_infinite]" />
  </div>
);

const Slide2Visual = () => (
  <div className="relative w-56 h-56 flex items-center justify-center">
    {/* Big stopwatch */}
    <img
      src={stopwatch}
      alt="Timer"
      className="w-28 h-28 animate-[pulse_2s_ease-in-out_infinite] drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
    />
    {/* Floating +5 badges */}
    {[
      { cls: "top-4 right-6", delay: "0s" },
      { cls: "top-10 left-4", delay: "1s" },
      { cls: "bottom-10 right-4", delay: "2s" },
    ].map((p, i) => (
      <span
        key={i}
        className={`absolute ${p.cls} bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg`}
        style={{
          animation: `floatUp 2.5s ease-in-out ${p.delay} infinite`,
        }}
      >
        +5 min
      </span>
    ))}
  </div>
);

const rewardImages = [
  { src: rewardHat, alt: "Hat" },
  { src: rewardBag, alt: "Bag" },
  { src: rewardBoots, alt: "Boots" },
  { src: rewardPhonecase, alt: "Phone Case" },
  { src: rewardRedbag, alt: "Red Bag" },
  { src: rewardHeartbag, alt: "Heart Bag" },
  { src: rewardShorts, alt: "Shorts" },
  { src: rewardJeans, alt: "Jeans" },
];

const Slide3Visual = () => (
  <div className="relative w-60 h-56 flex items-center justify-center">
    {/* Shopping bags center */}
    <img
      src={shoppingBags}
      alt="Shop"
      className="w-16 h-16 z-20 drop-shadow-lg animate-[bounce_3s_ease-in-out_infinite]"
    />
    {/* Orbiting reward images */}
    {rewardImages.map((r, i) => {
      const angle = (360 / rewardImages.length) * i;
      const radius = 90;
      const x = Math.cos((angle * Math.PI) / 180) * radius;
      const y = Math.sin((angle * Math.PI) / 180) * radius;
      return (
        <div
          key={i}
          className="absolute w-12 h-12 rounded-lg overflow-hidden border border-neutral-600 shadow-md z-10"
          style={{
            left: `calc(50% + ${x}px - 24px)`,
            top: `calc(50% + ${y}px - 24px)`,
            animation: `pulse 3s ease-in-out ${i * 0.3}s infinite`,
          }}
        >
          <img src={r.src} alt={r.alt} className="w-full h-full object-cover" />
        </div>
      );
    })}
    {/* PayPal logo */}
    <img
      src={paypalLogo}
      alt="PayPal"
      className="absolute -bottom-1 -right-1 w-9 h-9 z-20 rounded-md object-contain bg-white p-0.5"
      style={{ animation: `sparkle 2s ease-in-out 0.5s infinite` }}
    />
    {/* Sparkles */}
    {["top-0 right-4", "bottom-0 left-2", "top-6 left-0"].map((pos, i) => (
      <span
        key={i}
        className={`absolute ${pos} text-yellow-400 text-base z-30`}
        style={{ animation: `sparkle 1.5s ease-in-out ${i * 0.4}s infinite` }}
      >
        ✦
      </span>
    ))}
  </div>
);

const Slide4Visual = () => {
  const challengeItems = [
    { label: "Bestie Challenge", reward: "$50", cutout: null },
    { label: "Boyfriend Challenge", reward: "$35", cutout: boyfriendCutout },
    { label: "Marathon Talk", reward: "$20", cutout: null },
    { label: "Blue Eyes Hunt", reward: "$10", cutout: null },
  ];

  return (
    <div className="relative w-56 h-56 flex items-center justify-center">
      {/* Trophy center */}
      <img
        src={trophyIcon}
        alt="Trophy"
        className="w-20 h-20 z-20 drop-shadow-lg animate-[bounce_3s_ease-in-out_infinite]"
      />
      {/* Challenge cards orbiting */}
      {challengeItems.map((c, i) => {
        const angle = (360 / challengeItems.length) * i - 90;
        const radius = 85;
        const x = Math.cos((angle * Math.PI) / 180) * radius;
        const y = Math.sin((angle * Math.PI) / 180) * radius;
        return (
          <div
            key={i}
            className="absolute flex flex-col items-center gap-0.5 z-10"
            style={{
              left: `calc(50% + ${x}px - 32px)`,
              top: `calc(50% + ${y}px - 18px)`,
              animation: `pulse 3s ease-in-out ${i * 0.4}s infinite`,
            }}
          >
            <span className="bg-neutral-800 border border-neutral-600 text-white text-[8px] font-bold px-2 py-1 rounded-md whitespace-nowrap shadow-md">
              {c.label}
            </span>
            <span className="text-emerald-400 text-[10px] font-black">{c.reward}</span>
            {c.cutout && (
              <img
                src={c.cutout}
                alt=""
                className="absolute -top-10 -right-6 w-12 h-14 object-contain drop-shadow-lg rotate-6 z-30"
                style={{ animation: `float 3s ease-in-out ${i * 0.3}s infinite` }}
              />
            )}
          </div>
        );
      })}
      {/* Cash icon */}
      <img
        src={cashIcon}
        alt="Cash"
        className="absolute -bottom-1 -left-1 w-10 h-10 z-20"
        style={{ animation: "sparkle 2s ease-in-out 0.5s infinite" }}
      />
      {/* Sparkles */}
      {["top-0 left-6", "bottom-2 right-2", "top-4 right-0"].map((pos, i) => (
        <span
          key={i}
          className={`absolute ${pos} text-yellow-400 text-sm z-30`}
          style={{ animation: `sparkle 1.5s ease-in-out ${i * 0.3}s infinite` }}
        >
          ✦
        </span>
      ))}
    </div>
  );
};

const Slide5Visual = () => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f === 0 ? 1 : 0));
    }, 600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-56 h-56 flex items-center justify-center">
      {/* Girl wagging finger - frame animation */}
      <div className="w-40 h-40 rounded-xl overflow-hidden border-2 border-red-500/60 shadow-lg shadow-red-500/20">
        <img
          src={frame === 0 ? noFrame1 : noFrame2}
          alt="No"
          className="w-full h-full object-cover transition-opacity duration-150"
        />
      </div>
      {/* Fast forward icon bouncing */}
      <img
        src={fastForward}
        alt="Skip"
        className="absolute -top-1 -right-1 w-10 h-10 rounded-lg animate-[shake_0.8s_ease-in-out_infinite]"
      />
      {/* Red X marks */}
      <span className="absolute bottom-4 left-4 text-red-500 text-2xl font-black animate-[pulse_1.5s_ease-in-out_infinite]">
        ✕
      </span>
      <span className="absolute top-4 left-6 text-red-500 text-lg font-black animate-[pulse_1.5s_ease-in-out_infinite_0.5s]">
        ✕
      </span>
    </div>
  );
};

/* ── Slides data ── */

const slides = [
  {
    tag: "Welcome To C24 Club",
    title: "HOW IT WORKS",
    visual: <Slide1Visual />,
    step: "1. VIDEO CHAT\n& EARN REWARDS",
    description: null,
    footer: null,
  },
  {
    tag: "Chat With Strangers",
    title: "EARN MINUTES",
    visual: <Slide2Visual />,
    step: "2. STOCK-UP\nON MINUTES!",
    description: "⏱ 5 Minutes",
    footer: null,
  },
  {
    tag: "Convert Minutes 4",
    title: "1k+ REWARDS!",
    visual: <Slide3Visual />,
    step: "3. REDEEM For CLOTHES",
    description: "Giftcards, Cash, Accessories\n& More!",
    footer: null,
  },
  {
    tag: "Earn Even More",
    title: "WEEKLY CHALLENGES",
    visual: <Slide4Visual />,
    step: "4. COMPLETE CHALLENGES\n& EARN CASH!",
    description: "Up to $135+ in challenges\navailable every week!",
    footer: null,
  },
  {
    tag: "Minute Loss",
    title: "BEWARE!",
    visual: <Slide5Visual />,
    step: "5. QUICK SKIPS =\nLESS REWARDS",
    description: null,
    footer: null,
  },
  {
    tag: null,
    title: "WHY REWARDS?",
    visual: null,
    step: null,
    description:
      "An Omegle That Rewards It's Users Brings More Quality + The Guy To Girl Ratio is balanced because of incentives!\n\nWe want to minimize quick skip culture!",
    footer: null,
  },
];

interface QuickStartGuideProps {
  onDismiss: () => void;
}

const QuickStartGuide = ({ onDismiss }: QuickStartGuideProps) => {
  const [current, setCurrent] = useState(0);

  const goNext = () => {
    if (current < slides.length - 1) setCurrent(current + 1);
    else onDismiss();
  };

  const goPrev = () => {
    if (current > 0) setCurrent(current - 1);
  };

  const slide = slides[current];

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Inline keyframes */}
      <style>{`
        @keyframes floatUp {
          0%, 100% { opacity: 0; transform: translateY(8px) scale(0.8); }
          30%, 70% { opacity: 1; transform: translateY(-12px) scale(1); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0.2; transform: scale(0.6) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.2) rotate(180deg); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-3px) rotate(-5deg); }
          75% { transform: translateX(3px) rotate(5deg); }
        }
      `}</style>

      <div className="relative w-full max-w-[320px] bg-neutral-900 border border-neutral-700 rounded-2xl p-5 flex flex-col items-center min-h-[420px]">
        {/* Close */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-neutral-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tag */}
        {slide.tag && (
          <p className="text-neutral-400 text-xs font-bold tracking-wide mb-1">
            {slide.tag}
          </p>
        )}

        {/* Title */}
        <h2 className="font-black text-2xl tracking-wide text-white text-center mb-4">
          {slide.title}
        </h2>

        {/* Visual */}
        {slide.visual && <div className="mb-4">{slide.visual}</div>}

        {/* Step label */}
        {slide.step && (
          <p className="font-black text-base text-white text-center whitespace-pre-line leading-tight mb-2">
            {slide.step}
          </p>
        )}

        {/* Description */}
        {slide.description && (
          <p className="text-neutral-300 text-sm text-center whitespace-pre-line leading-relaxed mb-2 px-2">
            {slide.description}
          </p>
        )}

        {/* Footer link for last slide */}
        {slide.footer && (
          <p className="text-neutral-500 text-xs font-bold underline mt-2">
            {slide.footer}
          </p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Navigation */}
        <div className="flex items-center justify-between w-full mt-4">
          <button
            onClick={goPrev}
            className={`p-2 rounded-full transition-colors ${
              current === 0
                ? "opacity-0 pointer-events-none"
                : "bg-neutral-800 hover:bg-neutral-700 text-white"
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex gap-1.5">
            {slides.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === current ? "bg-white" : "bg-neutral-600"
                }`}
              />
            ))}
          </div>

          <button
            onClick={goNext}
            className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickStartGuide;
