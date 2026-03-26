import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DataTable, { DataTableColumn } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Trash2, XCircle, CheckCircle } from "lucide-react";
import DeleteDialog from "@/components/admin/DeleteDialog";
import { toast } from "sonner";

type MemberRedemption = {
  id: string;
  user_id: string;
  reward_title: string;
  reward_rarity: string;
  reward_type: string;
  minutes_cost: number;
  status: string;
  shipping_name: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
  shipping_tracking_url: string | null;
  address_exists: string | null;
  notes: string | null;
  created_at: string;
  members: { name: string; email: string | null } | null;
};

type WishlistItem = {
  id: string;
  user_id: string;
  title: string;
  image_url: string | null;
  minutes_cost: number;
  status: string;
  created_at: string;
  members: { name: string; email: string | null } | null;
};

const STATUS_COLORS: Record<string, string> = {
  "pending_shipping": "bg-yellow-500/10 text-yellow-600",
  "pending_payment": "bg-orange-500/10 text-orange-600",
  "processing": "bg-blue-500/10 text-blue-600",
  "Redeemed Milestone Reward": "bg-purple-500/10 text-purple-600",
  "Order placed": "bg-cyan-500/10 text-cyan-600",
  "Order shipped": "bg-green-500/10 text-green-600",
  "Item Out of stock": "bg-red-500/10 text-red-600",
  "Gift Card Form Filled by user": "bg-indigo-500/10 text-indigo-600",
  "Gift Card Sent on Email": "bg-emerald-500/10 text-emerald-600",
  "Redeemed Product Point Reward": "bg-violet-500/10 text-violet-600",
  "Redeemed VIP Gift Reward": "bg-amber-500/10 text-amber-600",
  "Redeemed as Anchor User Reward": "bg-teal-500/10 text-teal-600",
};

const WISHLIST_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/10 text-green-600",
  rejected: "bg-red-500/10 text-red-600",
  removed: "bg-neutral-500/10 text-neutral-400",
};

const columns: DataTableColumn<MemberRedemption>[] = [
  {
    key: "id",
    header: "ID",
    className: "w-20",
    render: (row) => <span className="font-mono text-xs">{row.id.slice(0, 8)}</span>,
  },
  {
    key: "members",
    header: "Member",
    render: (row) => (
      <div>
        <div className="font-medium">{row.members?.name || "Unknown"}</div>
        <div className="text-xs text-muted-foreground">{row.members?.email || row.user_id.slice(0, 8)}</div>
      </div>
    ),
  },
  {
    key: "reward_title",
    header: "Reward",
    render: (row) => (
      <div className="flex items-center gap-2">
        <span>{row.reward_title}</span>
        {row.status === "Redeemed as Anchor User Reward" && (
          <Badge className="text-[10px] bg-teal-500/10 text-teal-600 border-teal-500/20">Anchor</Badge>
        )}
      </div>
    ),
  },
  {
    key: "minutes_cost",
    header: "Cost",
    render: (row) => <span className="font-bold">{row.minutes_cost} min</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <Badge className={`text-xs ${STATUS_COLORS[row.status] || "bg-muted text-muted-foreground"}`}>
        {row.status}
      </Badge>
    ),
  },
  {
    key: "shipping_country",
    header: "Country",
    render: (row) => row.shipping_country || <span className="text-muted-foreground">—</span>,
  },
  {
    key: "created_at",
    header: "Date",
    render: (row) => new Date(row.created_at).toLocaleDateString(),
  },
];

const wishlistColumns: DataTableColumn<WishlistItem>[] = [
  {
    key: "id",
    header: "ID",
    className: "w-20",
    render: (row) => <span className="font-mono text-xs">{row.id.slice(0, 8)}</span>,
  },
  {
    key: "members",
    header: "Member",
    render: (row) => (
      <div>
        <div className="font-medium">{row.members?.name || "Unknown"}</div>
        <div className="text-xs text-muted-foreground">{row.members?.email || row.user_id.slice(0, 8)}</div>
      </div>
    ),
  },
  {
    key: "title",
    header: "Item",
    render: (row) => (
      <div className="flex items-center gap-2">
        {row.image_url ? (
          <img src={row.image_url} alt={row.title} className="w-8 h-8 rounded object-cover" />
        ) : (
          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-sm">🎁</div>
        )}
        <span className="font-medium">{row.title}</span>
      </div>
    ),
  },
  {
    key: "minutes_cost",
    header: "Minutes Goal",
    render: (row) => <span className="font-bold">{row.minutes_cost}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <Badge className={`text-xs ${WISHLIST_STATUS_COLORS[row.status] || "bg-muted text-muted-foreground"}`}>
        {row.status}
      </Badge>
    ),
  },
  {
    key: "created_at",
    header: "Date",
    render: (row) => new Date(row.created_at).toLocaleDateString(),
  },
];

const MemberRewardsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<MemberRedemption | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin_member_redemptions"],
    queryFn: async () => {
      const { data: redemptions, error } = await supabase
        .from("member_redemptions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((redemptions || []).map(r => r.user_id))];
      const { data: members } = await supabase
        .from("members")
        .select("id, name, email")
        .in("id", userIds);

      const memberMap = new Map((members || []).map(m => [m.id, m]));
      return (redemptions || []).map(r => ({
        ...r,
        members: memberMap.get(r.user_id) || null,
      })) as MemberRedemption[];
    },
  });

  // Wishlist items query
  const { data: wishlistData, isLoading: wishlistLoading } = useQuery({
    queryKey: ["admin_wishlist_items"],
    queryFn: async () => {
      const { data: items, error } = await supabase
        .from("wishlist_items")
        .select("*")
        .in("status", ["active", "rejected"])
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((items || []).map((i: any) => i.user_id))];
      const { data: members } = await supabase
        .from("members")
        .select("id, name, email")
        .in("id", userIds.length ? userIds : ["__none__"]);

      const memberMap = new Map((members || []).map(m => [m.id, m]));
      return (items || []).map((i: any) => ({
        ...i,
        members: memberMap.get(i.user_id) || null,
      })) as WishlistItem[];
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("wishlist_items")
        .update({ status: "rejected" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Wishlist item rejected");
      queryClient.invalidateQueries({ queryKey: ["admin_wishlist_items"] });
    },
    onError: () => toast.error("Failed to reject item"),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("wishlist_items")
        .update({ status: "active" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Wishlist item re-approved");
      queryClient.invalidateQueries({ queryKey: ["admin_wishlist_items"] });
    },
    onError: () => toast.error("Failed to approve item"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("member_redemptions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Redemption deleted");
      queryClient.invalidateQueries({ queryKey: ["admin_member_redemptions"] });
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete redemption"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("member_redemptions").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selectedIds.size} redemption(s) deleted`);
      queryClient.invalidateQueries({ queryKey: ["admin_member_redemptions"] });
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    },
    onError: () => toast.error("Failed to delete redemptions"),
  });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="redemptions">
        <TabsList>
          <TabsTrigger value="redemptions">Redemptions ({data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="wishlist">Wishlist Items ({wishlistData?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="redemptions" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">All Member Rewards</h2>
              <p className="text-muted-foreground mt-1">
                {isLoading ? "Loading..." : `${data?.length ?? 0} redemptions total.`}
              </p>
            </div>
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete {selectedIds.size} selected
              </Button>
            )}
          </div>

          <DataTable
            data={data ?? []}
            columns={columns}
            searchKeys={["reward_title", "status"]}
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            actions={(row) => (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigate(`/admin/member-rewards/${row.id}/edit`)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(row)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="wishlist" className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Wishlist Items</h2>
            <p className="text-muted-foreground mt-1">
              {wishlistLoading ? "Loading..." : `${wishlistData?.length ?? 0} wishlist items. Reject items that don't meet guidelines.`}
            </p>
          </div>

          <DataTable
            data={wishlistData ?? []}
            columns={wishlistColumns}
            searchKeys={["title", "status"]}
            actions={(row) => (
              <div className="flex gap-1">
                {row.status === "active" ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => rejectMutation.mutate(row.id)}
                    disabled={rejectMutation.isPending}
                    title="Reject item"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-green-600 hover:text-green-500"
                    onClick={() => approveMutation.mutate(row.id)}
                    disabled={approveMutation.isPending}
                    title="Re-approve item"
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          />
        </TabsContent>
      </Tabs>

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={deleteTarget?.reward_title || "this redemption"}
        isPending={deleteMutation.isPending}
      />

      <DeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
        title={`${selectedIds.size} selected redemption(s)`}
        isPending={bulkDeleteMutation.isPending}
      />
    </div>
  );
};

export default MemberRewardsPage;
