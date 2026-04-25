import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Copy, Plus, Trash2, ExternalLink, Sparkles, RotateCcw, Pencil } from "lucide-react";
import { toast } from "sonner";
import RedditAccountsManager from "@/components/admin/RedditAccountsManager";

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
  max_claims: number;
  claims_count: number;
  no_link_mode: boolean;
}

interface SubmissionRow {
  id: string;
  worker_name: string | null;
  posted_comment_url: string;
  created_at: string;
  verification_status: string;
  verified_at: string | null;
  verification_note: string | null;
  account_type: string;
}

const VERIF_COLORS: Record<string, string> = {
  unverified: "bg-muted text-muted-foreground",
  live: "bg-green-500/20 text-green-400 border-green-500/30",
  removed: "bg-red-500/20 text-red-400 border-red-500/30",
  deleted: "bg-red-500/20 text-red-400 border-red-500/30",
  unreachable: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

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
  const [submissionsByTask, setSubmissionsByTask] = useState<
    Record<string, SubmissionRow[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [autoAssign, setAutoAssign] = useState(true);
  const [autoAssignSaving, setAutoAssignSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // form state
  const [subreddit, setSubreddit] = useState("");
  const [threadTitle, setThreadTitle] = useState("");
  const [threadUrl, setThreadUrl] = useState("");
  const [variantsText, setVariantsText] = useState("");
  const [notes, setNotes] = useState("");
  const [maxClaims, setMaxClaims] = useState(1);
  const [noLinkMode, setNoLinkMode] = useState(false);

  // AI generation controls
  const ANGLE_OPTIONS: { key: string; label: string }[] = [
    { key: "rewards", label: "Rewards / earn money" },
    { key: "gender-ratio", label: "Better gender ratio" },
    { key: "less-bots", label: "Less bots than Omegle" },
    { key: "one-on-one", label: "1-on-1, no group" },
    { key: "free-no-signup", label: "Free, no signup" },
    { key: "personal-experience", label: "Personal experience" },
  ];
  const [genCount, setGenCount] = useState(5);
  const [genLength, setGenLength] = useState<string>("mixed");
  const [genTone, setGenTone] = useState<string>("mixed");
  const [genAngles, setGenAngles] = useState<string[]>([]);
  const [genCustom, setGenCustom] = useState("");

  const handleGenerate = async () => {
    setGenerating(true);
    // Build avoid-list from the openings of variants already in the textarea
    const existing = variantsText
      .split(/\n---+\n/)
      .map((v) => v.trim())
      .filter(Boolean);
    const avoidPhrases = existing
      .map((v) => v.split(/[.!?\n]/)[0].slice(0, 60))
      .filter(Boolean)
      .join("\n");

    const { data, error } = await supabase.functions.invoke(
      "generate-reddit-variants",
      {
        body: {
          count: genCount,
          context: [threadTitle, subreddit ? `r/${subreddit}` : ""]
            .filter(Boolean)
            .join(" — "),
          noLinkMode,
          length: genLength,
          tone: genTone,
          angles: genAngles,
          customInstructions: genCustom,
          avoidPhrases,
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
    const { data: subs } = await supabase
      .from("reddit_task_submissions")
      .select(
        "id, task_id, worker_name, posted_comment_url, created_at, verification_status, verified_at, verification_note, account_type",
      )
      .order("created_at", { ascending: true });
    const map: Record<string, SubmissionRow[]> = {};
    (subs || []).forEach((s: any) => {
      if (!map[s.task_id]) map[s.task_id] = [];
      map[s.task_id].push({
        id: s.id,
        worker_name: s.worker_name,
        posted_comment_url: s.posted_comment_url,
        created_at: s.created_at,
        verification_status: s.verification_status || "unverified",
        verified_at: s.verified_at,
        verification_note: s.verification_note,
        account_type: s.account_type || "fresh",
      });
    });
    setSubmissionsByTask(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase
      .from("reddit_task_settings")
      .select("auto_assign_enabled")
      .eq("id", 1)
      .maybeSingle();
    if (data) setAutoAssign(!!data.auto_assign_enabled);
  };

  const toggleAutoAssign = async (next: boolean) => {
    setAutoAssignSaving(true);
    const prev = autoAssign;
    setAutoAssign(next);
    const { error } = await supabase
      .from("reddit_task_settings")
      .update({ auto_assign_enabled: next, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setAutoAssignSaving(false);
    if (error) {
      setAutoAssign(prev);
      toast.error(error.message);
      return;
    }
    toast.success(
      next ? "Auto-assign enabled" : "Auto-assign disabled (code-only)",
    );
  };

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
    setMaxClaims(1);
    setNoLinkMode(false);
    setEditingId(null);
    setGenCount(5);
    setGenLength("mixed");
    setGenTone("mixed");
    setGenAngles([]);
    setGenCustom("");
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
    const payload = {
      subreddit: subreddit.trim() || null,
      thread_title: threadTitle.trim() || null,
      thread_url: threadUrl.trim(),
      suggested_comments: variants,
      notes: notes.trim() || null,
      max_claims: Math.max(1, Math.min(50, maxClaims || 1)),
      no_link_mode: noLinkMode,
    };
    const { error } = editingId
      ? await supabase.from("reddit_tasks").update(payload).eq("id", editingId)
      : await supabase
          .from("reddit_tasks")
          .insert({ ...payload, claim_code: generateCode() });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingId ? "Task updated" : "Task created");
    setCreateOpen(false);
    resetForm();
    load();
  };

  const openEdit = (t: RedditTask) => {
    setEditingId(t.id);
    setSubreddit(t.subreddit || "");
    setThreadTitle(t.thread_title || "");
    setThreadUrl(t.thread_url);
    setVariantsText((t.suggested_comments || []).join("\n---\n"));
    setNotes(t.notes || "");
    setMaxClaims(t.max_claims || 1);
    setNoLinkMode(!!t.no_link_mode);
    setCreateOpen(true);
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

  const resetClaims = async (id: string) => {
    if (
      !confirm(
        "Reset all claims and submissions for this task? Workers can claim it again from scratch.",
      )
    )
      return;
    const { error: subErr } = await supabase
      .from("reddit_task_submissions")
      .delete()
      .eq("task_id", id);
    if (subErr) {
      toast.error(subErr.message);
      return;
    }
    const { error: taskErr } = await supabase
      .from("reddit_tasks")
      .update({
        status: "open",
        claims_count: 0,
        claimed_by_name: null,
        claimed_at: null,
        posted_comment_url: null,
        completed_at: null,
      })
      .eq("id", id);
    if (taskErr) {
      toast.error(taskErr.message);
      return;
    }
    toast.success("Claims reset — task is open again");
    load();
  };

  const copyLink = (code: string) => {
    const url = `${workerBase}?code=${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Worker link copied");
  };

  const verifySubmission = async (submissionId: string) => {
    setVerifyingId(submissionId);
    const { error } = await supabase.functions.invoke("verify-reddit-comment", {
      body: { submission_id: submissionId },
    });
    setVerifyingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Verification complete");
    load();
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
          <div className="mt-3 flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3">
            <Switch
              checked={autoAssign}
              onCheckedChange={toggleAutoAssign}
              disabled={autoAssignSaving}
              id="auto-assign-toggle"
            />
            <div>
              <Label htmlFor="auto-assign-toggle" className="cursor-pointer">
                Auto-assign open tasks
              </Label>
              <p className="text-xs text-muted-foreground">
                When ON, workers visiting{" "}
                <code className="rounded bg-muted px-1 text-[10px]">/work/c24</code>{" "}
                without a code get the next available open task automatically.
                Manual code entry still works either way.
              </p>
            </div>
          </div>
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
                  {(submissionsByTask[t.id]?.length ?? 0) > 0 && (
                    <div className="rounded-md border border-border bg-muted/30 p-2 text-xs">
                      <p className="mb-1 font-medium text-foreground">
                        Submissions ({submissionsByTask[t.id].length}/{t.max_claims}):
                      </p>
                      <ul className="space-y-1">
                        {submissionsByTask[t.id].map((s, idx) => (
                          <li key={idx} className="flex flex-wrap items-center gap-2">
                            <span className="text-foreground">
                              {s.worker_name || "(no name)"}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                s.account_type === "aged"
                                  ? "bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px]"
                                  : "text-[10px]"
                              }
                            >
                              {s.account_type === "aged" ? "🎖️ aged" : "fresh"}
                            </Badge>
                            <a
                              href={s.posted_comment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              view comment <ExternalLink className="h-3 w-3" />
                            </a>
                            <Badge
                              variant="outline"
                              className={VERIF_COLORS[s.verification_status] || ""}
                              title={s.verification_note || ""}
                            >
                              {s.verification_status}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => verifySubmission(s.id)}
                              disabled={verifyingId === s.id}
                            >
                              {verifyingId === s.id ? "Checking…" : "Re-check"}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t.suggested_comments.length} comment variant
                    {t.suggested_comments.length === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Claimed: {t.claims_count}/{t.max_claims}
                  </p>
                  {t.no_link_mode && (
                    <Badge variant="outline" className="text-[10px]">
                      no-link mode
                    </Badge>
                  )}
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
                    variant="outline"
                    onClick={() => resetClaims(t.id)}
                    title="Clear all submissions & claim count so this task can be reused"
                  >
                    <RotateCcw className="mr-1 h-3 w-3" /> Reset claims
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(t)}
                    title="Edit task details"
                  >
                    <Pencil className="mr-1 h-3 w-3" /> Edit
                  </Button>
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

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Reddit task" : "New Reddit task"}
            </DialogTitle>
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
              <Label>Max workers per thread</Label>
              <p className="mb-1 text-xs text-muted-foreground">
                Cap the number of microworkers who can submit a comment on this
                thread. Default 1 — keeps Reddit looking organic.
              </p>
              <Input
                type="number"
                min={1}
                max={50}
                value={maxClaims}
                onChange={(e) => setMaxClaims(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3">
              <Checkbox
                id="no-link-mode"
                checked={noLinkMode}
                onCheckedChange={(v) => setNoLinkMode(!!v)}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="no-link-mode" className="cursor-pointer">
                  No-link mode (avoids Reddit spam filter)
                </Label>
                <p className="text-xs text-muted-foreground">
                  When ON, AI-generated variants will NOT include "c24club.com".
                  Comments mention the site generically (e.g. "a newer omegle
                  alternative"). Curious readers Google it themselves. Massively
                  reduces Reddit auto-removal rate.
                </p>
              </div>
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
              <div className="mb-2 space-y-2 rounded-md border border-border bg-muted/20 p-3">
                <p className="text-xs font-medium text-foreground">
                  AI generation controls
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Count</Label>
                    <Input
                      type="number"
                      min={1}
                      max={15}
                      value={genCount}
                      onChange={(e) =>
                        setGenCount(Math.max(1, Math.min(15, parseInt(e.target.value) || 1)))
                      }
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Length</Label>
                    <Select value={genLength} onValueChange={setGenLength}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Short (1 sentence)</SelectItem>
                        <SelectItem value="medium">Medium (2-3 sentences)</SelectItem>
                        <SelectItem value="long">Long (3-5 sentences)</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Tone</Label>
                    <Select value={genTone} onValueChange={setGenTone}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                        <SelectItem value="skeptical">Skeptical / honest</SelectItem>
                        <SelectItem value="blunt">Blunt / short</SelectItem>
                        <SelectItem value="helpful">Helpful</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">
                    Angles (leave blank = let AI rotate all)
                  </Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {ANGLE_OPTIONS.map((a) => {
                      const checked = genAngles.includes(a.key);
                      return (
                        <label
                          key={a.key}
                          className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                            checked
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setGenAngles((prev) =>
                                v
                                  ? [...prev, a.key]
                                  : prev.filter((k) => k !== a.key),
                              );
                            }}
                            className="h-3.5 w-3.5"
                          />
                          {a.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Custom instructions (optional)</Label>
                  <Textarea
                    value={genCustom}
                    onChange={(e) => setGenCustom(e.target.value)}
                    rows={2}
                    placeholder="e.g. Mention you're a college student. Don't use the word 'awesome'. Reply like you're answering OP directly."
                    className="text-xs"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Existing variants in the box below are auto-added to an "avoid"
                  list so new generations don't repeat the same openings.
                </p>
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
              {saving ? "Saving…" : editingId ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRedditTasksPage;
