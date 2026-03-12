import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";

// Admin
import AdminLayout from "@/components/admin/AdminLayout";
import ProtectedAdminRoute from "@/components/admin/ProtectedAdminRoute";
import DashboardPage from "@/pages/admin/DashboardPage";
import MembersPage from "@/pages/admin/MembersPage";
import RewardsPage from "@/pages/admin/RewardsPage";
import AddRewardPage from "@/pages/admin/AddRewardPage";
import CategoriesPage from "@/pages/admin/CategoriesPage";
import AddCategoryPage from "@/pages/admin/AddCategoryPage";
import PromosPage from "@/pages/admin/PromosPage";
import PlaceholderPage from "@/pages/admin/PlaceholderPage";
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import ManageMinutesPage from "@/pages/admin/ManageMinutesPage";
import TopicsPage from "@/pages/admin/TopicsPage";
import MemberRewardsPage from "@/pages/admin/MemberRewardsPage";
import EditMemberRewardPage from "@/pages/admin/EditMemberRewardPage";
import FreezeSettingsPage from "@/pages/admin/FreezeSettingsPage";

// Public
import PublicLayout from "@/components/public/PublicLayout";
import HomePage from "@/pages/public/HomePage";
import VideoCallPage from "@/pages/public/VideoCallPage";
import RewardStorePage from "@/pages/public/RewardStorePage";
import ProfilePage from "@/pages/public/ProfilePage";
import MyRewardsPage from "@/pages/public/MyRewardsPage";
import SettingsPage from "@/pages/public/SettingsPage";
import EarnHistoryPage from "@/pages/public/EarnHistoryPage";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public site */}
            <Route path="/" element={<PublicLayout />}>
              <Route index element={<HomePage />} />
              <Route path="faq" element={<PlaceholderPage title="FAQ" />} />
              <Route path="rules" element={<PlaceholderPage title="Site Rules" />} />
              <Route path="terms" element={<PlaceholderPage title="Terms & Conditions" />} />
              <Route path="privacy" element={<PlaceholderPage title="Privacy Policy" />} />
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

            {/* Admin login */}
            <Route path="/admin/login" element={<AdminLoginPage />} />

            {/* Admin panel (protected) */}
            <Route path="/admin" element={<ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute>}>
              <Route index element={<DashboardPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="members/new" element={<PlaceholderPage title="Add New Member" />} />
              <Route path="rooms" element={<PlaceholderPage title="All Chat Rooms" />} />
              <Route path="rewards" element={<RewardsPage />} />
              <Route path="rewards/new" element={<AddRewardPage />} />
              <Route path="rewards/:id/edit" element={<AddRewardPage />} />
              <Route path="member-rewards" element={<MemberRewardsPage />} />
              <Route path="member-rewards/:id/edit" element={<EditMemberRewardPage />} />
              <Route path="promos" element={<PromosPage />} />
              <Route path="reported-users" element={<PlaceholderPage title="Reported Users" />} />
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
              <Route path="ban-by-ip" element={<PlaceholderPage title="Ban by IP" />} />
              <Route path="challenges" element={<PlaceholderPage title="All Challenges" />} />
              <Route path="challenges/new" element={<PlaceholderPage title="Add New Challenge" />} />
              <Route path="member-challenges" element={<PlaceholderPage title="Member Challenges" />} />
              <Route path="spin-to-win" element={<PlaceholderPage title="Manage Spin to Win" />} />
              <Route path="spin-to-win/winners" element={<PlaceholderPage title="Members Won (Spin to Win)" />} />
              <Route path="legendary-cashout" element={<PlaceholderPage title="Legendary Items Cashout" />} />
              <Route path="referrals/invitations" element={<PlaceholderPage title="Referral Invitations" />} />
              <Route path="referrals/cashouts" element={<PlaceholderPage title="Referral Cashouts" />} />
              <Route path="anchor-rewards/cashouts" element={<PlaceholderPage title="Idle Minutes - Cashouts" />} />
              <Route path="anchor-rewards/queue" element={<PlaceholderPage title="Anchor Users Queue" />} />
              <Route path="emails" element={<PlaceholderPage title="Email Queue" />} />
              <Route path="settings" element={<PlaceholderPage title="Manage Settings" />} />
              <Route path="manage-minutes" element={<ManageMinutesPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
