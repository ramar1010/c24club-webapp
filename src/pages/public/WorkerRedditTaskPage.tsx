import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Copy, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import microworkersUsernameExample from "@/assets/microworkers-username-example.png";
import redditCopyLinkExample from "@/assets/reddit-copy-link-example.png";

interface TaskView {
  id: string;
  subreddit: string | null;
  thread_title: string | null;
  thread_url: string;
  suggested_comments: string[];
  notes: string | null;
  status: string;
  claimed_by_name: string | null;
  posted_comment_url: string | null;
}

const WorkerRedditTaskPage = () => {
  const [params, setParams] = useSearchParams();
  const codeFromUrl = params.get("code") || "";
  const [code, setCode] = useState(codeFromUrl);
  const [task, setTask] = useState<TaskView | null>(null);
  const [loading, setLoading] = useState(false);
  const [workerName, setWorkerName] = useState(
    () => localStorage.getItem("reddit_worker_name") || ""
  );
  const [postedUrl, setPostedUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [variantIndex, setVariantIndex] = useState<number | null>(null);
  const [accountType, setAccountType] = useState<"fresh" | "aged">(
    () => (localStorage.getItem("reddit_worker_account_type") as "fresh" | "aged") || "fresh"
  );
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [autoAssignFailed, setAutoAssignFailed] = useState(false);

  const fetchTask = async (c: string) => {
    if (!c.trim()) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_reddit_task_by_code", {
      p_code: c.trim().toUpperCase(),
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = (data && (data as any[])[0]) || null;
    if (!row) {
      toast.error("No task found for that code");
      setTask(null);
      return;
    }
    setTask(row as TaskView);
    setPostedUrl(row.posted_comment_url || "");
    if (row.claimed_by_name && !workerName) {
      setWorkerName(row.claimed_by_name);
    }
  };

  const tryAutoAssign = async () => {
    setAutoAssigning(true);
    setAutoAssignFailed(false);
    const { data, error } = await supabase.rpc("auto_assign_reddit_task");
    setAutoAssigning(false);
    if (error) {
      setAutoAssignFailed(true);
      return;
    }
    const row = (data && (data as any[])[0]) || null;
    if (!row || !row.enabled || !row.claim_code) {
      setAutoAssignFailed(true);
      return;
    }
    const assigned = row.claim_code as string;
    setCode(assigned);
    setParams({ code: assigned });
    await fetchTask(assigned);
  };

  useEffect(() => {
    if (codeFromUrl) {
      fetchTask(codeFromUrl);
    } else {
      tryAutoAssign();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setParams({ code: code.trim().toUpperCase() });
    fetchTask(code);
  };

  const handleClaim = async () => {
    if (!task) return;
    if (!workerName.trim()) {
      toast.error("Enter your worker name first");
      return;
    }
    localStorage.setItem("reddit_worker_name", workerName.trim());
    const { data, error } = await supabase.rpc("claim_reddit_task", {
      p_code: code.trim().toUpperCase(),
      p_worker_name: workerName.trim(),
    });
    if (error) return toast.error(error.message);
    const res = data as { success: boolean; error?: string };
    if (!res.success) return toast.error(res.error || "Failed");
    toast.success("Task claimed — go post your comment!");
    fetchTask(code);
  };

  const handleSubmit = async () => {
    if (!task) return;
    if (!postedUrl.trim()) {
      toast.error("Paste your Reddit comment URL");
      return;
    }
    if (!workerName.trim()) {
      toast.error("Enter your worker name");
      return;
    }
    if (variantIndex === null) {
      toast.error("Select which variant you posted");
      return;
    }
    localStorage.setItem("reddit_worker_name", workerName.trim());
    localStorage.setItem("reddit_worker_account_type", accountType);
    setSubmitting(true);
    const { data, error } = await supabase.rpc("submit_reddit_task", {
      p_code: code.trim().toUpperCase(),
      p_worker_name: workerName.trim(),
      p_posted_url: postedUrl.trim(),
      p_variant_index: variantIndex,
      p_account_type: accountType,
    } as any);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    const res = data as { success: boolean; error?: string };
    if (!res.success) return toast.error(res.error || "Failed");
    toast.success("Submitted! Thank you.");
    fetchTask(code);
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const isDone = task && (task.status === "completed" || task.status === "verified");

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Task Portal";
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    let created = false;
    let prevContent: string | null = null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
      created = true;
    } else {
      prevContent = meta.getAttribute("content");
    }
    meta.setAttribute("content", "noindex, nofollow");
    return () => {
      document.title = prevTitle;
      if (created) meta?.parentNode?.removeChild(meta);
      else if (prevContent !== null) meta?.setAttribute("content", prevContent);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Task Portal</h1>
          <p className="text-sm text-muted-foreground">
            Enter your task code to begin.
          </p>
        </div>

        <Card className="p-4">
          {autoAssigning ? (
            <p className="text-sm text-muted-foreground">
              Finding an open task for you…
            </p>
          ) : (
            <>
              {!task && autoAssignFailed && (
                <p className="mb-3 text-sm text-muted-foreground">
                  No open tasks available right now. You can also enter a code
                  manually below.
                </p>
              )}
              <form onSubmit={handleLookup} className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Task code (e.g. AB12CD34)"
                  className="font-mono uppercase"
                />
                <Button type="submit" disabled={loading}>
                  {loading ? "Loading…" : "Open"}
                </Button>
              </form>
            </>
          )}
        </Card>

        {task && (
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{task.status}</Badge>
              {task.subreddit && (
                <span className="text-sm text-muted-foreground">
                  r/{task.subreddit}
                </span>
              )}
            </div>

            <div>
              <h2 className="font-semibold text-foreground">
                {task.thread_title || "Reddit thread"}
              </h2>
              <a
                href={task.thread_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Open the Reddit thread <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {task.notes && (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                <strong className="text-foreground">Note:</strong> {task.notes}
              </div>
            )}

            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-foreground">
              <p className="mb-1 font-semibold text-yellow-400">
                ⚠️ Read this before posting (avoid getting your comment removed)
              </p>
              <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                <li>
                  Use a Reddit account that is at least <strong>30 days old</strong>{" "}
                  with <strong>20–50+ comment karma</strong>. New / low-karma accounts
                  get auto-removed by Reddit's spam filter.
                </li>
                <li>
                  Before posting our comment, leave <strong>1–2 unrelated genuine
                  replies</strong> in the same subreddit so you don't look like spam.
                </li>
                <li>
                  After posting, <strong>open your comment in a private/incognito
                  window</strong>. If it doesn't show up there, it was filtered —
                  don't submit it.
                </li>
                <li>
                  Submissions are <strong>auto-checked</strong>: if Reddit removes
                  your comment within 6 hours it will be flagged and may not be
                  approved.
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label>Pick ONE comment variant and post it on the thread</Label>
              <div className="space-y-2">
                {task.suggested_comments.map((c, i) => (
                  <div
                    key={i}
                    className={`rounded-md border p-3 transition-colors ${
                      variantIndex === i
                        ? "border-primary bg-primary/5"
                        : "border-border bg-muted/30"
                    }`}
                    onClick={() => !isDone && setVariantIndex(i)}
                    role="button"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
                        <input
                          type="radio"
                          name="variant"
                          checked={variantIndex === i}
                          onChange={() => setVariantIndex(i)}
                          disabled={!!isDone}
                          className="h-3.5 w-3.5"
                        />
                        Variant {i + 1} {variantIndex === i && "(selected)"}
                      </label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setVariantIndex(i);
                          copy(c);
                        }}
                      >
                        <Copy className="mr-1 h-3 w-3" /> Copy
                      </Button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-foreground">
                      {c}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: clicking <strong>Copy</strong> auto-selects that variant.
              </p>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <div>
                <Label>Your worker name / ID</Label>
                <Input
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  placeholder="e.g. Microworkers username"
                />
                <details className="mt-2 rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none font-medium text-foreground">
                    Where do I find my Microworkers username?
                  </summary>
                  <p className="mt-2">
                    On your Microworkers Dashboard, your username appears at the
                    top next to your name (highlighted below). Copy that exact
                    username here.
                  </p>
                  <img
                    src={microworkersUsernameExample}
                    alt="Example showing where the Microworkers username appears on the dashboard"
                    className="mt-2 w-full rounded border border-border"
                  />
                </details>
              </div>

              {!isDone && task.status === "open" && (
                <Button onClick={handleClaim} className="w-full" variant="outline">
                  Claim this task
                </Button>
              )}

              {!isDone && (
                <>
                  <div>
                    <Label>Paste your posted comment URL</Label>
                    <Input
                      value={postedUrl}
                      onChange={(e) => setPostedUrl(e.target.value)}
                      placeholder="https://reddit.com/r/.../comment/..."
                    />
                    <details className="mt-2 rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
                      <summary className="cursor-pointer select-none font-medium text-foreground">
                        How do I get my comment URL?
                      </summary>
                      <p className="mt-2">
                        On your posted Reddit comment, tap <strong>Share</strong> →{" "}
                        <strong>Copy link</strong>, then paste it above.
                      </p>
                      <img
                        src={redditCopyLinkExample}
                        alt="Example showing the Share menu on a Reddit comment with Copy link highlighted"
                        className="mt-2 w-full rounded border border-border"
                      />
                    </details>
                  </div>
                  <div>
                    <Label>Reddit account type used</Label>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      {[
                        { key: "fresh", label: "Fresh / new account" },
                        { key: "aged", label: "Aged (30+ days, 20–50+ karma)" },
                      ].map((opt) => {
                        const checked = accountType === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setAccountType(opt.key as "fresh" | "aged")}
                            className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                              checked
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border bg-muted/30 text-muted-foreground"
                            }`}
                          >
                            <div className="font-medium">{opt.label}</div>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Be honest — aged accounts are tracked separately so we know which submissions are higher trust.
                    </p>
                  </div>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full"
                  >
                    {submitting ? "Submitting…" : "Submit completion"}
                  </Button>
                </>
              )}

              {isDone && (
                <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Submitted. Thank you!
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default WorkerRedditTaskPage;
