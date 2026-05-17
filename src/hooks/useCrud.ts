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

// Lightweight count-only hook for dashboards / headers
export function useMembersCount() {
  return useQuery({
    queryKey: ["members_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("members")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });
}

export type MemberSourceFilter =
  | "all"
  | "all_vip"
  | "google_play_or_appstore"
  | "stripe"
  | "admin_granted"
  | "free";

// Server-side paginated members fetch with optional search + source filter.
// Avoids pulling the entire members table into the browser on every visit.
export function useMembersServerPage(params: {
  page: number;
  pageSize: number;
  search: string;
  sourceFilter: MemberSourceFilter;
}) {
  const { page, pageSize, search, sourceFilter } = params;
  return useQuery({
    queryKey: ["members_page", page, pageSize, search, sourceFilter],
    queryFn: async () => {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const safeSearch = search.trim().replace(/[%,()]/g, "");

      // Source filters that map directly to member_minutes columns:
      // paginate via member_minutes for an exact server-side filter + count.
      if (
        sourceFilter === "all_vip" ||
        sourceFilter === "stripe" ||
        sourceFilter === "admin_granted" ||
        sourceFilter === "google_play_or_appstore"
      ) {
        let mq = supabase
          .from("member_minutes")
          .select("user_id, total_minutes", { count: "exact" });
        if (sourceFilter === "all_vip") {
          mq = mq.eq("is_vip", true);
        } else if (sourceFilter === "stripe") {
          mq = mq
            .eq("is_vip", true)
            .not("stripe_customer_id", "is", null)
            .eq("admin_granted_vip", false);
        } else if (sourceFilter === "admin_granted") {
          mq = mq.eq("is_vip", true).eq("admin_granted_vip", true);
        } else if (sourceFilter === "google_play_or_appstore") {
          mq = mq
            .eq("is_vip", true)
            .is("stripe_customer_id", null)
            .eq("admin_granted_vip", false);
        }
        const { data: mm, count, error } = await mq.range(from, to);
        if (error) throw error;
        const ids = (mm ?? []).map((r: any) => r.user_id);
        if (ids.length === 0) return { rows: [], total: count ?? 0 };

        let membersQ = supabase.from("members").select("*").in("id", ids);
        if (safeSearch) {
          membersQ = membersQ.or(
            `name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,country.ilike.%${safeSearch}%`,
          );
        }
        const { data: members, error: mErr } = await membersQ;
        if (mErr) throw mErr;
        const minutesMap = new Map(
          (mm ?? []).map((r: any) => [r.user_id, r.total_minutes]),
        );
        const rows = (members ?? [])
          .map((m: any) => ({ ...m, minutes: minutesMap.get(m.id) ?? 0 }))
          .sort(
            (a: any, b: any) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          );
        return { rows, total: count ?? 0 };
      }

      // "all" or "free": paginate the members table directly.
      let q = supabase
        .from("members")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
      if (safeSearch) {
        q = q.or(
          `name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,country.ilike.%${safeSearch}%`,
        );
      }
      const { data: members, count, error } = await q.range(from, to);
      if (error) throw error;
      const ids = (members ?? []).map((m: any) => m.id);

      let mmRows: any[] = [];
      if (ids.length > 0) {
        const { data: mm } = await supabase
          .from("member_minutes")
          .select(
            "user_id, total_minutes, is_vip, admin_granted_vip, stripe_customer_id",
          )
          .in("user_id", ids);
        mmRows = mm ?? [];
      }
      const minutesMap = new Map(
        mmRows.map((r: any) => [r.user_id, r.total_minutes]),
      );
      let rows = (members ?? []).map((m: any) => ({
        ...m,
        minutes: minutesMap.get(m.id) ?? 0,
      }));

      // "free" = no VIP record / not VIP. Applied to the current page only.
      if (sourceFilter === "free") {
        const vipSet = new Set(
          mmRows.filter((r: any) => r.is_vip).map((r: any) => r.user_id),
        );
        rows = rows.filter((r: any) => !vipSet.has(r.id));
      }

      return { rows, total: count ?? 0 };
    },
    placeholderData: (prev: any) => prev,
    staleTime: 30_000,
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
      const { data, error } = await supabase.from("reward_categories").select("*").order("display_order", { ascending: true }).order("created_at", { ascending: false });
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
        .order("display_order", { ascending: true })
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["members_page"] });
      qc.invalidateQueries({ queryKey: ["members_count"] });
      toast.success("Member deleted");
    },
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
