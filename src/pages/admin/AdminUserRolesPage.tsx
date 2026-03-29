import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, UserPlus, Trash2, Search, Crown, ShieldCheck, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DeleteDialog from "@/components/admin/DeleteDialog";

type AppRole = "admin" | "moderator" | "user";

interface RoleEntry {
  id: string;
  user_id: string;
  role: AppRole;
  member_name?: string;
  member_email?: string;
}

const roleBadge: Record<AppRole, { icon: typeof Crown; color: string; label: string }> = {
  admin: { icon: Crown, color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "Admin" },
  moderator: { icon: ShieldCheck, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Moderator" },
  user: { icon: User, color: "bg-white/10 text-white/60 border-white/20", label: "User" },
};

const AdminUserRolesPage = () => {
  const queryClient = useQueryClient();
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("admin");
  const [deleteTarget, setDeleteTarget] = useState<RoleEntry | null>(null);

  // Fetch all role assignments with member info
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role")
        .order("role");

      if (error) throw error;

      // Fetch member info for all user_ids
      const userIds = (data || []).map((r) => r.user_id);
      const { data: members } = await supabase
        .from("members")
        .select("id, name, email")
        .in("id", userIds);

      const memberMap = new Map(
        (members || []).map((m) => [m.id, { name: m.name, email: m.email }])
      );

      return (data || []).map((r) => ({
        ...r,
        member_name: memberMap.get(r.user_id)?.name || "Unknown",
        member_email: memberMap.get(r.user_id)?.email || "—",
      })) as RoleEntry[];
    },
  });

  // Search member by email
  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ["search-member-email", searchEmail],
    enabled: searchEmail.length >= 3,
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select("id, name, email")
        .ilike("email", `%${searchEmail}%`)
        .limit(5);
      return data || [];
    },
  });

  // Add role
  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });
      if (error) {
        if (error.code === "23505") throw new Error("This user already has this role.");
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      setSearchEmail("");
      toast({ title: "Role assigned ✅" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Remove role
  const removeRole = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      setDeleteTarget(null);
      toast({ title: "Role removed 🗑️" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-amber-400" />
        <h1 className="text-2xl font-bold">User Roles</h1>
        <span className="text-sm text-muted-foreground">
          {roles.length} role{roles.length !== 1 ? "s" : ""} assigned
        </span>
      </div>

      {/* Add role section */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Assign Role
        </h2>
        <div className="flex gap-2 items-end flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="moderator">Moderator</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Search results dropdown */}
        {searchEmail.length >= 3 && (
          <div className="rounded-lg border bg-background max-h-48 overflow-y-auto">
            {searching ? (
              <p className="text-sm text-muted-foreground p-3">Searching...</p>
            ) : searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3">No members found</p>
            ) : (
              searchResults.map((m) => (
                <button
                  key={m.id}
                  onClick={() => addRole.mutate({ userId: m.id, role: selectedRole })}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent text-left transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <span className="text-xs text-primary font-medium">
                    + Assign {selectedRole}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Roles table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No roles assigned yet
                </TableCell>
              </TableRow>
            ) : (
              roles.map((r) => {
                const badge = roleBadge[r.role];
                const Icon = badge.icon;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.member_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.member_email}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${badge.color}`}
                      >
                        <Icon className="w-3 h-3" />
                        {badge.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(r)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation */}
      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removeRole.mutate(deleteTarget.id)}
        title={`${deleteTarget?.role} role from ${deleteTarget?.member_name}`}
        isPending={removeRole.isPending}
      />
    </div>
  );
};

export default AdminUserRolesPage;
