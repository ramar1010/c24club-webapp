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

  useEffect(() => {
    if (codeFromUrl) fetchTask(codeFromUrl);
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
    setSubmitting(true);
    const { data, error } = await supabase.rpc("submit_reddit_task", {
      p_code: code.trim().toUpperCase(),
      p_worker_name: workerName.trim(),
      p_posted_url: postedUrl.trim(),
      p_variant_index: variantIndex,
    });
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
