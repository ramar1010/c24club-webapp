import { useState, useEffect } from "react";
import DataTable, { DataTableColumn } from "@/components/admin/DataTable";
import { useMembers, useDeleteMember } from "@/hooks/useCrud";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, User, ShieldX, Crown } from "lucide-react";
import DeleteDialog from "@/components/admin/DeleteDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Member = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  profession: string | null;
  stats: string | null;
  birthdate: string | null;
  gender: string | null;
  membership: string | null;
  minutes?: number;
};

const BAN_REASONS = [
  { value: "standard", label: "Standard Ban", reasons: ["Violation of terms", "Inappropriate behavior", "Spam / abuse", "Harassment"] },
  { value: "underage", label: "Underage (Permanent)", reasons: ["User is underage"] },
];

const memberColumns: DataTableColumn<Member>[] = [
  {
    key: "id",
    header: "ID",
    className: "w-20",
    render: (row) => <span className="font-mono text-xs text-foreground">{row.id.slice(0, 8)}</span>,
  },
  {
    key: "name" as any,
    header: "Photo",
    sortable: false,
    className: "w-14",
    render: () => (
      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
        <User className="h-4 w-4 text-muted-foreground" />
      </div>
    ),
  },
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "country", header: "Country" },
  { key: "stats", header: "Stats" },
  { key: "birthdate", header: "Birth Date" },
  {
    key: "minutes",
    header: "Minutes",
    render: (row) => (
      <span className="font-mono text-sm text-foreground">{row.minutes ?? 0}</span>
    ),
  },
  {
    key: "gender",
    header: "Gender",
    render: (row) => row.gender ? (
      <Badge variant="secondary" className="text-xs font-normal">{row.gender}</Badge>
    ) : null,
  },
  {
    key: "membership",
    header: "Membership",
    render: (row) => {
      const colors: Record<string, string> = {
        Free: "bg-muted text-muted-foreground",
        Premium: "bg-primary/10 text-primary",
        Gold: "bg-warning/10 text-warning",
        Platinum: "bg-accent/10 text-accent",
      };
      return row.membership ? (
        <Badge className={`text-xs font-medium ${colors[row.membership] || ""}`}>{row.membership}</Badge>
      ) : null;
    },
  },
];

const MembersPage = () => {
  const { data, isLoading } = useMembers();
  const deleteMutation = useDeleteMember();
  const { user } = useAuth();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [banTarget, setBanTarget] = useState<Member | null>(null);
  const [banType, setBanType] = useState("standard");
  const [banReason, setBanReason] = useState("Violation of terms");
  const [customReason, setCustomReason] = useState("");
  const [banning, setBanning] = useState(false);

  // VIP management
  const [vipTarget, setVipTarget] = useState<Member | null>(null);
  const [vipTier, setVipTier] = useState<string>("basic");
  const [savingVip, setSavingVip] = useState(false);
  const [currentVipInfo, setCurrentVipInfo] = useState<{ is_vip: boolean; vip_tier: string | null } | null>(null);

  // Load current VIP status when dialog opens
  useEffect(() => {
    if (!vipTarget) return;
    (async () => {
      const { data } = await supabase
        .from("member_minutes")
        .select("is_vip, vip_tier")
        .eq("user_id", vipTarget.id)
        .maybeSingle();
      setCurrentVipInfo(data ? { is_vip: data.is_vip, vip_tier: data.vip_tier } : null);
      if (data?.vip_tier) setVipTier(data.vip_tier);
    })();
  }, [vipTarget]);

  const handleSetVip = async (enable: boolean) => {
    if (!vipTarget) return;
    setSavingVip(true);
    try {
      const { data: existing } = await supabase
        .from("member_minutes")
        .select("id")
        .eq("user_id", vipTarget.id)
        .maybeSingle();

      const updates = {
        is_vip: enable,
        vip_tier: enable ? vipTier : null,
        stripe_customer_id: enable ? null : null,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabase
          .from("member_minutes")
          .update(updates)
          .eq("user_id", vipTarget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("member_minutes")
          .insert({ user_id: vipTarget.id, ...updates } as any);
        if (error) throw error;
      }

      toast.success(enable ? `${vipTarget.name} is now VIP (${vipTier})` : `${vipTarget.name} VIP removed`);
      setVipTarget(null);
    } catch (err: any) {
      toast.error("Failed to update VIP status", { description: err.message });
    } finally {
      setSavingVip(false);
    }
  };

  const handleBan = async () => {
    if (!banTarget || !user) return;
    setBanning(true);
    try {
      const reason = banReason === "custom" ? customReason.trim() : banReason;
      if (!reason) {
        toast.error("Please provide a ban reason");
        setBanning(false);
        return;
      }

      const { error } = await supabase.from("user_bans").insert({
        user_id: banTarget.id,
        reason,
        ban_type: banType,
        banned_by: user.id,
      } as any);

      if (error) throw error;
      toast.success(`${banTarget.name} has been banned`);
      setBanTarget(null);
      setBanReason("Violation of terms");
      setBanType("standard");
      setCustomReason("");
    } catch (err: any) {
      toast.error("Failed to ban user", { description: err.message });
    } finally {
      setBanning(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      // Delete in batches of 50
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const { error } = await supabase.from("members").delete().in("id", batch);
        if (error) throw error;
      }
      toast.success(`${ids.length} member(s) deleted`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      // Invalidate query to refresh
      deleteMutation.reset();
      window.location.reload();
    } catch (err: any) {
      toast.error("Bulk delete failed", { description: err.message });
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">All Members</h2>
          <p className="text-muted-foreground mt-1">
            {isLoading ? "Loading..." : `${data?.length ?? 0} members total.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete {selectedIds.size} selected
            </Button>
          )}
          <Button>
            <User className="mr-2 h-4 w-4" />
            Add New Member
          </Button>
        </div>
      </div>

      <DataTable
        data={(data as Member[]) ?? []}
        columns={memberColumns}
        expandable
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        searchKeys={["name", "email", "country", "gender", "membership"]}
        renderExpandedRow={(row) => (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3 text-sm">
            <div><span className="text-muted-foreground">Title:</span> <span className="font-medium text-foreground">{row.title}</span></div>
            <div><span className="text-muted-foreground">City:</span> <span className="font-medium text-foreground">{row.city}</span></div>
            <div><span className="text-muted-foreground">State:</span> <span className="font-medium text-foreground">{row.state}</span></div>
            <div><span className="text-muted-foreground">Zip:</span> <span className="font-medium text-foreground">{row.zip}</span></div>
            <div><span className="text-muted-foreground">Email:</span> <span className="font-medium text-foreground">{row.email}</span></div>
            <div><span className="text-muted-foreground">Profession:</span> <span className="font-medium text-foreground">{row.profession}</span></div>
          </div>
        )}
        actions={(row) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-yellow-500 hover:text-yellow-400"
              title="Manage VIP"
              onClick={() => {
                setVipTarget(row);
                setVipTier("basic");
                setCurrentVipInfo(null);
              }}
            >
              <Crown className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              title="Ban user"
              onClick={() => {
                setBanTarget(row);
                setBanType("standard");
                setBanReason("Violation of terms");
                setCustomReason("");
              }}
            >
              <ShieldX className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(row.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      />

      <DeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }}
        title="this member"
        isPending={deleteMutation.isPending}
      />

      {/* Ban Dialog */}
      <Dialog open={!!banTarget} onOpenChange={(open) => !open && setBanTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldX className="h-5 w-5 text-destructive" />
              Ban {banTarget?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Ban Type</Label>
              <Select value={banType} onValueChange={(v) => {
                setBanType(v);
                const group = BAN_REASONS.find(b => b.value === v);
                if (group) setBanReason(group.reasons[0]);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BAN_REASONS.map(b => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={banReason} onValueChange={setBanReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BAN_REASONS.find(b => b.value === banType)?.reasons.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                  <SelectItem value="custom">Custom reason...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {banReason === "custom" && (
              <div className="space-y-2">
                <Label>Custom Reason</Label>
                <Textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter custom ban reason..."
                  maxLength={500}
                />
              </div>
            )}

            {banType === "underage" && (
              <p className="text-sm text-destructive font-medium">
                ⚠️ Underage bans are permanent and cannot be appealed via payment.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBanTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBan} disabled={banning}>
              {banning ? "Banning..." : "Confirm Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VIP Management Dialog */}
      <Dialog open={!!vipTarget} onOpenChange={(open) => !open && setVipTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Manage VIP — {vipTarget?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {currentVipInfo && (
              <div className="text-sm">
                <span className="text-muted-foreground">Current status: </span>
                {currentVipInfo.is_vip ? (
                  <Badge className="bg-yellow-500/10 text-yellow-500">{currentVipInfo.vip_tier ?? "VIP"}</Badge>
                ) : (
                  <Badge variant="secondary">Not VIP</Badge>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>VIP Tier</Label>
              <Select value={vipTier} onValueChange={setVipTier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic VIP ($2.49/week)</SelectItem>
                  <SelectItem value="premium">Premium VIP ($9.99/month)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            {currentVipInfo?.is_vip && (
              <Button variant="destructive" onClick={() => handleSetVip(false)} disabled={savingVip}>
                {savingVip ? "Saving..." : "Remove VIP"}
              </Button>
            )}
            <Button onClick={() => handleSetVip(true)} disabled={savingVip} className="bg-yellow-500 hover:bg-yellow-400 text-black">
              {savingVip ? "Saving..." : currentVipInfo?.is_vip ? "Update Tier" : "Make VIP"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <DeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => !open && setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        title={`${selectedIds.size} selected member(s)`}
        isPending={bulkDeleting}
      />
    </div>
  );
};

export default MembersPage;
