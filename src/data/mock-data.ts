export interface Member {
  id: number;
  image: string;
  image_thumb: string;
  name: string;
  title: string;
  email: string;
  country: string;
  city: string;
  state: string;
  zip: string;
  profession: string;
  stats: string;
  birthdate: string;
  gender: string;
  membership: string;
}

export interface Reward {
  id: number;
  title: string;
  type: string;
  info: string;
}

export interface Promo {
  id: number;
  image_thumb: string;
  title: string;
  description: string;
  url: string;
  member_id: number;
  gender: string;
  country: string;
  interest: string;
  sameuser: string;
  ad_points_balance: string;
  promo_type: string;
  status: string;
}

// --- Mock data generators ---

const firstNames = ["Alex", "Jordan", "Taylor", "Casey", "Morgan", "Riley", "Quinn", "Avery", "Jamie", "Drew", "Skyler", "Cameron", "Dakota", "Hayden", "Reese", "Finley", "Emerson", "Rowan", "Blake", "Charlie"];
const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Wilson", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Moore", "Young"];
const countries = ["United States", "United Kingdom", "Canada", "Australia", "India", "Germany", "France", "Brazil", "Japan", "Mexico"];
const cities = ["New York", "London", "Toronto", "Sydney", "Mumbai", "Berlin", "Paris", "São Paulo", "Tokyo", "Mexico City"];
const states = ["NY", "CA", "TX", "FL", "ON", "NSW", "MH", "BE", "IDF", "SP"];
const genders = ["Male", "Female", "Other"];
const memberships = ["Free", "Premium", "Gold", "Platinum"];
const professions = ["Engineer", "Designer", "Teacher", "Doctor", "Artist", "Developer", "Manager", "Writer", "Analyst", "Consultant"];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateMembers(count: number): Member[] {
  return Array.from({ length: count }, (_, i) => {
    const first = rand(firstNames);
    const last = rand(lastNames);
    return {
      id: i + 1,
      image: "",
      image_thumb: "",
      name: `${first} ${last}`,
      title: Math.random() > 0.5 ? "Mr." : "Ms.",
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      country: rand(countries),
      city: rand(cities),
      state: rand(states),
      zip: String(10000 + Math.floor(Math.random() * 89999)),
      profession: rand(professions),
      stats: `${Math.floor(Math.random() * 500)} pts`,
      birthdate: `${1970 + Math.floor(Math.random() * 35)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, "0")}`,
      gender: rand(genders),
      membership: rand(memberships),
    };
  });
}

const rewardTypes = ["Badge", "Trophy", "Certificate", "Points Bonus", "Gift Card"];

export function generateRewards(count: number): Reward[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Reward ${i + 1} - ${rand(["Gold Star", "Silver Medal", "Bronze Trophy", "Diamond Badge", "Platinum Certificate", "Emerald Pin", "Ruby Award", "Sapphire Shield"])}`,
    type: rand(rewardTypes),
    info: `${Math.floor(Math.random() * 1000)} points required • ${Math.floor(Math.random() * 200)} claimed`,
  }));
}

const promoTypes = ["Banner", "Video", "Text", "Popup", "Native"];
const promoStatuses = ["Active", "Paused", "Expired", "Pending", "Rejected"];
const interests = ["Sports", "Technology", "Music", "Travel", "Food", "Fashion", "Gaming", "Health", "Finance", "Education"];

export function generatePromos(count: number): Promo[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    image_thumb: "",
    title: `Promo Campaign ${i + 1}`,
    description: `Description for promo ${i + 1} — ${rand(["Limited time offer", "Exclusive deal", "Special promotion", "Flash sale", "Weekly special"])}`,
    url: `https://example.com/promo/${i + 1}`,
    member_id: Math.floor(Math.random() * 100) + 1,
    gender: rand(genders),
    country: rand(countries),
    interest: rand(interests),
    sameuser: Math.random() > 0.5 ? "Yes" : "No",
    ad_points_balance: `${Math.floor(Math.random() * 5000)} / ${Math.floor(Math.random() * 2000)}`,
    promo_type: rand(promoTypes),
    status: rand(promoStatuses),
  }));
}
