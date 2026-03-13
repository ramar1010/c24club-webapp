import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const sections = [
  {
    title: "🎥 Video Chatting & Earning Minutes",
    items: [
      {
        q: "How do I earn minutes?",
        a: "You earn minutes by video chatting with other users. For every 5 minutes you spend in a video call, you earn reward minutes. The longer you chat, the more you earn! Minutes are tracked automatically — just stay on the call.",
      },
      {
        q: "What are minutes used for?",
        a: "Minutes are the platform currency. You use them to redeem rewards in the store — including clothes, accessories, gift cards, cash payouts, and more. You can also use them to buy spins on the Spin to Win wheel.",
      },
      {
        q: "What happens if I skip too fast?",
        a: "Quick skipping reduces your earning potential. If you skip a call within seconds of connecting, you lose potential minutes. The system is designed to reward quality conversations, not rapid clicking. Stay and chat to maximize your rewards!",
      },
      {
        q: "Is there an earning cap?",
        a: "Yes — the earning cap is per user you connect with, not a daily total. Standard members can earn up to 10 minutes per partner per session. VIP members get a higher cap of 30 minutes per partner per session. Once you hit the cap with one person, you'll see a notification — just connect with someone new to keep earning! The cap resets each time you reconnect with the same partner.",
      },
    ],
  },
  {
    title: "🎁 Reward Store & Redeeming",
    items: [
      {
        q: "How do I redeem rewards?",
        a: "Go to the Reward Store from the video call page or your profile. Browse categories like clothes, accessories, gift cards, and cash. Select a reward, confirm the minutes cost, and submit. Some items require shipping info.",
      },
      {
        q: "What types of rewards are available?",
        a: "We offer 1,000+ rewards including: clothing (shirts, pants, hats, bags, boots), accessories (phone cases, jewelry), gift cards (PayPal, Cash App, etc.), and direct cash payouts. New items are added regularly.",
      },
      {
        q: "What are reward rarities?",
        a: "Rewards come in different rarities — Common, Rare, and Legendary. Common items like Spins and Ad Points are instant-redeem. Rare and Legendary items go through the Spin to Win mechanic where you spin a wheel to win them.",
      },
      {
        q: "How does shipping work?",
        a: "Physical rewards require a shipping address. After redeeming, you'll be asked to enter your shipping details. You can track your order status in the My Rewards section. Premium VIP members get free shipping on all products.",
      },
    ],
  },
  {
    title: "🎰 Spin to Win",
    items: [
      {
        q: "Are there different types of Spin to Win?",
        a: "Yes — there are two separate Spin to Win mechanics:\n\n1. **Reward Spin** — When you redeem a Rare or Legendary reward from the store, you enter a spin mechanic. The wheel contains your target reward plus filler items. If it lands on your prize, you win it! Your Chance Enhancer stat improves your odds.\n\n2. **Daily Spin (Events)** — In the Events section (accessible from your profile), there's a separate Spin to Win wheel. You get 1 free spin every day and can purchase additional spin tokens. This wheel has its own set of prizes like minutes, ad points, and other items.",
      },
      {
        q: "What is the Chance Enhancer?",
        a: "The Chance Enhancer is a stat that increases your probability of winning on the Reward Spin wheel (when redeeming Rare/Legendary items). It builds up as you use the platform. Higher Chance Enhancer = better odds of landing on the reward you want.",
      },
      {
        q: "Can I buy extra spins?",
        a: "For the Daily Spin in Events, you can purchase spin tokens ($0.99 for 1, $1.99 for 2, $2.50 for 3). Purchased spins don't count against your daily free spin. For the Reward Spin, if you're a Premium VIP member, you get one free re-spin when you lose on a Legendary item spin.",
      },
    ],
  },
  {
    title: "⭐ VIP Membership",
    items: [
      {
        q: "What are the VIP tiers?",
        a: "There are two tiers:\n• Basic VIP — $2.49/week: Access to gender filters, advanced promo features, 3 free Minute Unfreezes per month, and higher earning caps.\n• Premium VIP — $9.99/month: Everything in Basic plus 2x ad points, free shipping on all products, social media pinning, and a free re-spin on lost Legendary spins.",
      },
      {
        q: "What are gender filters?",
        a: "VIP members can filter who they match with by selecting 'GIRLS' or 'GUYS'. The system prioritizes your preference while falling back to universal matching if needed. This feature is exclusive to VIP members.",
      },
      {
        q: "What is Minute Unfreezing?",
        a: "If your account gets frozen (from hitting the earning cap), VIP members get 3 free unfreezes per month. Non-VIP users can purchase a one-time unfreeze. This lets you keep earning without waiting for the cap to reset.",
      },
    ],
  },
  {
    title: "📢 Ad Points & Promos",
    items: [
      {
        q: "What are Ad Points?",
        a: "Ad Points are earned automatically while video chatting — no ads to watch! You accumulate points as you chat. Premium VIP members earn 2x ad points. Ad Points can be redeemed as a reward type in the store.",
      },
      {
        q: "How do promos work?",
        a: "Users and brands can create promos that appear during video calls. VIP members have advanced promo controls including the ability to create their own promos and disable unwanted ads.",
      },
    ],
  },
  {
    title: "🎯 Weekly Challenges",
    items: [
      {
        q: "What are Weekly Challenges?",
        a: "Weekly Challenges are special tasks you can complete to earn bonus rewards. Check the Challenges section from your profile to see active challenges. Submit proof of completion and earn extra minutes or special prizes once approved.",
      },
    ],
  },
  {
    title: "💝 Gifting Minutes",
    items: [
      {
        q: "How do I gift minutes?",
        a: "During a video call with a VIP partner, you can send them minutes as a gift. There are two tiers: 100 minutes for $1.99 or 400 minutes for $4.99. If you send the 400-minute tier, you get a 100-minute bonus yourself!",
      },
      {
        q: "Can I see gifts I've received?",
        a: "Yes! VIP users can view their received gifts — including who sent them, the amount, and the date — in the Gift History section on the My Rewards page.",
      },
    ],
  },
  {
    title: "📌 Topics & Socials",
    items: [
      {
        q: "What are pinned topics?",
        a: "You can pin topics that interest you to help match with people who share similar interests. Browse available topic categories and pin the ones you like. This helps create better, more engaging conversations.",
      },
      {
        q: "How do I pin my socials?",
        a: "Premium VIP members can pin their social media handles (Instagram, Snapchat, TikTok, etc.) to their video call profile. This lets your chat partner see and follow your socials during the call.",
      },
    ],
  },
  {
    title: "⚠️ Safety & Rules",
    items: [
      {
        q: "What gets you banned?",
        a: "Violations include: showing inappropriate content (NSFW detection is active), harassment, spam, and abuse. Bans can be temporary or permanent. Some bans can be appealed with a one-time unban payment.",
      },
      {
        q: "How do I report someone?",
        a: "During a video call, tap the report icon to flag the other user. Select a reason and add details. Reports are reviewed by the moderation team. Keeping the community safe is everyone's responsibility!",
      },
    ],
  },
];

const HowToGuidePage = ({ onClose }: { onClose?: () => void }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-neutral-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => (onClose ? onClose() : navigate(-1))}
          className="p-1 hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="font-black text-lg tracking-wide">HOW TO GUIDE</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 pb-20">
        <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
          Everything you need to know about C24 Club — from earning minutes to redeeming rewards and beyond.
        </p>

        <Accordion type="multiple" className="space-y-3">
          {sections.map((section, si) => (
            <div key={si} className="space-y-2">
              <h2 className="font-black text-base tracking-wide mt-4 mb-2">
                {section.title}
              </h2>
              {section.items.map((item, qi) => (
                <AccordionItem
                  key={`${si}-${qi}`}
                  value={`${si}-${qi}`}
                  className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-900/50"
                >
                  <AccordionTrigger className="px-4 py-3 text-sm font-semibold text-left hover:no-underline hover:bg-neutral-800/50 transition-colors">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 text-neutral-300 text-sm leading-relaxed whitespace-pre-line">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </div>
          ))}
        </Accordion>
      </div>
    </div>
  );
};

export default HowToGuidePage;
