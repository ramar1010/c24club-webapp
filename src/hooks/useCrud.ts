import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
type TableName = keyof Tables;

export function useFetchAll<T extends TableName>(table: T) {
  return useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Tables[T]["Row"][];
    },
  });
}

export function useInsertRow<T extends TableName>(table: T) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Tables[T]["Insert"]) => {
      const { data, error } = await supabase.from(table).insert(row as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success("Created successfully");
    },
    onError: (e: Error) => toast.error("Create failed", { description: e.message }),
  });
}

export function useUpdateRow<T extends TableName>(table: T) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Tables[T]["Update"] & { id: string }) => {
      const { data, error } = await supabase.from(table).update(updates as any).eq("id", id as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success("Updated successfully");
    },
    onError: (e: Error) => toast.error("Update failed", { description: e.message }),
  });
}

export function useDeleteRow<T extends TableName>(table: T) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success("Deleted successfully");
    },
    onError: (e: Error) => toast.error("Delete failed", { description: e.message }),
  });
}
