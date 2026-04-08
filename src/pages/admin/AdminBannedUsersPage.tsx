import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DataTable, { DataTableColumn } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShieldCheck, ShieldX } from "lucide-react";
import { toast } from "sonner";

type BanRow = {
  id: string;
  user_id: string;
  reason: string;
  ban_type: string;
  ban_source: string;
  is_active: boolean;
  ip_address: string | null;
  created_at: string;
  unbanned_at: string | null;
  member_name?: string;
  member_email?: string;
};

const AdminBannedUsersPage = () => {
  const queryClient = useQueryClient();
  const [unbanTarget, setUnbanTarget] = useState<BanRow | null>(null);

  const { data: bans = [], isLoading } = useQuery({
    queryKey: ["admin-bans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_bans")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch member names
      const userIds = [...new Set((data as any[]).map((b) => b.user_id))];
      const { data: members } = await supabase
        .from("members")
        .select("id, name, email")
        .in("id", userIds);

      const memberMap = new Map((members ?? []).map((m) => [m.id, m]));

      return (data as any[]).map((b) => ({
        ...b,
        member_name: memberMap.get(b.user_id)?.name ?? "Unknown",
        member_email: memberMap.get(b.user_id)?.email ?? "",
      })) as BanRow[];
    },
  });

  const unbanMutation = useMutation({
    mutationFn: async (ban: BanRow) => {
      const { error } = await supabase
        .from("user_bans")
        .update({
          is_active: false,
          unbanned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", ban.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User has been unbanned");
      queryClient.invalidateQueries({ queryKey: ["admin-bans"] });
      setUnbanTarget(null);
    },
    onError: (err: any) => {
      toast.error("Failed to unban user", { description: err.message });
    },
  });

  const columns: DataTableColumn<BanRow>[] = [
    {
      key: "member_name" as any,
      header: "User",
      render: (row) => (
        <div>
          <p className="font-medium text-sm">{row.member_name}</p>
          <p className="text-xs text-muted-foreground">{row.member_email}</p>
        </div>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      render: (row) => <span className="text-sm">{row.reason}</span>,
    },
    {
      key: "ban_type",
      header: "Type",
      render: (row) => (
        <Badge variant={row.ban_type === "underage" ? "destructive" : "secondary"} className="text-xs">
          {row.ban_type}
        </Badge>
      ),
    },
    {
      key: "ip_address",
      header: "IP",
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{row.ip_address ?? "—"}</span>
      ),
    },
    {
      key: "is_active",
      header: "Status",
      render: (row) =>
        row.is_active ? (
          <Badge variant="destructive" className="text-xs">Active</Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">Unbanned</Badge>
        ),
    },
    {
      key: "created_at",
      header: "Banned On",
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.created_at).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
          })}
        </span>
      ),
    },
  ];

  const activeBans = bans.filter((b) => b.is_active);
  const inactiveBans = bans.filter((b) => !b.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Banned Users</h2>
        <p className="text-muted-foreground mt-1">
          {isLoading ? "Loading..." : `${activeBans.length} active bans, ${inactiveBans.length} past bans.`}
        </p>
      </div>

      <DataTable
        data={bans}
        columns={columns}
        searchKeys={["member_name", "member_email", "reason", "ip_address"]}
        actions={(row) =>
          row.is_active ? (
            <Button
              variant="outline"
              size="sm"
              className="text-green-500 border-green-500/30 hover:bg-green-500/10"
              onClick={() => setUnbanTarget(row)}
            >
              <ShieldCheck className="h-4 w-4 mr-1" />
              Unban
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Unbanned {row.unbanned_at ? new Date(row.unbanned_at).toLocaleDateString() : ""}
            </span>
          )
        }
      />

      {/* Unban Confirmation Dialog */}
      <Dialog open={!!unbanTarget} onOpenChange={(open) => !open && setUnbanTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-500" />
              Unban {unbanTarget?.member_name}?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2 text-sm">
            <p><span className="text-muted-foreground">Reason for ban:</span> {unbanTarget?.reason}</p>
            <p><span className="text-muted-foreground">Ban type:</span> {unbanTarget?.ban_type}</p>
            {unbanTarget?.ip_address && (
              <p><span className="text-muted-foreground">IP:</span> <span className="font-mono">{unbanTarget.ip_address}</span></p>
            )}
            <p className="text-muted-foreground text-xs mt-3">
              This will remove the ban and allow the user to access the platform again.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnbanTarget(null)}>Cancel</Button>
            <Button
              onClick={() => unbanTarget && unbanMutation.mutate(unbanTarget)}
              disabled={unbanMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {unbanMutation.isPending ? "Unbanning..." : "Confirm Unban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBannedUsersPage;
