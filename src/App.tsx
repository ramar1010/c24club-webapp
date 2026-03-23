import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { DirectCallInviteListenerWrapper } from "@/components/DirectCallInviteListenerWrapper";
import DmNotificationListener from "@/components/DmNotificationListener";
import CookieConsentBanner from "@/components/CookieConsentBanner";

// Lightweight layout - keep eager
import PublicLayout from "@/components/public/PublicLayout";

// Lazy load ALL pages
const AdminLayout = lazy(() => import("@/components/admin/AdminLayout"));
const ProtectedAdminRoute = lazy(() => import("@/components/admin/ProtectedAdminRoute"));
const DashboardPage = lazy(() => import("@/pages/admin/DashboardPage"));
const MembersPage = lazy(() => import("@/pages/admin/MembersPage"));
const RewardsPage = lazy(() => import("@/pages/admin/RewardsPage"));
const AddRewardPage = lazy(() => import("@/pages/admin/AddRewardPage"));
const CategoriesPage = lazy(() => import("@/pages/admin/CategoriesPage"));
const AddCategoryPage = lazy(() => import("@/pages/admin/AddCategoryPage"));
const PromosPage = lazy(() => import("@/pages/admin/PromosPage"));
const PlaceholderPage = lazy(() => import("@/pages/admin/PlaceholderPage"));
const AdminLoginPage = lazy(() => import("@/pages/admin/AdminLoginPage"));
const AdminResetPasswordPage = lazy(() => import("@/pages/admin/AdminResetPasswordPage"));
const ManageMinutesPage = lazy(() => import("@/pages/admin/ManageMinutesPage"));
const TopicsPage = lazy(() => import("@/pages/admin/TopicsPage"));
const MemberRewardsPage = lazy(() => import("@/pages/admin/MemberRewardsPage"));
const EditMemberRewardPage = lazy(() => import("@/pages/admin/EditMemberRewardPage"));
const FreezeSettingsPage = lazy(() => import("@/pages/admin/FreezeSettingsPage"));
const AdminChallengesPage = lazy(() => import("@/pages/admin/AdminChallengesPage"));
const AdminMemberChallengesPage = lazy(() => import("@/pages/admin/AdminMemberChallengesPage"));
const AdminChallengeIssuesPage = lazy(() => import("@/pages/admin/AdminChallengeIssuesPage"));
const AdminSpinPrizesPage = lazy(() => import("@/pages/admin/AdminSpinPrizesPage"));
const AdminSpinWinnersPage = lazy(() => import("@/pages/admin/AdminSpinWinnersPage"));
const LegendaryCashoutPage = lazy(() => import("@/pages/admin/LegendaryCashoutPage"));
const AdminEmailTemplatesPage = lazy(() => import("@/pages/admin/AdminEmailTemplatesPage"));
const AdminEmailDashboardPage = lazy(() => import("@/pages/admin/AdminEmailDashboardPage"));
const AdminGiftCardsPage = lazy(() => import("@/pages/admin/AdminGiftCardsPage"));
const AdminRoomsPage = lazy(() => import("@/pages/admin/AdminRoomsPage"));
const AnchorSettingsPage = lazy(() => import("@/pages/admin/AnchorSettingsPage"));
const AdminAnchorChallengesPage = lazy(() => import("@/pages/admin/AdminAnchorChallengesPage"));
const SystemHealthPage = lazy(() => import("@/pages/admin/SystemHealthPage"));
const RevenuePage = lazy(() => import("@/pages/admin/RevenuePage"));
const AdminBannedUsersPage = lazy(() => import("@/pages/admin/AdminBannedUsersPage"));
const UserAnalyticsPage = lazy(() => import("@/pages/admin/UserAnalyticsPage"));
const AdminDiscoverReviewPage = lazy(() => import("@/pages/admin/AdminDiscoverReviewPage"));
const TapAnalyticsPage = lazy(() => import("@/pages/admin/TapAnalyticsPage"));
const AdminDmMonitorPage = lazy(() => import("@/pages/admin/AdminDmMonitorPage"));
const ReportedUsersPage = lazy(() => import("@/pages/admin/ReportedUsersPage"));
const AdminUserRolesPage = lazy(() => import("@/pages/admin/AdminUserRolesPage"));
const ModeratorPermissionsPage = lazy(() => import("@/pages/admin/ModeratorPermissionsPage"));
const AdminGiftHistoryPage = lazy(() => import("@/pages/admin/AdminGiftHistoryPage"));
const CameraUnlockSettingsPage = lazy(() => import("@/pages/admin/CameraUnlockSettingsPage"));
const CameraUnlockSuccessPage = lazy(() => import("@/pages/public/CameraUnlockSuccessPage"));
const AdminReferralsPage = lazy(() => import("@/pages/admin/AdminReferralsPage"));
const AdminJackpotPayoutsPage = lazy(() => import("@/pages/admin/AdminJackpotPayoutsPage"));
const AdminWagerSettingsPage = lazy(() => import("@/pages/admin/AdminWagerSettingsPage"));
const AdminCallWindowsPage = lazy(() => import("@/pages/admin/AdminCallWindowsPage"));

const HomePage = lazy(() => import("@/pages/public/HomePage"));
const VideoCallPage = lazy(() => import("@/pages/public/VideoCallPage"));
const RewardStorePage = lazy(() => import("@/pages/public/RewardStorePage"));
const ProfilePage = lazy(() => import("@/pages/public/ProfilePage"));
const MyRewardsPage = lazy(() => import("@/pages/public/MyRewardsPage"));
const SettingsPage = lazy(() => import("@/pages/public/SettingsPage"));
const EarnHistoryPage = lazy(() => import("@/pages/public/EarnHistoryPage"));
const RulesPage = lazy(() => import("@/pages/public/RulesPage"));
const DiscoverPage = lazy(() => import("@/pages/public/DiscoverPage"));
const MessagesPage = lazy(() => import("@/pages/public/MessagesPage"));
const HowToGuidePage = lazy(() => import("@/pages/public/HowToGuidePage"));
const TermsPage = lazy(() => import("@/pages/public/TermsPage"));
const PrivacyPolicyPage = lazy(() => import("@/pages/public/PrivacyPolicyPage"));
const ReferralPage = lazy(() => import("@/pages/public/ReferralPage"));
const GiftSuccessPage = lazy(() => import("@/pages/public/GiftSuccessPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

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
                <Route path="safety" element={<PlaceholderPage title="Safety Center" />} />
                <Route path="blog" element={<PlaceholderPage title="Blog" />} />
              </Route>

              {/* Video call (full-screen, no public layout) */}
              <Route path="/videocall" element={<VideoCallPage />} />
              <Route path="/store" element={<RewardStorePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/my-rewards" element={<MyRewardsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/earn-history" element={<EarnHistoryPage />} />
              <Route path="/discover" element={<DiscoverPage />} />
              <Route path="/referral" element={<ReferralPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/gift-success" element={<GiftSuccessPage />} />
              <Route path="/camera-unlock-success" element={<CameraUnlockSuccessPage />} />

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
                <Route path="rewards-pp" element={<PlaceholderPage title="Product Point Rewards" />} />
                <Route path="rewards-pp/new" element={<PlaceholderPage title="Add New PP Reward" />} />
                <Route path="categories-pp" element={<PlaceholderPage title="PP Categories" />} />
                <Route path="categories-pp/new" element={<PlaceholderPage title="Add New PP Category" />} />
                <Route path="contests" element={<PlaceholderPage title="Contests" />} />
                <Route path="contests/new" element={<PlaceholderPage title="Add New Contest" />} />
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
                <Route path="anchor-rewards/challenges" element={<AdminAnchorChallengesPage />} />
                <Route path="emails" element={<AdminEmailTemplatesPage />} />
                <Route path="email-analytics" element={<AdminEmailDashboardPage />} />
                <Route path="settings" element={<PlaceholderPage title="Manage Settings" />} />
                <Route path="manage-minutes" element={<ManageMinutesPage />} />
                <Route path="freeze-settings" element={<FreezeSettingsPage />} />
                <Route path="system-health" element={<SystemHealthPage />} />
                <Route path="revenue" element={<RevenuePage />} />
                <Route path="user-analytics" element={<UserAnalyticsPage />} />
                <Route path="tap-analytics" element={<TapAnalyticsPage />} />
                <Route path="dm-monitor" element={<AdminDmMonitorPage />} />
                <Route path="user-roles" element={<AdminUserRolesPage />} />
                <Route path="moderator-permissions" element={<ModeratorPermissionsPage />} />
                <Route path="camera-unlock" element={<CameraUnlockSettingsPage />} />
                <Route path="call-windows" element={<AdminCallWindowsPage />} />
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
