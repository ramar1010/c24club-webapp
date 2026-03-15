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
import createPromosIcon from "@/assets/vip/create-promos.png";
import frozenFaceIcon from "@/assets/vip/frozen-face.png";
import customTopicsIcon from "@/assets/vip/custom-topics.png";
import pinSocialsIcon from "@/assets/vip/pin-socials.png";
import diamondIcon from "@/assets/vip/diamond.png";
import stopwatchIcon from "@/assets/vip/stopwatch.png";
import slotMachineIcon from "@/assets/profile/slot-machine.png";

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
      { label: "Add Custom Topics", icon: customTopicsIcon },
      { label: "50 Ad Points a Week", icon: starEyesIcon },
      { label: "Auto-Unfreeze Minutes", icon: frozenFaceIcon },
    ] as VipFeature[],
  },
  premium: {
    name: "Premium VIP",
    price: "$9.99",
    interval: "month",
    price_id: "price_1T9yhEA5n8uAZoY1zwb5wVdp",
    product_id: "prod_U8FBD9R49k8Kvd",
    features: [
      { label: "Choose a Gender to Connect With", icon: genderSelectIcon },
      { label: "Get Gifted by Anyone", icon: getGiftedIcon },
      { label: "400 Ad Points Every Month", icon: starEyesIcon },
      { label: "Disable All Promos + Add Images", icon: disablePromosIcon },
      { label: "Pin Socials On Screen", icon: pinSocialsIcon },
      { label: "Spin Legendary Items (CASH VALUE)", icon: diamondIcon },
      { label: "Increase Chances to Win Legendary Items", icon: chanceEnhancerIcon },
      { label: "Get More Minutes Per User", icon: capIcon },
      { label: "Free Shipping 1 Month", icon: freeShippingIcon },
      { label: "2nd Spin Attempt on Legendary Items", icon: secondSpinIcon },
      { label: "Promo Perks", icon: adPointsIcon },
      { label: "Add Custom Topics", icon: customTopicsIcon },
      { label: "2x Ad Points", icon: spinLegendaryIcon },
      { label: "5 Free Spins Per Month", icon: slotMachineIcon },
      { label: "One Time 2x on Minutes Per Month!", icon: stopwatchIcon },
      { label: "Create Promos", icon: createPromosIcon },
      { label: "No Minute Loss for Quick Skips", icon: chanceEnhancerIcon },
    ] as VipFeature[],
  },
} as const;

export type VipTier = "basic" | "premium" | null;
