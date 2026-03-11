import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Pencil, Check, X, FolderPlus } from "lucide-react";
import DeleteDialog from "@/components/admin/DeleteDialog";

function useTopicCategories() {
  return useQuery({
    queryKey: ["admin_topic_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topic_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

function useTopics() {
  return useQuery({
    queryKey: ["admin_topics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("*, topic_categories(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

const TopicsPage = () => {
  const qc = useQueryClient();
  const { data: categories = [], isLoading: catLoading } = useTopicCategories();
  const { data: topics = [], isLoading: topicLoading } = useTopics();

  // Category form
  const [newCatName, setNewCatName] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");

  // Topic form
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicCatId, setNewTopicCatId] = useState("");
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicName, setEditTopicName] = useState("");

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{ type: "category" | "topic"; id: string; name: string } | null>(null);

  // Mutations
  const createCategory = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("topic_categories").insert({ name });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_topic_categories"] }); toast.success("Category created"); setNewCatName(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("topic_categories").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_topic_categories"] }); qc.invalidateQueries({ queryKey: ["admin_topics"] }); toast.success("Updated"); setEditingCatId(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("topic_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_topic_categories"] }); qc.invalidateQueries({ queryKey: ["admin_topics"] }); toast.success("Category deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createTopic = useMutation({
    mutationFn: async ({ name, category_id }: { name: string; category_id: string }) => {
      const { error } = await supabase.from("topics").insert({ name, category_id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_topics"] }); toast.success("Topic created"); setNewTopicName(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTopic = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("topics").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_topics"] }); toast.success("Updated"); setEditingTopicId(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTopic = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("topics").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_topics"] }); toast.success("Topic deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "category") deleteCategory.mutate(deleteTarget.id);
    else deleteTopic.mutate(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Topics Management</h1>

      {/* === CATEGORIES === */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FolderPlus className="w-5 h-5" /> Topic Categories
        </h2>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="New category name..."
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            className="max-w-xs"
          />
          <Button
            size="sm"
            onClick={() => newCatName.trim() && createCategory.mutate(newCatName.trim())}
            disabled={!newCatName.trim()}
          >
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>

        {catLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : (
          <div className="border rounded-lg divide-y">
            {categories.map((cat: any) => (
              <div key={cat.id} className="flex items-center justify-between px-4 py-3">
                {editingCatId === cat.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editCatName}
                      onChange={(e) => setEditCatName(e.target.value)}
                      className="max-w-xs"
                    />
                    <Button size="icon" variant="ghost" onClick={() => editCatName.trim() && updateCategory.mutate({ id: cat.id, name: editCatName.trim() })}>
                      <Check className="w-4 h-4 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingCatId(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium">{cat.name}</span>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditingCatId(cat.id); setEditCatName(cat.name); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget({ type: "category", id: cat.id, name: cat.name })}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-muted-foreground text-sm px-4 py-3">No categories yet.</p>
            )}
          </div>
        )}
      </section>

      {/* === TOPICS === */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Topics</h2>
        <div className="flex gap-2 mb-4 flex-wrap">
          <Select value={newTopicCatId} onValueChange={setNewTopicCatId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat: any) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="New topic name..."
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            className="max-w-xs"
          />
          <Button
            size="sm"
            onClick={() => newTopicName.trim() && newTopicCatId && createTopic.mutate({ name: newTopicName.trim(), category_id: newTopicCatId })}
            disabled={!newTopicName.trim() || !newTopicCatId}
          >
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>

        {topicLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : (
          <div className="border rounded-lg divide-y">
            {topics.map((topic: any) => (
              <div key={topic.id} className="flex items-center justify-between px-4 py-3">
                {editingTopicId === topic.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editTopicName}
                      onChange={(e) => setEditTopicName(e.target.value)}
                      className="max-w-xs"
                    />
                    <Button size="icon" variant="ghost" onClick={() => editTopicName.trim() && updateTopic.mutate({ id: topic.id, name: editTopicName.trim() })}>
                      <Check className="w-4 h-4 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingTopicId(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="font-medium">{topic.name}</span>
                      <span className="text-muted-foreground text-xs ml-2">({topic.topic_categories?.name})</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditingTopicId(topic.id); setEditTopicName(topic.name); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget({ type: "topic", id: topic.id, name: topic.name })}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {topics.length === 0 && (
              <p className="text-muted-foreground text-sm px-4 py-3">No topics yet. Create a category first, then add topics.</p>
            )}
          </div>
        )}
      </section>

      {/* Delete confirmation */}
      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete ${deleteTarget?.type}`}
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
      />
    </div>
  );
};

export default TopicsPage;
