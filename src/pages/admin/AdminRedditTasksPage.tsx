import { useEffect, useMemo, useState } from "react";
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
import { Copy, Plus, Trash2, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface RedditTask {
  id: string;
  claim_code: string;
  subreddit: string | null;
  thread_title: string | null;
  thread_url: string;
  suggested_comments: string[];
  notes: string | null;
  status: string;
  claimed_by_name: string | null;
  claimed_at: string | null;
  posted_comment_url: string | null;
  completed_at: string | null;
  admin_notes: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-muted text-muted-foreground",
  claimed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  completed: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  verified: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
};

const generateCode = () =>
  Math.random().toString(36).slice(2, 8).toUpperCase() +
  Math.random().toString(36).slice(2, 6).toUpperCase();

const AdminRedditTasksPage = () => {
  const [tasks, setTasks] = useState<RedditTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // form state
  const [subreddit, setSubreddit] = useState("");
  const [threadTitle, setThreadTitle] = useState("");
  const [threadUrl, setThreadUrl] = useState("");
  const [variantsText, setVariantsText] = useState("");
  const [notes, setNotes] = useState("");

  const handleGenerate = async () => {
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke(
      "generate-reddit-variants",
      {
        body: {
          count: 5,
          context: [threadTitle, subreddit ? `r/${subreddit}` : ""]
            .filter(Boolean)
            .join(" — "),
        },
      },
    );
    setGenerating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const variants: string[] = data?.variants || [];
    if (variants.length === 0) {
      toast.error("No variants returned, try again");
      return;
    }
    const merged = [
      ...(variantsText.trim() ? [variantsText.trim()] : []),
      ...variants,
    ].join("\n---\n");
    setVariantsText(merged);
    toast.success(`Generated ${variants.length} variants`);
  };

  const workerBase = `${window.location.origin}/work/c24`;

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reddit_tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setTasks((data || []) as RedditTask[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return tasks;
    return tasks.filter((t) => t.status === statusFilter);
  }, [tasks, statusFilter]);

  const counts = useMemo(() => {
    const c = { open: 0, claimed: 0, completed: 0, verified: 0, rejected: 0 };
    tasks.forEach((t) => {
      if (t.status in c) c[t.status as keyof typeof c]++;
    });
    return c;
  }, [tasks]);

  const resetForm = () => {
    setSubreddit("");
    setThreadTitle("");
    setThreadUrl("");
    setVariantsText("");
    setNotes("");
  };

  const handleCreate = async () => {
    if (!threadUrl.trim()) {
      toast.error("Thread URL is required");
      return;
    }
    const variants = variantsText
      .split(/\n---+\n/)
      .map((v) => v.trim())
      .filter(Boolean);
    if (variants.length === 0) {
      toast.error("Add at least one comment variant");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("reddit_tasks").insert({
      claim_code: generateCode(),
      subreddit: subreddit.trim() || null,
      thread_title: threadTitle.trim() || null,
      thread_url: threadUrl.trim(),
      suggested_comments: variants,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Task created");
    setCreateOpen(false);
    resetForm();
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("reddit_tasks")
      .update({ status })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Marked as ${status}`);
      load();
    }
  };

  const deleteTask = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    const { error } = await supabase.from("reddit_tasks").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      load();
    }
  };

  const copyLink = (code: string) => {
    const url = `${workerBase}?code=${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Worker link copied");
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reddit Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Microworker outreach tracking. Worker page:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {workerBase}
            </code>
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({tasks.length})</SelectItem>
              <SelectItem value="open">Open ({counts.open})</SelectItem>
              <SelectItem value="claimed">Claimed ({counts.claimed})</SelectItem>
              <SelectItem value="completed">
                Completed ({counts.completed})
              </SelectItem>
              <SelectItem value="verified">
                Verified ({counts.verified})
              </SelectItem>
              <SelectItem value="rejected">
                Rejected ({counts.rejected})
              </SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New task
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No tasks yet. Click "New task" to add a Reddit thread.
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={STATUS_COLORS[t.status] || ""}
                    >
                      {t.status}
                    </Badge>
                    {t.subreddit && (
                      <span className="text-xs text-muted-foreground">
                        r/{t.subreddit}
                      </span>
                    )}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {t.claim_code}
                    </code>
                  </div>
                  <p className="font-medium text-foreground">
                    {t.thread_title || t.thread_url}
                  </p>
                  <a
                    href={t.thread_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Open thread <ExternalLink className="h-3 w-3" />
                  </a>
                  {t.claimed_by_name && (
                    <p className="text-xs text-muted-foreground">
                      Claimed by:{" "}
                      <span className="text-foreground">{t.claimed_by_name}</span>
                    </p>
                  )}
                  {t.posted_comment_url && (
                    <a
                      href={t.posted_comment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View posted comment <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t.suggested_comments.length} comment variant
                    {t.suggested_comments.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyLink(t.claim_code)}
                  >
                    <Copy className="mr-1 h-3 w-3" /> Worker link
                  </Button>
                  {t.status === "completed" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => updateStatus(t.id, "verified")}
                      >
                        Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => updateStatus(t.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {t.status !== "open" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateStatus(t.id, "open")}
                    >
                      Reopen
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteTask(t.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Reddit task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Subreddit (no r/)</Label>
                <Input
                  value={subreddit}
                  onChange={(e) => setSubreddit(e.target.value)}
                  placeholder="MakeNewFriendsHere"
                />
              </div>
              <div>
                <Label>Thread title (optional)</Label>
                <Input
                  value={threadTitle}
                  onChange={(e) => setThreadTitle(e.target.value)}
                  placeholder="Best Omegle alternative?"
                />
              </div>
            </div>
            <div>
              <Label>Thread URL *</Label>
              <Input
                value={threadUrl}
                onChange={(e) => setThreadUrl(e.target.value)}
                placeholder="https://reddit.com/r/..."
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <Label>Comment variants *</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  {generating ? "Generating…" : "Generate with AI"}
                </Button>
              </div>
              <p className="mb-1 text-xs text-muted-foreground">
                Separate each variant with a line containing only{" "}
                <code className="rounded bg-muted px-1">---</code>
              </p>
              <Textarea
                value={variantsText}
                onChange={(e) => setVariantsText(e.target.value)}
                rows={10}
                placeholder={`Honestly c24club has been my go-to lately, way less bots than the old Omegle.\n---\nIf you want something close to Omegle try c24club, free + 1-on-1 video.\n---\nC24 Club is decent — clean interface, no signup needed.`}
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label>Notes (worker-visible)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Pick the most natural one, don't paste verbatim."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Saving…" : "Create task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRedditTasksPage;
