export interface RechargePack {
  key: "10" | "30" | "60";
  minutes: number;
  price: string;
  perMinute: string;
  badge?: string;
}

export const RECHARGE_PACKS: RechargePack[] = [
  { key: "10", minutes: 10, price: "$6.99", perMinute: "$0.70/min" },
  { key: "30", minutes: 30, price: "$17.99", perMinute: "$0.60/min", badge: "Most popular" },
  { key: "60", minutes: 60, price: "$34.99", perMinute: "$0.58/min", badge: "Best value" },
];
