import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil, Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface RedditAccount {
  id: string;
  username: string;
  password: string | null;
  email: string | null;
  recovery_email: string | null;
  karma: number;
  account_age_days: number;
  status: string;
  notes: string | null;
  last_used_at: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  warming: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  ready: "bg-green-500/20 text-green-400 border-green-500/30",
  banned: "bg-red-500/20 text-red-400 border-red-500/30",
  retired: "bg-muted text-muted-foreground",
};

const emptyForm = {
  username: "",
  password: "",
  email: "",
  recovery_email: "",
  karma: 0,
  account_age_days: 0,
  status: "warming",
  notes: "",
};

const RedditAccountsManager = () => {
  const [accounts, setAccounts] = useState<RedditAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reddit_accounts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setAccounts((data || []) as RedditAccount[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (a: RedditAccount) => {
    setEditingId(a.id);
    setForm({
      username: a.username,
      password: a.password || "",
      email: a.email || "",
      recovery_email: a.recovery_email || "",
      karma: a.karma,
      account_age_days: a.account_age_days,
      status: a.status,
      notes: a.notes || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.username.trim()) {
      toast.error("Username is required");
      return;
    }
    setSaving(true);
    const payload = {
      username: form.username.trim(),
      password: form.password.trim() || null,
      email: form.email.trim() || null,
      recovery_email: form.recovery_email.trim() || null,
      karma: Number(form.karma) || 0,
      account_age_days: Number(form.account_age_days) || 0,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    const { error } = editingId
      ? await supabase.from("reddit_accounts").update(payload).eq("id", editingId)
      : await supabase.from("reddit_accounts").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingId ? "Account updated" : "Account saved");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this account record?")) return;
    const { error } = await supabase.from("reddit_accounts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      load();
    }
  };

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const filtered = accounts.filter((a) =>
    statusFilter === "all" ? true : a.status === statusFilter
  );

  const counts = {
    warming: accounts.filter((a) => a.status === "warming").length,
    ready: accounts.filter((a) => a.status === "ready").length,
    banned: accounts.filter((a) => a.status === "banned").length,
    retired: accounts.filter((a) => a.status === "retired").length,
  };

  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Reddit Accounts</h2>
          <p className="text-sm text-muted-foreground">
            Track warmed-up Reddit accounts and credentials. Visible to admins only.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Warming: {counts.warming}</Badge>
            <Badge variant="outline" className={STATUS_COLORS.ready}>Ready: {counts.ready}</Badge>
            <Badge variant="outline" className={STATUS_COLORS.banned}>Banned: {counts.banned}</Badge>
            <Badge variant="outline">Retired: {counts.retired}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({accounts.length})</SelectItem>
              <SelectItem value="warming">Warming</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="banned">Banned</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> Add Account
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No accounts yet. Click "Add Account" to get started.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Username</th>
                <th className="py-2 pr-3">Password</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Karma</th>
                <th className="py-2 pr-3">Age (days)</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Notes</th>
                <th className="py-2 pr-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const isRevealed = revealed.has(a.id);
                return (
                  <tr key={a.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-mono">
                      <div className="flex items-center gap-1">
                        <span>u/{a.username}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy(a.username, "Username")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {a.password ? (
                        <div className="flex items-center gap-1">
                          <span>{isRevealed ? a.password : "••••••••"}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => toggleReveal(a.id)}>
                            {isRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy(a.password!, "Password")}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs">{a.email || <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-2 pr-3">{a.karma}</td>
                    <td className="py-2 pr-3">{a.account_age_days}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className={STATUS_COLORS[a.status] || ""}>
                        {a.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 max-w-[200px] truncate text-xs text-muted-foreground" title={a.notes || ""}>
                      {a.notes || "—"}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(a.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Reddit Account" : "Add Reddit Account"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Username (without u/)</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="my_reddit_user" />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Recovery Email</Label>
                <Input value={form.recovery_email} onChange={(e) => setForm({ ...form, recovery_email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Karma</Label>
                <Input type="number" value={form.karma} onChange={(e) => setForm({ ...form, karma: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Age (days)</Label>
                <Input type="number" value={form.account_age_days} onChange={(e) => setForm({ ...form, account_age_days: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warming">Warming</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="banned">Banned</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Subreddits joined, warming progress, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default RedditAccountsManager;