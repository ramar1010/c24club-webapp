import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface BanInfo {
  reason: string;
  ban_type: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isModerator: boolean;
  modPermissions: Set<string>;
  loading: boolean;
  banInfo: BanInfo | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  recheckBan: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [modPermissions, setModPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [banInfo, setBanInfo] = useState<BanInfo | null>(null);
  const ipCheckedRef = useRef(false);

  const ensureMemberRow = useCallback(async (authUser: User) => {
    const fallbackName =
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      authUser.email?.split("@")[0] ||
      "Member";

    const { error } = await supabase.from("members").upsert(
      {
        id: authUser.id,
        email: authUser.email ?? null,
        name: fallbackName,
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

    if (error) {
      console.warn("Failed to ensure member row:", error.message);
    }

    // Update last_active_at so Discover shows correct online status
    await supabase
      .from("members")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", authUser.id);
  }, []);

  const checkAdmin = useCallback(async (userId: string) => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roleSet = new Set((roles || []).map((r: any) => r.role as string));
    setIsAdmin(roleSet.has("admin"));
    const isMod = roleSet.has("moderator");
    setIsModerator(isMod);

    if (isMod && !roleSet.has("admin")) {
      const { data: perms } = await supabase
        .from("moderator_permissions")
        .select("menu_key")
        .eq("user_id", userId);
      setModPermissions(new Set((perms || []).map((p: any) => p.menu_key as string)));
    } else {
      setModPermissions(new Set());
    }
  }, []);

  const checkBan = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("user_bans")
      .select("reason, ban_type, created_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setBanInfo(data ? { reason: data.reason, ban_type: data.ban_type, created_at: data.created_at } : null);
  }, []);

  const recheckBan = useCallback(async () => {
    if (user) await checkBan(user.id);
  }, [user, checkBan]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      if (nextSession?.user) {
        void ensureMemberRow(nextSession.user);
      }

      // Fire welcome email on first signup
      if (event === "SIGNED_IN" && nextSession?.user) {
        const createdAt = new Date(nextSession.user.created_at).getTime();
        const now = Date.now();
        // Only trigger if account was created in the last 30 seconds (fresh signup)
        if (now - createdAt < 30_000) {
          supabase.functions.invoke("welcome-email", {
            body: { userId: nextSession.user.id },
          }).catch((err) => console.warn("Welcome email failed:", err));
        }
      }
    });

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);
      if (initialSession?.user) {
        void ensureMemberRow(initialSession.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [ensureMemberRow]);

  // Check IP ban on initial load (regardless of auth state)
  useEffect(() => {
    if (ipCheckedRef.current) return;
    ipCheckedRef.current = true;

    supabase.functions
      .invoke("check-ip-ban")
      .then(({ data }) => {
        if (data?.banned && !banInfo) {
          setBanInfo({
            reason: data.reason || "Your IP address has been banned",
            ban_type: data.ban_type || "standard",
            created_at: data.created_at || new Date().toISOString(),
          });
        }
      })
      .catch((err) => console.warn("IP ban check failed:", err));
  }, []);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setIsModerator(false);
      setModPermissions(new Set());
      setBanInfo(null);
      return;
    }

    const timeout = setTimeout(() => {
      checkAdmin(user.id);
      checkBan(user.id);
    }, 100);

    // Realtime: auto-show ban screen when a ban is inserted for this user
    const channel = supabase
      .channel(`ban-watch-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_bans",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (row.is_active) {
            setBanInfo({ reason: row.reason, ban_type: row.ban_type, created_at: row.created_at });
          }
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [user, checkAdmin, checkBan]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    return { error: error as Error | null };
  };

  const signOut = async () => {
    // Clean up anchor session before signing out
    if (user) {
      try {
        await supabase.functions.invoke("anchor-earning", {
          body: { type: "leave", userId: user.id },
        });
      } catch (e) {
        console.warn("Anchor cleanup on sign-out failed:", e);
      }
    }
    await supabase.auth.signOut();
    setIsAdmin(false);
    setIsModerator(false);
    setModPermissions(new Set());
    setBanInfo(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isModerator, modPermissions, loading, banInfo, signIn, signOut, recheckBan }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // During HMR the context can temporarily be undefined; reload to recover
    if (import.meta.hot) {
      window.location.reload();
    }
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
