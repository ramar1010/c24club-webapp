import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminMenu } from "@/config/menu";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Shield, Loader2 } from "lucide-react";

interface ModeratorUser {
  user_id: string;
  member_name: string;
  member_email: string | null;
}

// Menu sections that can be assigned (exclude logout)
const ASSIGNABLE_SECTIONS = adminMenu
  .filter((m) => m.key !== "logout")
  .map((m) => ({ key: m.key, title: m.title }));

const ModeratorPermissionsPage = () => {
  const [moderators, setModerators] = useState<ModeratorUser[]>([]);
  const [permissions, setPermissions] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    // Fetch all moderator role entries
    const { data: modRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "moderator");

    const modUserIds = (modRoles || []).map((r: any) => r.user_id as string);

    if (modUserIds.length === 0) {
      setModerators([]);
      setPermissions({});
      setLoading(false);
      return;
    }

    // Fetch member info
    const { data: members } = await supabase
      .from("members")
      .select("id, name, email")
      .in("id", modUserIds);

    const memberMap = new Map((members || []).map((m: any) => [m.id, m]));
    const mods: ModeratorUser[] = modUserIds.map((uid) => {
      const m = memberMap.get(uid);
      return {
        user_id: uid,
        member_name: m?.name || "Unknown",
        member_email: m?.email || null,
      };
    });

    // Fetch all permissions
    const { data: perms } = await supabase
      .from("moderator_permissions")
      .select("user_id, menu_key")
      .in("user_id", modUserIds);

    const permMap: Record<string, Set<string>> = {};
    for (const uid of modUserIds) permMap[uid] = new Set();
    for (const p of perms || []) {
      if (permMap[p.user_id]) permMap[p.user_id].add(p.menu_key);
    }

    setModerators(mods);
    setPermissions(permMap);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (userId: string, menuKey: string, enabled: boolean) => {
    const key = `${userId}-${menuKey}`;
    setToggling(key);

    if (enabled) {
      const { error } = await supabase
        .from("moderator_permissions")
        .insert({ user_id: userId, menu_key: menuKey } as any);
      if (error && !error.message.includes("duplicate")) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setPermissions((prev) => {
          const next = { ...prev };
          next[userId] = new Set(next[userId]);
          next[userId].add(menuKey);
          return next;
        });
      }
    } else {
      const { error } = await supabase
        .from("moderator_permissions")
        .delete()
        .eq("user_id", userId)
        .eq("menu_key", menuKey);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setPermissions((prev) => {
          const next = { ...prev };
          next[userId] = new Set(next[userId]);
          next[userId].delete(menuKey);
          return next;
        });
      }
    }

    setToggling(null);
  };

  const toggleAll = async (userId: string, enable: boolean) => {
    for (const section of ASSIGNABLE_SECTIONS) {
      const has = permissions[userId]?.has(section.key);
      if (enable && !has) await toggle(userId, section.key, true);
      if (!enable && has) await toggle(userId, section.key, false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (moderators.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Moderator Permissions</h1>
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Shield className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">
            No moderators found. Assign the "moderator" role to users first via the{" "}
            <span className="font-medium text-foreground">User Roles</span> page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Moderator Permissions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control which admin panel sections each moderator can access.
        </p>
      </div>

      {moderators.map((mod) => {
        const userPerms = permissions[mod.user_id] || new Set();
        const allEnabled = ASSIGNABLE_SECTIONS.every((s) => userPerms.has(s.key));

        return (
          <div key={mod.user_id} className="rounded-lg border border-border bg-card overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
              <div>
                <p className="font-semibold text-foreground">{mod.member_name}</p>
                {mod.member_email && (
                  <p className="text-xs text-muted-foreground">{mod.member_email}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">All</span>
                <Switch
                  checked={allEnabled}
                  onCheckedChange={(v) => toggleAll(mod.user_id, v)}
                />
              </div>
            </div>

            {/* Permissions grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
              {ASSIGNABLE_SECTIONS.map((section) => {
                const key = `${mod.user_id}-${section.key}`;
                const enabled = userPerms.has(section.key);
                return (
                  <div
                    key={section.key}
                    className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 last:border-b-0"
                  >
                    <span className="text-sm text-foreground">{section.title}</span>
                    <Switch
                      checked={enabled}
                      disabled={toggling === key}
                      onCheckedChange={(v) => toggle(mod.user_id, section.key, v)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ModeratorPermissionsPage;
