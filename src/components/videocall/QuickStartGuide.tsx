import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import step1Gif from "@/assets/quickstart/step1.gif";
import step2Gif from "@/assets/quickstart/step2.gif";
import step3Gif from "@/assets/quickstart/step3.gif";
import step4Gif from "@/assets/quickstart/step4.gif";

const slides = [
  {
    tag: "Welcome To C24 Club",
    title: "HOW IT WORKS",
    gif: step1Gif,
    step: "1.VIDEO CHAT\n& EARN REWARDS",
    description: null,
  },
  {
    tag: "Chat With Strangers",
    title: "EARN MINUTES",
    gif: step2Gif,
    step: "2.STOCK-UP\nON MINUTES!",
    description: "⏱ 5 Minutes",
  },
  {
    tag: "Convert Minutes 4",
    title: "1k+ REWARDS!",
    gif: step3Gif,
    step: "3.REDEEM For CLOTHES",
    description: "Giftcards, Cash, Accessories\n& More!",
  },
  {
    tag: "Minute Loss",
    title: "BEWARE!",
    gif: step4Gif,
    step: "4.QUICK SKIPS =\nLESS REWARDS",
    description: null,
  },
  {
    tag: null,
    title: "WHY REWARDS?",
    gif: null,
    step: null,
    description:
      "An Omegle That Rewards It's Users Brings More Quality + The Guy To Girl Ratio is balanced because of incentives!\n\nWe want to minimize quick skip culture!",
    footer: "READ MORE FAQ",
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
    <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
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
          <p className="text-neutral-400 text-[11px] font-bold tracking-wide mb-1">
            {slide.tag}
          </p>
        )}

        {/* Title */}
        <h2 className="font-black text-xl tracking-wide text-white text-center mb-4">
          {slide.title}
        </h2>

        {/* GIF */}
        {slide.gif && (
          <div className="w-48 h-48 flex items-center justify-center mb-4">
            <img
              src={slide.gif}
              alt={slide.step || slide.title}
              className="max-w-full max-h-full object-contain rounded-xl"
            />
          </div>
        )}

        {/* Step label */}
        {slide.step && (
          <p className="font-black text-sm text-white text-center whitespace-pre-line leading-tight mb-2">
            {slide.step}
          </p>
        )}

        {/* Description */}
        {slide.description && (
          <p className="text-neutral-300 text-xs text-center whitespace-pre-line leading-relaxed mb-2 px-2">
            {slide.description}
          </p>
        )}

        {/* Footer link for last slide */}
        {(slide as any).footer && (
          <p className="text-neutral-500 text-[10px] font-bold underline mt-2">
            {(slide as any).footer}
          </p>
        )}

        {/* Spacer to push nav to bottom */}
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

          {/* Dots */}
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
