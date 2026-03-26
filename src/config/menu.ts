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
  Activity,
  TrendingUp,
  BarChart3,
  Camera,
  MousePointerClick,
  Dices,
  Clock,
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
    key: "dm-monitor",
    icon: MessageSquare,
    title: "DM Monitor",
    submenu: [
      { key: "dm-conversations", label: "All Conversations", path: "/admin/dm-monitor" },
    ],
  },
  {
    key: "rewards",
    icon: Gift,
    title: "Rewards",
    submenu: [
      { key: "rewards", label: "All Rewards", path: "/admin/rewards" },
      { key: "reward-form", label: "Add New Reward", path: "/admin/rewards/new" },
      { key: "gift-cards", label: "Gift Cards", path: "/admin/gift-cards" },
    ],
  },
  {
    key: "member-rewards",
    icon: Award,
    title: "Member Rewards",
    submenu: [
      { key: "member-rewards", label: "All Member Rewards", path: "/admin/member-rewards" },
      { key: "gift-history", label: "Gift History", path: "/admin/gift-history" },
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
    key: "discover-review",
    icon: Camera,
    title: "Discover Images",
    submenu: [
      { key: "discover-review", label: "Review Images", path: "/admin/discover-review" },
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
    title: "Bans",
    submenu: [
      { key: "banned-users", label: "Banned Users", path: "/admin/banned-users" },
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
      { key: "challenge-issues", label: "Challenge Issues", path: "/admin/challenge-issues" },
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
    key: "jackpot-payouts",
    icon: Dices,
    title: "Jackpot / Wager",
    submenu: [
      { key: "wager-settings", label: "Wager Settings", path: "/admin/wager-settings" },
      { key: "jackpot-payouts", label: "Jackpot Payouts", path: "/admin/jackpot-payouts" },
    ],
  },
  {
    key: "referrals",
    icon: UserPlus,
    title: "Referrals",
    submenu: [
      { key: "referral-management", label: "Referral Management", path: "/admin/referrals" },
    ],
  },
  {
    key: "anchor-user-rewards",
    icon: Anchor,
    title: "Anchor User Rewards",
    submenu: [
      { key: "anchor-settings", label: "Anchor Settings", path: "/admin/anchor-rewards/cashouts" },
      { key: "anchor-user-queue", label: "Anchor Users Queue", path: "/admin/anchor-rewards/queue" },
      { key: "anchor-challenges", label: "Bonus Challenges", path: "/admin/anchor-rewards/challenges" },
    ],
  },
  {
    key: "emails",
    icon: Mail,
    title: "Emails",
    submenu: [
      { key: "email-templates", label: "Email Templates", path: "/admin/emails" },
      { key: "email-dashboard", label: "Email Analytics", path: "/admin/email-analytics" },
    ],
  },
  {
    key: "revenue",
    icon: TrendingUp,
    title: "Revenue",
    submenu: [
      { key: "revenue", label: "Revenue Dashboard", path: "/admin/revenue" },
    ],
  },
  {
    key: "user-analytics",
    icon: BarChart3,
    title: "User Analytics",
    submenu: [
      { key: "user-analytics", label: "Growth & Acquisition", path: "/admin/user-analytics" },
      { key: "tap-analytics", label: "Tap Me Analytics", path: "/admin/tap-analytics" },
    ],
  },
  {
    key: "system-health",
    icon: Activity,
    title: "System Health",
    submenu: [
      { key: "system-health", label: "Health Dashboard", path: "/admin/system-health" },
    ],
  },
  {
    key: "user-roles",
    icon: Shield,
    title: "User Roles",
    submenu: [
      { key: "user-roles", label: "Manage Roles", path: "/admin/user-roles" },
      { key: "mod-permissions", label: "Moderator Permissions", path: "/admin/moderator-permissions" },
    ],
  },
  {
    key: "call-windows",
    icon: Clock,
    title: "Call Windows",
    submenu: [
      { key: "call-windows", label: "Manage Schedule", path: "/admin/call-windows" },
    ],
  },
  {
    key: "blog",
    icon: BookOpen,
    title: "Blog",
    submenu: [
      { key: "blog", label: "All Posts", path: "/admin/blog" },
      { key: "blog-new", label: "New Post", path: "/admin/blog/new" },
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
      { key: "camera-unlock", label: "Camera Unlock", path: "/admin/camera-unlock" },
      { key: "wishlist-settings", label: "Wishlist Minutes", path: "/admin/wishlist-settings" },
    ],
  },
  {
    key: "logout",
    icon: LogOut,
    title: "Logout",
    path: "/logout",
  },
];
