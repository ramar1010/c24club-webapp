import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Trash2, Pencil, ListChecks } from "lucide-react";
import { toast } from "sonner";

interface AdminTask {
  id: string;
  title: string;
  notes: string | null;
  category: string;
  priority: string;
  status: string;
  platform: string;
  created_at: string;
  completed_at: string | null;
}

const PRIORITIES = ["high", "medium", "low"];
const PLATFORMS = ["both", "web", "app"];
const CATEGORIES = ["general", "feature", "bug", "design", "marketing", "backend"];

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-muted text-muted-foreground",
};

const PLATFORM_COLORS: Record<string, string> = {
  both: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  web: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  app: "bg-green-500/20 text-green-400 border-green-500/30",
};

const emptyDraft = {
  title: "",
  notes: "",
  category: "general",
  priority: "medium",
  platform: "both",
};

const AdminChecklistPage = () => {
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ ...emptyDraft });
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  const loadTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_tasks")
      .select("*")
      .order("status", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Could not load your checklist");
    } else {
      setTasks((data || []) as AdminTask[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const visible = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === "open" && t.status === "done") return false;
      if (filter === "done" && t.status !== "done") return false;
      if (platformFilter !== "all" && t.platform !== platformFilter) return false;
      return true;
    });
  }, [tasks, filter, platformFilter]);

  const openCount = tasks.filter((t) => t.status !== "done").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  const openNew = () => {
    setEditingId(null);
    setDraft({ ...emptyDraft });
    setDialogOpen(true);
  };

  const openEdit = (task: AdminTask) => {
    setEditingId(task.id);
    setDraft({
      title: task.title,
      notes: task.notes || "",
      category: task.category,
      priority: task.priority,
      platform: task.platform,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!draft.title.trim()) {
      toast.error("Add a title first");
      return;
    }
    const payload = {
      title: draft.title.trim(),
      notes: draft.notes.trim() || null,
      category: draft.category,
      priority: draft.priority,
      platform: draft.platform,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase.from("admin_tasks").update(payload).eq("id", editingId);
      if (error) return toast.error("Could not save changes");
      toast.success("Task updated");
    } else {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("admin_tasks")
        .insert({ ...payload, created_by: userRes.user?.id ?? null });
      if (error) return toast.error("Could not add task");
      toast.success("Task added");
    }
    setDialogOpen(false);
    loadTasks();
  };

  const toggleDone = async (task: AdminTask) => {
    const nextDone = task.status !== "done";
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: nextDone ? "done" : "todo", completed_at: nextDone ? new Date().toISOString() : null }
          : t
      )
    );
    const { error } = await supabase
      .from("admin_tasks")
      .update({
        status: nextDone ? "done" : "todo",
        completed_at: nextDone ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id);
    if (error) {
      toast.error("Could not update task");
      loadTasks();
    }
  };

  const remove = async (task: AdminTask) => {
    const { error } = await supabase.from("admin_tasks").delete().eq("id", task.id);
    if (error) return toast.error("Could not delete task");
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    toast.success("Task deleted");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListChecks className="h-6 w-6" /> Checklist
          </h1>
          <p className="text-sm text-muted-foreground">
            {openCount} open · {doneCount} done
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> New task
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["open", "done", "all"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f}
          </Button>
        ))}
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {PLATFORMS.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : visible.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Nothing here yet. Add your first task.
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((task) => (
            <Card key={task.id} className="p-4 flex items-start gap-3">
              <Checkbox
                checked={task.status === "done"}
                onCheckedChange={() => toggleDone(task)}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <p
                  className={`font-medium break-words ${
                    task.status === "done" ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {task.title}
                </p>
                {task.notes && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                    {task.notes}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className={PRIORITY_COLORS[task.priority]}>
                    {task.priority}
                  </Badge>
                  <Badge variant="outline" className={PLATFORM_COLORS[task.platform]}>
                    {task.platform}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {task.category}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(task)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(task)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit task" : "New task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Task</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="What needs to be done?"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Optional details"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Priority</Label>
                <Select
                  value={draft.priority}
                  onValueChange={(v) => setDraft({ ...draft, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Platform</Label>
                <Select
                  value={draft.platform}
                  onValueChange={(v) => setDraft({ ...draft, platform: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select
                  value={draft.category}
                  onValueChange={(v) => setDraft({ ...draft, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{editingId ? "Save" : "Add task"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminChecklistPage;
