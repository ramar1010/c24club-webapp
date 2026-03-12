import spinLegendaryIcon from "@/assets/vip/spin-legendary.png";
import secondSpinIcon from "@/assets/vip/2nd-spin.png";
import capIcon from "@/assets/vip/30min-cap.png";
import adPointsIcon from "@/assets/vip/ad-points.png";
import disablePromosIcon from "@/assets/vip/disable-promos.png";
import getGiftedIcon from "@/assets/vip/get-gifted.png";
import freeShippingIcon from "@/assets/vip/free-shipping.png";
import genderSelectIcon from "@/assets/vip/gender-select.png";
import chanceEnhancerIcon from "@/assets/vip/chance-enhancer.png";
import starEyesIcon from "@/assets/vip/star-eyes.png";

export interface VipFeature {
  label: string;
  icon?: string;
}

export const VIP_TIERS = {
  basic: {
    name: "Basic VIP",
    price: "$2.49",
    interval: "week",
    price_id: "price_1T9ygOA5n8uAZoY1tzoTfeMH",
    product_id: "prod_U8FATJpBAXNSXy",
    features: [
      { label: "Choose a Gender to Connect With", icon: genderSelectIcon },
      { label: "50 Ad Points Per Month", icon: adPointsIcon },
      { label: "Add Custom Topics", icon: starEyesIcon },
      { label: "Auto-Unfreeze Minutes", icon: spinLegendaryIcon },
      { label: "Promo Perks (links, CTA, gender targeting)", icon: adPointsIcon },
      { label: "No Minute Loss for Quick Skips", icon: capIcon },
    ] as VipFeature[],
  },
  premium: {
    name: "Premium VIP",
    price: "$9.99",
    interval: "month",
    price_id: "price_1T9yhEA5n8uAZoY1zwb5wVdp",
    product_id: "prod_U8FBD9R49k8Kvd",
    features: [
      { label: "Everything in Basic VIP", icon: starEyesIcon },
      { label: "400 Ad Points Per Month", icon: adPointsIcon },
      { label: "Free Shipping on Rewards", icon: freeShippingIcon },
      { label: "Get Gifted by Anyone", icon: getGiftedIcon },
      { label: "Pin Socials On Screen", icon: spinLegendaryIcon },
      { label: "Disable All Promos + Add Images", icon: disablePromosIcon },
      { label: "Spin Legendary Items", icon: spinLegendaryIcon },
      { label: "Increased Chance Enhancer", icon: chanceEnhancerIcon },
      { label: "2nd Spin Attempt on Legendary", icon: secondSpinIcon },
      { label: "5 Free Spins Per Month", icon: spinLegendaryIcon },
      { label: "30 Min Cap Per User (vs 10 min)", icon: capIcon },
      { label: "Create Promos with Full Features", icon: adPointsIcon },
    ] as VipFeature[],
  },
} as const;

export type VipTier = "basic" | "premium" | null;
