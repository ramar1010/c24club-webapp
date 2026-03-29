import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Helper to fetch all rows from a table, bypassing the 1000-row limit
async function fetchAllRows<T>(
  table: string,
  selectQuery: string,
  orderCol: string,
  ascending: boolean
): Promise<T[]> {
  const PAGE = 1000;
  let allRows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await (supabase as any)
      .from(table)
      .select(selectQuery)
      .order(orderCol, { ascending })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data as T[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return allRows;
}

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const members = await fetchAllRows<any>("members", "*", "created_at", false);

      const minutes = await fetchAllRows<any>("member_minutes", "user_id, total_minutes", "user_id", true);

      const minutesMap = new Map(minutes.map((m: any) => [m.user_id, m.total_minutes]));

      return members.map((member: any) => ({
        ...member,
        minutes: minutesMap.get(member.id) ?? 0,
      }));
    },
  });
}

export function useRewards() {
  return useQuery({
    queryKey: ["rewards"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rewards").select("*, reward_categories(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function usePromos() {
  return useQuery({
    queryKey: ["promos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("promos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useRewardCategories() {
  return useQuery({
    queryKey: ["reward_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reward_categories").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useMilestones() {
  return useQuery({
    queryKey: ["milestones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("milestones").select("*").order("unlock_minutes", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useMilestoneRewards(milestoneId?: string) {
  return useQuery({
    queryKey: ["milestone_rewards", milestoneId],
    enabled: !!milestoneId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milestone_rewards")
        .select("*, rewards(title, type, rarity)")
        .eq("milestone_id", milestoneId!);
      if (error) throw error;
      return data;
    },
  });
}

// Public hooks for store
export function usePublicRewards() {
  return useQuery({
    queryKey: ["public_rewards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rewards")
        .select("*, reward_categories(name)")
        .eq("visible", true)
        .order("minutes_cost", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function usePublicCategories() {
  return useQuery({
    queryKey: ["public_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_categories")
        .select("*")
        .eq("status", "active")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function usePublicMilestones() {
  return useQuery({
    queryKey: ["public_milestones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milestones")
        .select("*, milestone_rewards(*, rewards(id, title, type, rarity, image_url, minutes_cost))")
        .order("unlock_minutes", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

// --- Mutations ---

export function useDeleteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members"] }); toast.success("Member deleted"); },
    onError: (e: Error) => toast.error("Delete failed", { description: e.message }),
  });
}

export function useDeleteReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rewards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rewards"] }); toast.success("Reward deleted"); },
    onError: (e: Error) => toast.error("Delete failed", { description: e.message }),
  });
}

export function useDeletePromo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["promos"] }); toast.success("Promo deleted"); },
    onError: (e: Error) => toast.error("Delete failed", { description: e.message }),
  });
}

export function useCreateReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { error } = await supabase.from("rewards").insert(values as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rewards"] }); toast.success("Reward created"); },
    onError: (e: Error) => toast.error("Create failed", { description: e.message }),
  });
}

export function useUpdateReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Record<string, unknown> & { id: string }) => {
      const { error } = await supabase.from("rewards").update(values as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rewards"] }); toast.success("Reward updated"); },
    onError: (e: Error) => toast.error("Update failed", { description: e.message }),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { error } = await supabase.from("reward_categories").insert(values as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reward_categories"] }); toast.success("Category created"); },
    onError: (e: Error) => toast.error("Create failed", { description: e.message }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Record<string, unknown> & { id: string }) => {
      const { error } = await supabase.from("reward_categories").update(values as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reward_categories"] }); toast.success("Category updated"); },
    onError: (e: Error) => toast.error("Update failed", { description: e.message }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reward_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reward_categories"] }); toast.success("Category deleted"); },
    onError: (e: Error) => toast.error("Delete failed", { description: e.message }),
  });
}

export function useCreateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { error } = await supabase.from("milestones").insert(values as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["milestones"] }); toast.success("Milestone created"); },
    onError: (e: Error) => toast.error("Create failed", { description: e.message }),
  });
}

export function useDeleteMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("milestones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["milestones"] }); toast.success("Milestone deleted"); },
    onError: (e: Error) => toast.error("Delete failed", { description: e.message }),
  });
}
