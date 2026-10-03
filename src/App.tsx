import { lazy, Suspense } from "react";
import { lazyRetry } from "@/lib/lazyRetry";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { DirectCallInviteListenerWrapper } from "@/components/DirectCallInviteListenerWrapper";
import DmNotificationListener from "@/components/DmNotificationListener";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import HomePage from "@/pages/public/HomePage";
import VideoCallPage from "@/pages/public/VideoCallPage";

// Lightweight layout - keep eager
import PublicLayout from "@/components/public/PublicLayout";

// Lazy load ALL pages
const AdminLayout = lazyRetry(() => import("@/components/admin/AdminLayout"));
const ProtectedAdminRoute = lazyRetry(() => import("@/components/admin/ProtectedAdminRoute"));
const DashboardPage = lazyRetry(() => import("@/pages/admin/DashboardPage"));
const MembersPage = lazyRetry(() => import("@/pages/admin/MembersPage"));
const RewardsPage = lazyRetry(() => import("@/pages/admin/RewardsPage"));
const AddRewardPage = lazyRetry(() => import("@/pages/admin/AddRewardPage"));
const CategoriesPage = lazyRetry(() => import("@/pages/admin/CategoriesPage"));
const AddCategoryPage = lazyRetry(() => import("@/pages/admin/AddCategoryPage"));
const PromosPage = lazyRetry(() => import("@/pages/admin/PromosPage"));
const PlaceholderPage = lazyRetry(() => import("@/pages/admin/PlaceholderPage"));
const AdminLoginPage = lazyRetry(() => import("@/pages/admin/AdminLoginPage"));
const AdminResetPasswordPage = lazyRetry(() => import("@/pages/admin/AdminResetPasswordPage"));
const ManageMinutesPage = lazyRetry(() => import("@/pages/admin/ManageMinutesPage"));
const TopicsPage = lazyRetry(() => import("@/pages/admin/TopicsPage"));
const MemberRewardsPage = lazyRetry(() => import("@/pages/admin/MemberRewardsPage"));
const EditMemberRewardPage = lazyRetry(() => import("@/pages/admin/EditMemberRewardPage"));
const FreezeSettingsPage = lazyRetry(() => import("@/pages/admin/FreezeSettingsPage"));
const AdminChallengesPage = lazyRetry(() => import("@/pages/admin/AdminChallengesPage"));
const AdminMemberChallengesPage = lazyRetry(() => import("@/pages/admin/AdminMemberChallengesPage"));
const AdminChallengeIssuesPage = lazyRetry(() => import("@/pages/admin/AdminChallengeIssuesPage"));
const AdminSpinPrizesPage = lazyRetry(() => import("@/pages/admin/AdminSpinPrizesPage"));
const AdminSpinWinnersPage = lazyRetry(() => import("@/pages/admin/AdminSpinWinnersPage"));
const LegendaryCashoutPage = lazyRetry(() => import("@/pages/admin/LegendaryCashoutPage"));
const AdminEmailTemplatesPage = lazyRetry(() => import("@/pages/admin/AdminEmailTemplatesPage"));
const AdminEmailDashboardPage = lazyRetry(() => import("@/pages/admin/AdminEmailDashboardPage"));
const AdminGiftCardsPage = lazyRetry(() => import("@/pages/admin/AdminGiftCardsPage"));
const AdminRoomsPage = lazyRetry(() => import("@/pages/admin/AdminRoomsPage"));
const AnchorSettingsPage = lazyRetry(() => import("@/pages/admin/AnchorSettingsPage"));
const SystemHealthPage = lazyRetry(() => import("@/pages/admin/SystemHealthPage"));
const NotificationHealthPage = lazyRetry(() => import("@/pages/admin/NotificationHealthPage"));
const RevenuePage = lazyRetry(() => import("@/pages/admin/RevenuePage"));
const AdminBannedUsersPage = lazyRetry(() => import("@/pages/admin/AdminBannedUsersPage"));
const UserAnalyticsPage = lazyRetry(() => import("@/pages/admin/UserAnalyticsPage"));
const AdminDiscoverReviewPage = lazyRetry(() => import("@/pages/admin/AdminDiscoverReviewPage"));
const TapAnalyticsPage = lazyRetry(() => import("@/pages/admin/TapAnalyticsPage"));
const AdminNativeAppUsersPage = lazyRetry(() => import("@/pages/admin/AdminNativeAppUsersPage"));
const AdminDmMonitorPage = lazyRetry(() => import("@/pages/admin/AdminDmMonitorPage"));
const AdminAnnouncementsPage = lazyRetry(() => import("@/pages/admin/AdminAnnouncementsPage"));
const ReportedUsersPage = lazyRetry(() => import("@/pages/admin/ReportedUsersPage"));
const AdminUserRolesPage = lazyRetry(() => import("@/pages/admin/AdminUserRolesPage"));
const ModeratorPermissionsPage = lazyRetry(() => import("@/pages/admin/ModeratorPermissionsPage"));
const AdminGiftHistoryPage = lazyRetry(() => import("@/pages/admin/AdminGiftHistoryPage"));
const CameraUnlockSettingsPage = lazyRetry(() => import("@/pages/admin/CameraUnlockSettingsPage"));
const CameraUnlockSuccessPage = lazyRetry(() => import("@/pages/public/CameraUnlockSuccessPage"));
const AdminReferralsPage = lazyRetry(() => import("@/pages/admin/AdminReferralsPage"));
const AdminJackpotPayoutsPage = lazyRetry(() => import("@/pages/admin/AdminJackpotPayoutsPage"));
const AdminWagerSettingsPage = lazyRetry(() => import("@/pages/admin/AdminWagerSettingsPage"));
const AdminBlogPage = lazyRetry(() => import("@/pages/admin/AdminBlogPage"));
const AdminBlogEditorPage = lazyRetry(() => import("@/pages/admin/AdminBlogEditorPage"));
const WishlistSettingsPage = lazyRetry(() => import("@/pages/admin/WishlistSettingsPage"));
const AdminRedditTasksPage = lazyRetry(() => import("@/pages/admin/AdminRedditTasksPage"));
const AdminChecklistPage = lazyRetry(() => import("@/pages/admin/AdminChecklistPage"));
const AdminIapPurchasesPage = lazyRetry(() => import("@/pages/admin/AdminIapPurchasesPage"));
const VipPurchaseAnalyticsPage = lazyRetry(() => import("@/pages/admin/VipPurchaseAnalyticsPage"));

const RewardStorePage = lazyRetry(() => import("@/pages/public/RewardStorePage"));
const ProfilePage = lazyRetry(() => import("@/pages/public/ProfilePage"));
const MyRewardsPage = lazyRetry(() => import("@/pages/public/MyRewardsPage"));
const SettingsPage = lazyRetry(() => import("@/pages/public/SettingsPage"));
const ResetPasswordPage = lazyRetry(() => import("@/pages/public/ResetPasswordPage"));
const EarnHistoryPage = lazyRetry(() => import("@/pages/public/EarnHistoryPage"));
const RulesPage = lazyRetry(() => import("@/pages/public/RulesPage"));
const DiscoverPage = lazyRetry(() => import("@/pages/public/DiscoverPage"));
const MessagesPage = lazyRetry(() => import("@/pages/public/MessagesPage"));
const EarningsChatPage = lazyRetry(() => import("@/pages/public/EarningsChatPage"));
const HowToGuidePage = lazyRetry(() => import("@/pages/public/HowToGuidePage"));
const OpenAppPage = lazyRetry(() => import("@/pages/public/OpenAppPage"));
const EarnMoneyPage = lazyRetry(() => import("@/pages/public/EarnMoneyPage"));
const TermsPage = lazyRetry(() => import("@/pages/public/TermsPage"));
const PrivacyPolicyPage = lazyRetry(() => import("@/pages/public/PrivacyPolicyPage"));
const SafetyCenterPage = lazyRetry(() => import("@/pages/public/SafetyCenterPage"));
const ReferralPage = lazyRetry(() => import("@/pages/public/ReferralPage"));
const GiftSuccessPage = lazyRetry(() => import("@/pages/public/GiftSuccessPage"));
const RechargeSuccessPage = lazyRetry(() => import("@/pages/public/RechargeSuccessPage"));
const BlogPage = lazyRetry(() => import("@/pages/public/BlogPage"));
const BlogPostPage = lazyRetry(() => import("@/pages/public/BlogPostPage"));
const TopOmegleAlternativesPage = lazyRetry(() => import("@/pages/public/TopOmegleAlternativesPage"));
const VideoChatWithStrangersPage = lazyRetry(() => import("@/pages/public/seo/VideoChatWithStrangersPage"));
const RandomVideoChatPage = lazyRetry(() => import("@/pages/public/seo/RandomVideoChatPage"));
const TalkToStrangersPage = lazyRetry(() => import("@/pages/public/seo/TalkToStrangersPage"));
const FreeVideoChatNoSignUpPage = lazyRetry(() => import("@/pages/public/seo/FreeVideoChatNoSignUpPage"));
const CamChatPage = lazyRetry(() => import("@/pages/public/seo/CamChatPage"));
const OmeTvAlternativePage = lazyRetry(() => import("@/pages/public/seo/OmeTvAlternativePage"));
const MonkeyAppAlternativePage = lazyRetry(() => import("@/pages/public/seo/MonkeyAppAlternativePage"));
const CSAEPolicyPage = lazyRetry(() => import("@/pages/public/CSAEPolicyPage"));
const CallMePage = lazyRetry(() => import("@/pages/public/CallMePage"));
const ContactPage = lazyRetry(() => import("@/pages/public/ContactPage"));
const DeleteAccountPage = lazyRetry(() => import("@/pages/public/DeleteAccountPage"));
const WorkerRedditTaskPage = lazyRetry(() => import("@/pages/public/WorkerRedditTaskPage"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Avoid refetching on every remount / tab focus for rarely-changing data.
      // Hooks that need fresher data can override via their own staleTime.
      staleTime: 60_000, // 1 min
      gcTime: 5 * 60_000, // 5 min
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <DirectCallInviteListenerWrapper />
          <DmNotificationListener />
          <Suspense fallback={<div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center"><div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" /></div>}>
            <Routes>
              {/* Public site */}
              <Route path="/" element={<PublicLayout />}>
                <Route index element={<HomePage />} />
                <Route path="how-to-guide" element={<HowToGuidePage />} />
                <Route path="rules" element={<RulesPage />} />
                <Route path="terms" element={<TermsPage />} />
                <Route path="privacy" element={<PrivacyPolicyPage />} />
                <Route path="safety" element={<SafetyCenterPage />} />
                <Route path="blog" element={<BlogPage />} />
                <Route path="blog/:slug" element={<BlogPostPage />} />
                <Route path="omegle-alternative" element={<Navigate to="/top-omegle-alternatives" replace />} />
                <Route path="top-omegle-alternatives" element={<TopOmegleAlternativesPage />} />
                <Route path="video-chat-with-strangers" element={<VideoChatWithStrangersPage />} />
                <Route path="random-video-chat" element={<RandomVideoChatPage />} />
                <Route path="talk-to-strangers" element={<TalkToStrangersPage />} />
                <Route path="free-video-chat-no-sign-up" element={<FreeVideoChatNoSignUpPage />} />
                <Route path="cam-chat" element={<CamChatPage />} />
                <Route path="ome-tv-alternative" element={<OmeTvAlternativePage />} />
                <Route path="monkey-app-alternative" element={<MonkeyAppAlternativePage />} />
                <Route path="csae-policy" element={<CSAEPolicyPage />} />
                <Route path="contact" element={<ContactPage />} />
                <Route path="delete-account" element={<DeleteAccountPage />} />
              </Route>

              {/* Video call (full-screen, no public layout) */}
              <Route path="/videocall" element={<VideoCallPage />} />
              <Route path="/store" element={<RewardStorePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/my-rewards" element={<MyRewardsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/earn-history" element={<EarnHistoryPage />} />
              <Route path="/discover" element={<DiscoverPage />} />
              <Route path="/earnings-chat" element={<EarningsChatPage />} />
              <Route path="/referral" element={<ReferralPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/gift-success" element={<GiftSuccessPage />} />
              <Route path="/recharge-success" element={<RechargeSuccessPage />} />
              <Route path="/camera-unlock-success" element={<CameraUnlockSuccessPage />} />
              <Route path="/call/:slug" element={<CallMePage />} />
              <Route path="/open" element={<OpenAppPage />} />
              <Route path="/earn-money" element={<EarnMoneyPage />} />

              {/* Hidden worker portal (noindex) */}
              <Route path="/work/c24" element={<WorkerRedditTaskPage />} />

              {/* Admin login */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />

              {/* Admin panel (protected) */}
              <Route path="/admin" element={<Suspense fallback={<div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center"><div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" /></div>}><ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute></Suspense>}>
                <Route index element={<DashboardPage />} />
                <Route path="members" element={<MembersPage />} />
                <Route path="members/new" element={<PlaceholderPage title="Add New Member" />} />
                <Route path="rooms" element={<AdminRoomsPage />} />
                <Route path="rewards" element={<RewardsPage />} />
                <Route path="rewards/new" element={<AddRewardPage />} />
                <Route path="rewards/:id/edit" element={<AddRewardPage />} />
                <Route path="member-rewards" element={<MemberRewardsPage />} />
                <Route path="member-rewards/:id/edit" element={<EditMemberRewardPage />} />
                <Route path="gift-history" element={<AdminGiftHistoryPage />} />
                <Route path="promos" element={<PromosPage />} />
                <Route path="reported-users" element={<ReportedUsersPage />} />
                <Route path="discover-review" element={<AdminDiscoverReviewPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="categories/new" element={<AddCategoryPage />} />
                <Route path="categories/:id/edit" element={<AddCategoryPage />} />
                <Route path="topics" element={<TopicsPage />} />
                <Route path="reported-promos" element={<PlaceholderPage title="Reported Promos" />} />
                <Route path="banned-users" element={<AdminBannedUsersPage />} />
                <Route path="ban-by-ip" element={<PlaceholderPage title="Ban by IP" />} />
                <Route path="challenges" element={<AdminChallengesPage />} />
                <Route path="challenges/new" element={<AdminChallengesPage />} />
                <Route path="member-challenges" element={<AdminMemberChallengesPage />} />
                <Route path="challenge-issues" element={<AdminChallengeIssuesPage />} />
                <Route path="spin-to-win" element={<AdminSpinPrizesPage />} />
                <Route path="spin-to-win/winners" element={<AdminSpinWinnersPage />} />
                <Route path="legendary-cashout" element={<LegendaryCashoutPage />} />
                <Route path="jackpot-payouts" element={<AdminJackpotPayoutsPage />} />
                <Route path="wager-settings" element={<AdminWagerSettingsPage />} />
                <Route path="gift-cards" element={<AdminGiftCardsPage />} />
                <Route path="referrals" element={<AdminReferralsPage />} />
                <Route path="referrals/invitations" element={<AdminReferralsPage />} />
                <Route path="referrals/cashouts" element={<AdminReferralsPage />} />
                <Route path="anchor-rewards/cashouts" element={<AnchorSettingsPage />} />
                <Route path="anchor-rewards/queue" element={<AnchorSettingsPage />} />
                <Route path="emails" element={<AdminEmailTemplatesPage />} />
                <Route path="email-analytics" element={<AdminEmailDashboardPage />} />
                <Route path="settings" element={<PlaceholderPage title="Manage Settings" />} />
                <Route path="manage-minutes" element={<ManageMinutesPage />} />
                <Route path="freeze-settings" element={<FreezeSettingsPage />} />
                <Route path="system-health" element={<SystemHealthPage />} />
                <Route path="notification-health" element={<NotificationHealthPage />} />
                <Route path="revenue" element={<RevenuePage />} />
                <Route path="user-analytics" element={<UserAnalyticsPage />} />
                <Route path="tap-analytics" element={<TapAnalyticsPage />} />
                <Route path="native-app-users" element={<AdminNativeAppUsersPage />} />
                <Route path="dm-monitor" element={<AdminDmMonitorPage />} />
                <Route path="announcements" element={<AdminAnnouncementsPage />} />
                <Route path="user-roles" element={<AdminUserRolesPage />} />
                <Route path="moderator-permissions" element={<ModeratorPermissionsPage />} />
                <Route path="camera-unlock" element={<CameraUnlockSettingsPage />} />
                <Route path="wishlist-settings" element={<WishlistSettingsPage />} />
                <Route path="blog" element={<AdminBlogPage />} />
                <Route path="blog/new" element={<AdminBlogEditorPage />} />
                <Route path="blog/:id/edit" element={<AdminBlogEditorPage />} />
                <Route path="reddit-tasks" element={<AdminRedditTasksPage />} />
                <Route path="checklist" element={<AdminChecklistPage />} />
                <Route path="iap-purchases" element={<AdminIapPurchasesPage />} />
                <Route path="vip-purchases" element={<VipPurchaseAnalyticsPage />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <CookieConsentBanner />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
