import { useState, useEffect, useMemo, Fragment } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useMembersServerPage,
  useDeleteMember,
  type MemberSourceFilter,
} from "@/hooks/useCrud";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, User, ShieldX, Crown, Search, ChevronDown, ChevronRight } from "lucide-react";
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

type VipSource = MemberSourceFilter;

const BAN_REASONS = [
  { value: "standard", label: "Standard Ban", reasons: ["Violation of terms", "Inappropriate behavior", "Spam / abuse", "Harassment"] },
  { value: "underage", label: "Underage (Permanent)", reasons: ["User is underage"] },
];

const membershipColor = (membership: string | null) => {
  const colors: Record<string, string> = {
    Free: "bg-muted text-muted-foreground",
    Premium: "bg-primary/10 text-primary",
    Gold: "bg-warning/10 text-warning",
    Platinum: "bg-accent/10 text-accent",
  };
  return colors[membership || ""] || "";
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const MembersPage = () => {
  const qc = useQueryClient();
  const deleteMutation = useDeleteMember();
  const { user } = useAuth();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
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

  // Source filter + server-side pagination state
  const [sourceFilter, setSourceFilter] = useState<VipSource>("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Debounce search input -> server query (300ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to first page when filter or page size changes
  useEffect(() => {
    setPage(0);
  }, [sourceFilter, pageSize]);

  const { data: pageData, isLoading, isFetching } = useMembersServerPage({
    page,
    pageSize,
    search,
    sourceFilter,
  });
  const rows = (pageData?.rows ?? []) as Member[];
  const total = pageData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
        admin_granted_vip: enable,
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

      // Pull last known IP so the ban also blocks the IP, not just the user_id
      const { data: memberRow } = await supabase
        .from("members")
        .select("last_ip")
        .eq("id", banTarget.id)
        .maybeSingle();

      const { error } = await supabase.from("user_bans").insert({
        user_id: banTarget.id,
        reason,
        ban_type: banType,
        banned_by: user.id,
        is_active: true,
        ip_address: (memberRow as any)?.last_ip || null,
        ban_source: "manual",
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
      // Delete in batches of 20 via admin-delete-account (removes auth user + all data)
      let failed = 0;
      for (let i = 0; i < ids.length; i += 20) {
        const batch = ids.slice(i, i + 20);
        const { data, error } = await supabase.functions.invoke("admin-delete-account", {
          body: { user_ids: batch },
        });
        if (error) throw error;
        failed += (data?.results || []).filter((r: any) => !r.success).length;
      }
      if (failed > 0) {
        toast.warning(`${ids.length - failed} deleted, ${failed} failed`);
      } else {
        toast.success(`${ids.length} member(s) deleted`);
      }
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      qc.invalidateQueries({ queryKey: ["members_page"] });
      qc.invalidateQueries({ queryKey: ["members_count"] });
    } catch (err: any) {
      toast.error("Bulk delete failed", { description: err.message });
    } finally {
      setBulkDeleting(false);
    }
  };

  const allPageIds = rows.map((r) => r.id);
  const allPageSelected = allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));
  const somePageSelected = allPageIds.some((id) => selectedIds.has(id));

  const togglePageAll = () => {
    const next = new Set(selectedIds);
    if (allPageSelected) allPageIds.forEach((id) => next.delete(id));
    else allPageIds.forEach((id) => next.add(id));
    setSelectedIds(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };
  const toggleExpand = (id: string) => {
    const next = new Set(expandedRows);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedRows(next);
  };

  const pagesToShow = useMemo(() => {
    const max = 5;
    if (totalPages <= max) return Array.from({ length: totalPages }, (_, i) => i);
    if (page < 3) return [0, 1, 2, 3, 4];
    if (page > totalPages - 4) return Array.from({ length: 5 }, (_, i) => totalPages - 5 + i);
    return [page - 2, page - 1, page, page + 1, page + 2];
  }, [page, totalPages]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">All Members</h2>
          <p className="text-muted-foreground mt-1">
            {isLoading ? "Loading..." : `${total} members total.`}
            {isFetching && !isLoading ? " · refreshing…" : ""}
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

      {/* Source filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">Source:</span>
        {([
          { key: "all", label: "All" },
          { key: "all_vip", label: "👑 All VIPs" },
          { key: "google_play_or_appstore", label: "🛒 Native App (Play / App Store)" },
          { key: "stripe", label: "💳 Stripe (Web)" },
          { key: "admin_granted", label: "🛡️ Admin-granted VIP" },
          { key: "free", label: "Free" },
        ] as { key: VipSource; label: string }[]).map((s) => (
          <Button
            key={s.key}
            size="sm"
            variant={sourceFilter === s.key ? "default" : "outline"}
            onClick={() => setSourceFilter(s.key)}
          >
            {s.label}
          </Button>
        ))}
        {sourceFilter === "free" && (
          <span className="text-[11px] text-muted-foreground ml-2">
            (Free filter applies to the current page only.)
          </span>
        )}
      </div>

      {/* Toolbar: page size + server search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show</span>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-20 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((o) => (
                <SelectItem key={o} value={String(o)}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">per page</span>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, country…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">
                <Checkbox
                  checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                  onCheckedChange={togglePageAll}
                />
              </TableHead>
              <TableHead className="w-10" />
              <TableHead className="w-20 text-xs font-semibold uppercase tracking-wider">ID</TableHead>
              <TableHead className="w-14 text-xs font-semibold uppercase tracking-wider">Photo</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Name</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Email</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Country</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Stats</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Birth Date</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Minutes</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Gender</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Membership</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={13} className="h-24 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={13} className="h-24 text-center text-muted-foreground">No results found.</TableCell></TableRow>
            ) : (
              rows.map((row) => {
                const isExpanded = expandedRows.has(row.id);
                return (
                  <Fragment key={row.id}>
                    <TableRow className={selectedIds.has(row.id) ? "bg-primary/5" : ""}>
                      <TableCell className="w-10">
                        <Checkbox checked={selectedIds.has(row.id)} onCheckedChange={() => toggleOne(row.id)} />
                      </TableCell>
                      <TableCell className="w-10 cursor-pointer" onClick={() => toggleExpand(row.id)}>
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell><span className="font-mono text-xs text-foreground">{row.id.slice(0, 8)}</span></TableCell>
                      <TableCell>
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-foreground">{row.name ?? "—"}</TableCell>
                      <TableCell className="text-sm text-foreground">{row.email ?? "—"}</TableCell>
                      <TableCell className="text-sm text-foreground">{row.country ?? "—"}</TableCell>
                      <TableCell className="text-sm text-foreground">{row.stats ?? "—"}</TableCell>
                      <TableCell className="text-sm text-foreground">{row.birthdate ?? "—"}</TableCell>
                      <TableCell><span className="font-mono text-sm text-foreground">{row.minutes ?? 0}</span></TableCell>
                      <TableCell>{row.gender ? <Badge variant="secondary" className="text-xs font-normal">{row.gender}</Badge> : "—"}</TableCell>
                      <TableCell>{row.membership ? <Badge className={`text-xs font-medium ${membershipColor(row.membership)}`}>{row.membership}</Badge> : "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-yellow-500 hover:text-yellow-400" title="Manage VIP"
                            onClick={() => { setVipTarget(row); setVipTier("basic"); setCurrentVipInfo(null); }}>
                            <Crown className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Ban user"
                            onClick={() => { setBanTarget(row); setBanType("standard"); setBanReason("Violation of terms"); setCustomReason(""); }}>
                            <ShieldX className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(row.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={13} className="bg-muted/10 p-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3 text-sm">
                            <div><span className="text-muted-foreground">Title:</span> <span className="font-medium text-foreground">{row.title}</span></div>
                            <div><span className="text-muted-foreground">City:</span> <span className="font-medium text-foreground">{row.city}</span></div>
                            <div><span className="text-muted-foreground">State:</span> <span className="font-medium text-foreground">{row.state}</span></div>
                            <div><span className="text-muted-foreground">Zip:</span> <span className="font-medium text-foreground">{row.zip}</span></div>
                            <div><span className="text-muted-foreground">Email:</span> <span className="font-medium text-foreground">{row.email}</span></div>
                            <div><span className="text-muted-foreground">Profession:</span> <span className="font-medium text-foreground">{row.profession}</span></div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
        <div>
          {total === 0
            ? "0 entries"
            : `Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} of ${total}`}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
            {pagesToShow.map((p) => (
              <Button key={p} variant={p === page ? "default" : "outline"} size="sm" onClick={() => setPage(p)} className="w-9">
                {p + 1}
              </Button>
            ))}
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </div>

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
