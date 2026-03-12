export const VIP_TIERS = {
  basic: {
    name: "Basic VIP",
    price: "$2.49",
    interval: "week",
    price_id: "price_1T9ygOA5n8uAZoY1tzoTfeMH",
    product_id: "prod_U8FATJpBAXNSXy",
    features: [
      "Choose a Gender to Connect With",
      "50 Ad Points Per Month",
      "Add Custom Topics",
      "Auto-Unfreeze Minutes",
      "Promo Perks (links, CTA, gender targeting)",
      "No Minute Loss for Quick Skips",
    ],
  },
  premium: {
    name: "Premium VIP",
    price: "$9.99",
    interval: "month",
    price_id: "price_1T9yhEA5n8uAZoY1zwb5wVdp",
    product_id: "prod_U8FBD9R49k8Kvd",
    features: [
      "Everything in Basic VIP",
      "400 Ad Points Per Month",
      "Free Shipping on Rewards",
      "Get Gifted by Anyone",
      "Pin Socials On Screen",
      "Disable All Promos + Add Images",
      "Spin Legendary Items",
      "Increased Chance Enhancer",
      "2nd Spin Attempt on Legendary",
      "5 Free Spins Per Month",
      "30 Min Cap Per User (vs 10 min)",
      "Create Promos with Full Features",
    ],
  },
} as const;

export type VipTier = "basic" | "premium" | null;
