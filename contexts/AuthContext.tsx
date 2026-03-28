import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

export interface MemberProfile {
  id: string;
  name: string;
  email: string;
  image_url: string | null;
  image_thumb_url: string | null;
  bio: string | null;
  gender: string | null;
  is_discoverable: boolean;
  notify_enabled: boolean;
  membership: string | null;
  title: string | null;
  birthdate: string | null;
  city: string | null;
  country: string | null;
  state: string | null;
  profession: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
  call_slug: string | null;
  zip: string | null;
  phone_number: string | null;
}

export interface MemberMinutes {
  id: string;
  user_id: string;
  total_minutes: number;
  ad_points: number;
  gifted_minutes: number;
  is_vip: boolean;
  chance_enhancer: number;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: MemberProfile | null;
  minutes: MemberMinutes | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  minutes: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [minutes, setMinutes] = useState<MemberMinutes | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // members.id === auth.uid() directly
      const { data: profileData } = await supabase
        .from("members")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (profileData) {
        console.log("Profile found, columns:", Object.keys(profileData).join(", "));
        setProfile(profileData as MemberProfile);
      } else {
        console.warn("No profile found for user:", userId);
        setProfile(null);
      }

      // Fetch minutes — member_minutes.user_id = auth user id
      const { data: minutesData } = await supabase
        .from("member_minutes")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (minutesData) {
        console.log("Minutes found, total_minutes:", minutesData.total_minutes);
        setMinutes(minutesData as MemberMinutes);
      } else {
        console.warn("No minutes record found for user:", userId);
        setMinutes(null);
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  }, []);

  const clearUserData = useCallback(() => {
    setProfile(null);
    setMinutes(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchUserData(user.id);
    }
  }, [user, fetchUserData]);

  useEffect(() => {
    // Safety net: if INITIAL_SESSION never fires (can happen on web), stop loading after 3s
    const timeout = setTimeout(() => setLoading(false), 3000);

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (event === "INITIAL_SESSION") {
          clearTimeout(timeout);
          if (newSession?.user) {
            await fetchUserData(newSession.user.id);
          }
          setLoading(false);
        } else if (event === "SIGNED_IN" && newSession?.user) {
          await fetchUserData(newSession.user.id);
        } else if (event === "SIGNED_OUT") {
          clearUserData();
        }
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.subscription.unsubscribe();
    };
  }, [fetchUserData, clearUserData]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      await supabase.auth.signOut({ scope: "local" });
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        minutes,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}