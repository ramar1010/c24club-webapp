import {
  Users,
  Video,
  Gift,
  Target,
  Award,
  Tag,
  MessageSquare,
  Shield,
  FolderOpen,
  BookOpen,
  Flag,
  ShoppingBag,
  Trophy,
  Ban,
  Swords,
  ListChecks,
  Disc3,
  Crown,
  UserPlus,
  Anchor,
  Mail,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";

export interface SubMenuItem {
  key: string;
  label: string;
  path: string;
}

export interface MenuItem {
  key: string;
  icon: LucideIcon;
  title: string;
  submenu?: SubMenuItem[];
  path?: string;
}

export const adminMenu: MenuItem[] = [
  {
    key: "members",
    icon: Users,
    title: "Members",
    submenu: [
      { key: "members", label: "All Members", path: "/members" },
      { key: "member-form", label: "Add New Member", path: "/members/new" },
    ],
  },
  {
    key: "chat-history",
    icon: Video,
    title: "Chat History",
    submenu: [
      { key: "rooms", label: "All Chat Rooms", path: "/rooms" },
    ],
  },
  {
    key: "rewards",
    icon: Gift,
    title: "Rewards",
    submenu: [
      { key: "rewards", label: "All Rewards", path: "/rewards" },
      { key: "reward-form", label: "Add New Reward", path: "/rewards/new" },
    ],
  },
  {
    key: "milestones",
    icon: Target,
    title: "Milestones",
    submenu: [
      { key: "milestones", label: "All Milestones", path: "/milestones" },
      { key: "milestone-form", label: "Add New Milestone", path: "/milestones/new" },
    ],
  },
  {
    key: "member-rewards",
    icon: Award,
    title: "Member Rewards",
    submenu: [
      { key: "member-rewards", label: "All Member Rewards", path: "/member-rewards" },
    ],
  },
  {
    key: "promos",
    icon: Tag,
    title: "Promos",
    submenu: [
      { key: "promos", label: "All Promos", path: "/promos" },
    ],
  },
  {
    key: "reported-users",
    icon: Shield,
    title: "Reported Users",
    submenu: [
      { key: "reported-users", label: "Reported Users", path: "/reported-users" },
    ],
  },
  {
    key: "categories",
    icon: FolderOpen,
    title: "Product Categories",
    submenu: [
      { key: "categories", label: "All Categories", path: "/categories" },
      { key: "category-form", label: "Add New Category", path: "/categories/new" },
    ],
  },
  {
    key: "topics",
    icon: BookOpen,
    title: "Topics",
    submenu: [
      { key: "topics", label: "All Topics", path: "/topics" },
      { key: "topic-form", label: "Add New Topic", path: "/topics/new" },
    ],
  },
  {
    key: "reported-promos",
    icon: Flag,
    title: "Reported Promos",
    submenu: [
      { key: "reported-promos", label: "Reported Promos", path: "/reported-promos" },
    ],
  },
  {
    key: "rewards-pp",
    icon: ShoppingBag,
    title: "Product Point Rewards",
    submenu: [
      { key: "rewards-pp", label: "All PP Rewards", path: "/rewards-pp" },
      { key: "reward-form-pp", label: "Add New PP Reward", path: "/rewards-pp/new" },
      { key: "categories-pp", label: "All PP Categories", path: "/categories-pp" },
      { key: "category-form-pp", label: "Add New PP Category", path: "/categories-pp/new" },
    ],
  },
  {
    key: "contests",
    icon: Trophy,
    title: "Contests",
    submenu: [
      { key: "contests", label: "Contests", path: "/contests" },
      { key: "contest-form", label: "Add New Contest", path: "/contests/new" },
    ],
  },
  {
    key: "ban-ip",
    icon: Ban,
    title: "Ban by IP",
    submenu: [
      { key: "ban-member-by-ip", label: "Ban by IP", path: "/ban-by-ip" },
    ],
  },
  {
    key: "challenges",
    icon: Swords,
    title: "Challenges",
    submenu: [
      { key: "challenges", label: "All Challenges", path: "/challenges" },
      { key: "challenge-form", label: "Add New Challenge", path: "/challenges/new" },
    ],
  },
  {
    key: "member-challenges",
    icon: ListChecks,
    title: "Member Challenges",
    submenu: [
      { key: "member-challenges", label: "Member Challenges", path: "/member-challenges" },
    ],
  },
  {
    key: "spin-to-win",
    icon: Disc3,
    title: "Spin to Win",
    submenu: [
      { key: "spins-form", label: "Manage Spin to Win", path: "/spin-to-win" },
      { key: "spins-member", label: "Members Won", path: "/spin-to-win/winners" },
    ],
  },
  {
    key: "legendary-cashout",
    icon: Crown,
    title: "Legendary Items CashOut",
    submenu: [
      { key: "legendary-cashout", label: "Legendary Items Cashout", path: "/legendary-cashout" },
    ],
  },
  {
    key: "referrals",
    icon: UserPlus,
    title: "Referrals",
    submenu: [
      { key: "referral-invitations", label: "Referral Invitations", path: "/referrals/invitations" },
      { key: "referral-cashouts", label: "Referral Cashouts", path: "/referrals/cashouts" },
    ],
  },
  {
    key: "anchor-user-rewards",
    icon: Anchor,
    title: "Anchor User Rewards",
    submenu: [
      { key: "idleminutes-cashouts", label: "Idle Minutes - Cashouts", path: "/anchor-rewards/cashouts" },
      { key: "anchor-user-queue", label: "Anchor Users Queue", path: "/anchor-rewards/queue" },
    ],
  },
  {
    key: "emails",
    icon: Mail,
    title: "Emails",
    submenu: [
      { key: "emails", label: "Email Queue", path: "/emails" },
    ],
  },
  {
    key: "settings",
    icon: Settings,
    title: "Settings",
    submenu: [
      { key: "settings-form", label: "Manage Settings", path: "/settings" },
    ],
  },
  {
    key: "logout",
    icon: LogOut,
    title: "Logout",
    path: "/logout",
  },
];
