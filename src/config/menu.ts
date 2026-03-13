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
      { key: "members", label: "All Members", path: "/admin/members" },
      { key: "member-form", label: "Add New Member", path: "/admin/members/new" },
    ],
  },
  {
    key: "chat-history",
    icon: Video,
    title: "Chat History",
    submenu: [
      { key: "rooms", label: "All Chat Rooms", path: "/admin/rooms" },
    ],
  },
  {
    key: "rewards",
    icon: Gift,
    title: "Rewards",
    submenu: [
      { key: "rewards", label: "All Rewards", path: "/admin/rewards" },
      { key: "reward-form", label: "Add New Reward", path: "/admin/rewards/new" },
    ],
  },
  {
    key: "member-rewards",
    icon: Award,
    title: "Member Rewards",
    submenu: [
      { key: "member-rewards", label: "All Member Rewards", path: "/admin/member-rewards" },
    ],
  },
  {
    key: "promos",
    icon: Tag,
    title: "Promos",
    submenu: [
      { key: "promos", label: "All Promos", path: "/admin/promos" },
    ],
  },
  {
    key: "reported-users",
    icon: Shield,
    title: "Reported Users",
    submenu: [
      { key: "reported-users", label: "Reported Users", path: "/admin/reported-users" },
    ],
  },
  {
    key: "categories",
    icon: FolderOpen,
    title: "Product Categories",
    submenu: [
      { key: "categories", label: "All Categories", path: "/admin/categories" },
      { key: "category-form", label: "Add New Category", path: "/admin/categories/new" },
    ],
  },
  {
    key: "topics",
    icon: BookOpen,
    title: "Topics",
    submenu: [
      { key: "topics", label: "All Topics", path: "/admin/topics" },
      { key: "topic-form", label: "Add New Topic", path: "/admin/topics/new" },
    ],
  },
  {
    key: "reported-promos",
    icon: Flag,
    title: "Reported Promos",
    submenu: [
      { key: "reported-promos", label: "Reported Promos", path: "/admin/reported-promos" },
    ],
  },
  {
    key: "rewards-pp",
    icon: ShoppingBag,
    title: "Product Point Rewards",
    submenu: [
      { key: "rewards-pp", label: "All PP Rewards", path: "/admin/rewards-pp" },
      { key: "reward-form-pp", label: "Add New PP Reward", path: "/admin/rewards-pp/new" },
      { key: "categories-pp", label: "All PP Categories", path: "/admin/categories-pp" },
      { key: "category-form-pp", label: "Add New PP Category", path: "/admin/categories-pp/new" },
    ],
  },
  {
    key: "contests",
    icon: Trophy,
    title: "Contests",
    submenu: [
      { key: "contests", label: "Contests", path: "/admin/contests" },
      { key: "contest-form", label: "Add New Contest", path: "/admin/contests/new" },
    ],
  },
  {
    key: "ban-ip",
    icon: Ban,
    title: "Ban by IP",
    submenu: [
      { key: "ban-member-by-ip", label: "Ban by IP", path: "/admin/ban-by-ip" },
    ],
  },
  {
    key: "challenges",
    icon: Swords,
    title: "Challenges",
    submenu: [
      { key: "challenges", label: "All Challenges", path: "/admin/challenges" },
      { key: "challenge-form", label: "Add New Challenge", path: "/admin/challenges/new" },
    ],
  },
  {
    key: "member-challenges",
    icon: ListChecks,
    title: "Member Challenges",
    submenu: [
      { key: "member-challenges", label: "Member Challenges", path: "/admin/member-challenges" },
    ],
  },
  {
    key: "spin-to-win",
    icon: Disc3,
    title: "Spin to Win",
    submenu: [
      { key: "spins-form", label: "Manage Spin to Win", path: "/admin/spin-to-win" },
      { key: "spins-member", label: "Members Won", path: "/admin/spin-to-win/winners" },
    ],
  },
  {
    key: "legendary-cashout",
    icon: Crown,
    title: "Legendary Items CashOut",
    submenu: [
      { key: "legendary-cashout", label: "Legendary Items Cashout", path: "/admin/legendary-cashout" },
    ],
  },
  {
    key: "referrals",
    icon: UserPlus,
    title: "Referrals",
    submenu: [
      { key: "referral-invitations", label: "Referral Invitations", path: "/admin/referrals/invitations" },
      { key: "referral-cashouts", label: "Referral Cashouts", path: "/admin/referrals/cashouts" },
    ],
  },
  {
    key: "anchor-user-rewards",
    icon: Anchor,
    title: "Anchor User Rewards",
    submenu: [
      { key: "idleminutes-cashouts", label: "Idle Minutes - Cashouts", path: "/admin/anchor-rewards/cashouts" },
      { key: "anchor-user-queue", label: "Anchor Users Queue", path: "/admin/anchor-rewards/queue" },
    ],
  },
  {
    key: "emails",
    icon: Mail,
    title: "Emails",
    submenu: [
      { key: "email-templates", label: "Email Templates", path: "/admin/emails" },
    ],
  },
  {
    key: "settings",
    icon: Settings,
    title: "Settings",
    submenu: [
      { key: "settings-form", label: "Manage Settings", path: "/admin/settings" },
      { key: "manage-minutes", label: "Manage Minutes", path: "/admin/manage-minutes" },
      { key: "freeze-settings", label: "Freeze Settings", path: "/admin/freeze-settings" },
    ],
  },
  {
    key: "logout",
    icon: LogOut,
    title: "Logout",
    path: "/logout",
  },
];
