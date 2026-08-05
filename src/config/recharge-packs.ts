export interface RechargePack {
  key: "20" | "60" | "150";
  minutes: number;
  price: string;
  perMinute: string;
  badge?: string;
}

export const RECHARGE_PACKS: RechargePack[] = [
  { key: "20", minutes: 20, price: "$6.99", perMinute: "$0.35/min" },
  { key: "60", minutes: 60, price: "$17.99", perMinute: "$0.30/min", badge: "Most popular" },
  { key: "150", minutes: 150, price: "$34.99", perMinute: "$0.23/min", badge: "Best value" },
];
