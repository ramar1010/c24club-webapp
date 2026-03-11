import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AdminLayout from "@/components/admin/AdminLayout";
import DashboardPage from "@/pages/admin/DashboardPage";
import MembersPage from "@/pages/admin/MembersPage";
import RewardsPage from "@/pages/admin/RewardsPage";
import PromosPage from "@/pages/admin/PromosPage";
import PlaceholderPage from "@/pages/admin/PlaceholderPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />

            {/* Members */}
            <Route path="members" element={<MembersPage />} />
            <Route path="members/new" element={<PlaceholderPage title="Add New Member" description="Create a new member record." />} />

            {/* Chat History */}
            <Route path="rooms" element={<PlaceholderPage title="All Chat Rooms" description="View chat room history." />} />

            {/* Rewards */}
            <Route path="rewards" element={<PlaceholderPage title="All Rewards" description="Manage rewards catalog." />} />
            <Route path="rewards/new" element={<PlaceholderPage title="Add New Reward" />} />

            {/* Milestones */}
            <Route path="milestones" element={<PlaceholderPage title="All Milestones" />} />
            <Route path="milestones/new" element={<PlaceholderPage title="Add New Milestone" />} />

            {/* Member Rewards */}
            <Route path="member-rewards" element={<PlaceholderPage title="All Member Rewards" />} />

            {/* Promos */}
            <Route path="promos" element={<PlaceholderPage title="All Promos" />} />

            {/* Reported Users */}
            <Route path="reported-users" element={<PlaceholderPage title="Reported Users" />} />

            {/* Product Categories */}
            <Route path="categories" element={<PlaceholderPage title="All Categories" />} />
            <Route path="categories/new" element={<PlaceholderPage title="Add New Category" />} />

            {/* Topics */}
            <Route path="topics" element={<PlaceholderPage title="All Topics" />} />
            <Route path="topics/new" element={<PlaceholderPage title="Add New Topic" />} />

            {/* Reported Promos */}
            <Route path="reported-promos" element={<PlaceholderPage title="Reported Promos" />} />

            {/* Product Point Rewards */}
            <Route path="rewards-pp" element={<PlaceholderPage title="Product Point Rewards" />} />
            <Route path="rewards-pp/new" element={<PlaceholderPage title="Add New PP Reward" />} />
            <Route path="categories-pp" element={<PlaceholderPage title="PP Categories" />} />
            <Route path="categories-pp/new" element={<PlaceholderPage title="Add New PP Category" />} />

            {/* Contests */}
            <Route path="contests" element={<PlaceholderPage title="Contests" />} />
            <Route path="contests/new" element={<PlaceholderPage title="Add New Contest" />} />

            {/* Ban by IP */}
            <Route path="ban-by-ip" element={<PlaceholderPage title="Ban by IP" />} />

            {/* Challenges */}
            <Route path="challenges" element={<PlaceholderPage title="All Challenges" />} />
            <Route path="challenges/new" element={<PlaceholderPage title="Add New Challenge" />} />

            {/* Member Challenges */}
            <Route path="member-challenges" element={<PlaceholderPage title="Member Challenges" />} />

            {/* Spin to Win */}
            <Route path="spin-to-win" element={<PlaceholderPage title="Manage Spin to Win" />} />
            <Route path="spin-to-win/winners" element={<PlaceholderPage title="Members Won (Spin to Win)" />} />

            {/* Legendary Items CashOut */}
            <Route path="legendary-cashout" element={<PlaceholderPage title="Legendary Items Cashout" />} />

            {/* Referrals */}
            <Route path="referrals/invitations" element={<PlaceholderPage title="Referral Invitations" />} />
            <Route path="referrals/cashouts" element={<PlaceholderPage title="Referral Cashouts" />} />

            {/* Anchor User Rewards */}
            <Route path="anchor-rewards/cashouts" element={<PlaceholderPage title="Idle Minutes - Cashouts" />} />
            <Route path="anchor-rewards/queue" element={<PlaceholderPage title="Anchor Users Queue" />} />

            {/* Emails */}
            <Route path="emails" element={<PlaceholderPage title="Email Queue" />} />

            {/* Settings */}
            <Route path="settings" element={<PlaceholderPage title="Manage Settings" />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
