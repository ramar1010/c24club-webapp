import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Turnstile } from "@marsidev/react-turnstile";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Video, X, Gift, MessageCircle, Megaphone, Clock, Zap, Star, DollarSign, Users } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import arrowRight from "@/assets/arrow-right.png";
import PublicNav from "@/components/public/PublicNav";
import PublicFooter from "@/components/public/PublicFooter";


import reward3 from "@/assets/rewards/optimized/reward3.webp";
import reward4 from "@/assets/rewards/reward4.jpeg";
import reward5 from "@/assets/rewards/reward5.jpg";
import reward6 from "@/assets/rewards/reward6.jpg";
import reward7 from "@/assets/rewards/reward7.jpg";
import bagImg from "@/assets/rewards/optimized/bag.webp";
import cashImg from "@/assets/rewards/cash.png";
import phonecase2 from "@/assets/rewards/optimized/phonecase-2.webp";
import bag3 from "@/assets/rewards/optimized/bag-3.webp";
import boots2 from "@/assets/rewards/optimized/boots-2.webp";

import slippers from "@/assets/rewards/optimized/slippers.webp";
import shorts2 from "@/assets/rewards/optimized/shorts-2.webp";
import hat2 from "@/assets/rewards/optimized/hat-2.webp";
import redbag2 from "@/assets/rewards/optimized/redbag-2.webp";
import heartbag2 from "@/assets/rewards/optimized/heartbag-2.webp";

const rewards = [
  { label: "Bucket Hat", minutes: 80, image: hat2 },
  { label: "Bag", minutes: 150, image: bag3 },
  { label: "Boots", minutes: 200, image: boots2 },
  { label: "Shorts", minutes: 100, image: shorts2 },
  { label: "Heart Bag", minutes: 95, image: heartbag2 },
  { label: "Phone Cases", minutes: 90, image: phonecase2 },
  { label: "Red Bag", minutes: 120, image: redbag2 },
  { label: "Slippers", minutes: 75, image: slippers },
  { label: "Designer Bag", minutes: 130, image: bagImg },
  { label: "Reward Item", minutes: 110, image: reward3 },
];

const leftSideRewards = [bag3, boots2, shorts2, heartbag2, reward3];
const rightSideRewards = [hat2, phonecase2, redbag2, slippers, bagImg];

const RewardCarousel = () => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let pos = 0;
    let animId: number;
    const speed = 0.5;
    const totalWidth = el.scrollWidth / 2;

    const animate = () => {
      pos -= speed;
      if (pos <= -totalWidth) pos += totalWidth;
      el.style.transform = `translateX(${pos}px)`;
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  const items = [...rewards, ...rewards];

  return (
    <div className="w-full overflow-hidden rounded-xl bg-gradient-to-r from-yellow-400 via-pink-500 to-pink-400 py-6 cursor-grab">
      <div ref={scrollRef} className="flex w-max will-change-transform">
        {items.map((r, i) => (
          <div key={i} className="flex-shrink-0 mx-3">
            <div className="w-40 h-40 rounded-2xl overflow-hidden shadow-lg">
              <img src={r.image} alt={r.label} className="w-full h-full object-cover" />
            </div>
            <p className="text-center text-white font-bold text-sm mt-2 drop-shadow">{r.minutes} Minutes</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const SideCard = ({ image }: { image: string }) => (
  <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-xl overflow-hidden shadow-md border border-white/10">
    <img src={image} alt="Reward" className="w-full h-full object-cover" />
  </div>
);

const MobileRewardSlider = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startPosRef = useRef(0);
  const animIdRef = useRef<number>(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const speed = 0.4;

    const getTotalWidth = () => el.scrollWidth / 2;

    const animate = () => {
      if (!pausedRef.current) {
        posRef.current -= speed;
        const tw = getTotalWidth();
        if (tw > 0 && posRef.current <= -tw) posRef.current += tw;
        el.style.transform = `translateX(${posRef.current}px)`;
      }
      animIdRef.current = requestAnimationFrame(animate);
    };
    animIdRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animIdRef.current);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    pausedRef.current = true;
    startXRef.current = e.clientX;
    startPosRef.current = posRef.current;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || !scrollRef.current) return;
    const delta = e.clientX - startXRef.current;
    const tw = scrollRef.current.scrollWidth / 2;
    let newPos = startPosRef.current + delta;
    if (tw > 0) {
      while (newPos <= -tw) newPos += tw;
      while (newPos > 0) newPos -= tw;
    }
    posRef.current = newPos;
    scrollRef.current.style.transform = `translateX(${newPos}px)`;
  };

  const handlePointerUp = () => {
    draggingRef.current = false;
    pausedRef.current = false;
  };

  const allRewardImages = [...leftSideRewards, ...rightSideRewards];
  const items = [...allRewardImages, ...allRewardImages];

  return (
    <div className="sm:hidden mt-5">
        <p className="text-center text-sm font-black text-yellow-300 uppercase tracking-wider mb-3">
        Rewards You Unlock By Chatting
      </p>
      <div
        className="overflow-hidden rounded-xl cursor-grab active:cursor-grabbing touch-pan-y"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div ref={scrollRef} className="flex w-max will-change-transform select-none">
          {items.map((img, i) => (
            <div key={i} className="flex-shrink-0 mx-1.5">
              <div className="w-20 h-20 rounded-xl overflow-hidden shadow-lg border border-white/10">
                <img src={img} alt="Reward" className="w-full h-full object-cover pointer-events-none" draggable={false} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── Sign-In Popup ─── */
const TURNSTILE_SITE_KEY = "0x4AAAAAACq2hFFseq9xTdN1";

const SignInPopup = ({ open, onClose, defaultSignUp = false }: { open: boolean; onClose: () => void; defaultSignUp?: boolean }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(defaultSignUp);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  useEffect(() => { setIsSignUp(defaultSignUp); setCaptchaToken(null); }, [defaultSignUp, open]);

  if (!open) return null;

  const handleGoogle = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (error) toast.error("Sign in failed", { description: String(error) });
  };

  const handleApple = async () => {
    const { error } = await lovable.auth.signInWithOAuth("apple", { redirect_uri: window.location.origin });
    if (error) toast.error("Sign in failed", { description: String(error) });
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password) {
      toast.error("Please enter email and password");
      return;
    }
    // CAPTCHA temporarily disabled for testing
    // if (!captchaToken) {
    //   toast.error("Please complete the CAPTCHA verification");
    //   return;
    // }
    setLoading(true);
    if (isSignUp) {
      const { error, data: signUpData } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) {
        toast.error("Sign up failed", { description: error.message });
      } else {
        // Track referral if code exists in URL
        const refCode = new URLSearchParams(window.location.search).get("ref");
        if (refCode && signUpData?.user?.id) {
          supabase.functions.invoke("referral", {
            body: { action: "track_signup", referral_code: refCode, new_user_id: signUpData.user.id },
          }).catch(() => {});
        }
        // Track bestie invite if code exists in URL
        const bestieCode = new URLSearchParams(window.location.search).get("bestie");
        if (bestieCode && signUpData?.user?.id) {
          supabase.functions.invoke("bestie-call", {
            body: { action: "accept_invite", invite_code: bestieCode, user_id: signUpData.user.id },
          }).catch((err) => console.error("Bestie accept failed:", err));
        }
        // Auto sign-in immediately so the homepage reflects logged-in state
        if (!signUpData?.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (signInError) {
            toast.success("Account created! Please check your email to verify, then sign in.");
            setLoading(false);
            onClose();
            return;
          }
        }
        toast.success("Account created!");
        onClose();
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        toast.error("Sign in failed", { description: error.message });
      } else {
        onClose();
      }
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative bg-[#2a2a2a] rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl border border-white/10" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-white/60 hover:text-white">
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-black text-white text-center mb-2 uppercase">{isSignUp ? "Sign Up for C24 Club" : "Sign In to C24 Club"}</h2>
        <p className="text-sm text-white/60 text-center mb-6">{isSignUp ? "Create your account to get started" : "Choose how you'd like to sign in"}</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={handleGoogle}
            className="flex items-center justify-center gap-3 w-full px-6 py-3.5 rounded-xl bg-white hover:bg-gray-100 text-gray-800 font-bold text-base shadow-lg transition-all hover:scale-[1.02]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Sign in with Google
          </button>
          <button
            onClick={handleApple}
            className="flex items-center justify-center gap-3 w-full px-6 py-3.5 rounded-xl bg-black hover:bg-gray-900 text-white font-bold text-base shadow-lg transition-all hover:scale-[1.02] border border-white/20"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
            Sign in with Apple
          </button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-white/20" />
            <span className="text-xs text-white/40 uppercase font-bold">or</span>
            <div className="flex-1 h-px bg-white/20" />
          </div>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-yellow-400 transition-colors text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-yellow-400 transition-colors text-sm"
          />
          {/* <div className="flex justify-center">
            <Turnstile
              siteKey={TURNSTILE_SITE_KEY}
              onSuccess={(token) => setCaptchaToken(token)}
              onError={() => setCaptchaToken(null)}
              onExpire={() => setCaptchaToken(null)}
              options={{ theme: "dark", size: "compact" }}
            />
          </div> */}
          <button
            onClick={handleEmailAuth}
            disabled={loading}
            className="w-full px-6 py-3.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-base shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            {loading ? "..." : isSignUp ? "Create Account" : "Sign In with Email"}
          </button>
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-white/50 hover:text-white/80 transition-colors text-center"
          >
            {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Onboarding Popup (name + gender) ─── */
const OnboardingPopup = ({ open, onComplete }: { open: boolean; onComplete: () => void }) => {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<string>("");
  const [foundVia, setFoundVia] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  if (!open) return null;

  const handleSubmit = async () => {
    if (!name.trim() || !gender) {
      toast.error("Please enter your name and select a gender");
      return;
    }
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("members")
      .upsert(
        {
          id: user.id,
          email: user.email ?? null,
          name: name.trim(),
          gender,
          found_us_via: foundVia || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    setSaving(false);
    if (error) {
      toast.error("Failed to save profile", { description: error.message });
      return;
    }
    toast.success("Welcome to C24 Club!");
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative bg-[#2a2a2a] rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl border border-white/10">
        <h2 className="text-xl font-black text-white text-center mb-2 uppercase">Set Up Your Profile</h2>
        <p className="text-sm text-white/60 text-center mb-6">Tell us a bit about yourself</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-white/80 mb-1">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-yellow-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-white/80 mb-2">Gender</label>
            <div className="flex gap-3">
              {["Male", "Female", "Other"].map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g.toLowerCase())}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border ${
                    gender === g.toLowerCase()
                      ? "bg-yellow-400 text-black border-yellow-400"
                      : "bg-white/10 text-white/70 border-white/20 hover:border-white/40"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-white/80 mb-2">How did you find us?</label>
            <div className="flex flex-wrap gap-2">
              {["Google", "TikTok", "Lemon8", "Reddit", "Other"].map((source) => (
                <button
                  key={source}
                  onClick={() => setFoundVia(source.toLowerCase())}
                  className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all border ${
                    foundVia === source.toLowerCase()
                      ? "bg-yellow-400 text-black border-yellow-400"
                      : "bg-white/10 text-white/70 border-white/20 hover:border-white/40"
                  }`}
                >
                  {source}
                </button>
              ))}
            </div>
          </div>


          <div className="border border-red-500/30 bg-red-950/30 rounded-xl px-4 py-3 text-center space-y-1">
            <p className="text-red-400 font-black text-xs tracking-wide">🔞 18+ ONLY</p>
            <p className="text-white/50 text-[11px] leading-snug">
              You must be <span className="text-white/80 font-bold">18+</span> to use this platform.
              Inappropriate behavior & explicit content are <span className="text-red-400 font-bold">strictly prohibited</span>.{" "}
              <a href="/rules" target="_blank" className="text-orange-400 font-bold hover:underline">Read Rules</a>
            </p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full mt-2 py-3.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-black text-base uppercase tracking-wide shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            {saving ? "Saving..." : (
              <>
                Enter C24 Club
                <img src={arrowRight} alt="" className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── CTA Buttons Component ─── */
const CTAButtons = ({ variant }: { variant?: "bottom" }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showSignIn, setShowSignIn] = useState(false);
  const [signInDefaultSignUp, setSignInDefaultSignUp] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const returnToHandledRef = useRef(false);

  // Auto-open sign-in popup if returnTo is present and user is not logged in
  useEffect(() => {
    const returnTo = searchParams.get("returnTo");
    if (returnTo && !user && !returnToHandledRef.current) {
      setSignInDefaultSignUp(false);
      setShowSignIn(true);
    }
  }, [searchParams, user]);

  useEffect(() => {
    if (!user) {
      setMemberName(null);
      setNeedsOnboarding(false);
      returnToHandledRef.current = false;
      return;
    }

    // If user just logged in and there's a returnTo param, redirect there
    const returnTo = searchParams.get("returnTo");
    if (returnTo && !returnToHandledRef.current) {
      returnToHandledRef.current = true;
      // Still check onboarding first
      const checkAndRedirect = async () => {
        const { data } = await supabase
          .from("members")
          .select("name, gender")
          .eq("id", user.id)
          .maybeSingle();
        if (data) {
          const hasProfile = data.name && data.name !== user.email && data.gender;
          if (!hasProfile) {
            setMemberName(null);
            setNeedsOnboarding(true);
            setShowOnboarding(true);
            return;
          }
        }
        navigate(returnTo, { replace: true });
      };
      checkAndRedirect();
      return;
    }

    const fetchMember = async (retries = 3) => {
      const { data } = await supabase
        .from("members")
        .select("name, gender")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        const hasProfile = data.name && data.name !== user.email && data.gender;
        setMemberName(hasProfile ? data.name : null);
        setNeedsOnboarding(!hasProfile);
        if (!hasProfile) setShowOnboarding(true);
      } else if (retries > 0) {
        // Member row may not exist yet (race with ensureMemberRow), retry
        setTimeout(() => fetchMember(retries - 1), 600);
      } else {
        // No member row after retries — show onboarding
        setMemberName(null);
        setNeedsOnboarding(true);
        setShowOnboarding(true);
      }
    };
    fetchMember();
  }, [user, searchParams, navigate]);

  const handleEnterClub = () => {
    if (needsOnboarding) {
      setShowOnboarding(true);
    } else {
      navigate("/videocall");
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setNeedsOnboarding(false);
    const returnTo = searchParams.get("returnTo");
    navigate(returnTo || "/videocall", { replace: true });
  };

  return (
    <>
      <SignInPopup open={showSignIn} onClose={() => setShowSignIn(false)} defaultSignUp={signInDefaultSignUp} />
      <OnboardingPopup open={showOnboarding} onComplete={handleOnboardingComplete} />

      <div className="flex flex-col items-center gap-3">
        {user ? (
          <>
            {memberName && (
              <p className="text-lg font-bold text-white italic">
                Welcome, {memberName}
              </p>
            )}
            <button
              onClick={handleEnterClub}
              className="group relative px-10 py-4 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-black text-lg uppercase tracking-wide shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
            >
              <span className="flex items-center gap-2">
                Enter C24 Club
                <img src={arrowRight} alt="" className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            <button
              onClick={signOut}
              className="px-8 py-3 rounded-full bg-green-500 hover:bg-green-600 text-white font-black text-sm uppercase tracking-wide shadow-lg transition-all transform hover:scale-105"
            >
              Sign Out
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => { setSignInDefaultSignUp(true); setShowSignIn(true); }}
              className="group relative px-10 py-4 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-black text-lg uppercase tracking-wide shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
            >
              <span className="flex items-center gap-2">
                Get Rewards Now
                <img src={arrowRight} alt="" className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </span>
              <span className="block text-sm font-bold text-yellow-300 mt-0.5">Sign Up Today</span>
            </button>
            <button
              onClick={() => { setSignInDefaultSignUp(false); setShowSignIn(true); }}
              className="px-8 py-3 rounded-full bg-green-500 hover:bg-green-600 text-white font-black text-sm uppercase tracking-wide shadow-lg transition-all transform hover:scale-105"
            >
              Sign In
            </button>
          </>
        )}
      </div>
    </>
  );
};

const HomePage = () => {
  return (
    <div className="relative">
      {/* JSON-LD Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "C24 Club",
            "url": "https://c24club.com",
            "description": "C24 Club is a free Omegle alternative where you video chat 1-on-1 with strangers and collect real rewards like gift cards and designer items.",
            "applicationCategory": "SocialNetworkingApplication",
            "operatingSystem": "Web",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.7",
              "ratingCount": "2400"
            },
            "sameAs": [
              "https://c24club.lovable.app"
            ]
          })
        }}
      />
      <PublicNav />

      {/* ===== HERO ===== */}
      <section className="pt-24 pb-12 px-4">
        <div className="text-center mb-8">
          <h1
            className="text-4xl md:text-6xl lg:text-7xl font-black uppercase leading-tight tracking-tight"
            style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}
          >
           <span className="text-white">C24 CLUB</span>
            <br />
            <span className="text-white">The Omegle Alternative</span>
            <br />
            <span className="text-yellow-300">With </span>
            <span className="bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">Real Rewards!</span>
          </h1>
          <p className="mt-4 text-lg md:text-xl font-bold text-white">
            Video Chat Online With Strangers & <span className="text-green-400">Unlock Rewards!</span>
          </p>
        </div>

        {/* Hero card with side rewards */}
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-1 lg:gap-2">
          <div className="hidden sm:flex flex-col gap-3">
            {leftSideRewards.map((img, i) => (
              <SideCard key={`l-${i}`} image={img} />
            ))}
          </div>

          <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl">
            <div className="relative w-full" style={{ paddingBottom: "100%" }}>
              <iframe
                src="https://streamable.com/e/od3g2c?autoplay=1"
                allow="autoplay; fullscreen"
                allowFullScreen
                className="absolute inset-0 w-full h-full border-0"
                title="C24 Club Video Chat Preview"
              />
            </div>
          </div>

          <div className="hidden sm:flex flex-col gap-3">
            {rightSideRewards.map((img, i) => (
              <SideCard key={`r-${i}`} image={img} />
            ))}
          </div>
        </div>

        <MobileRewardSlider />

        {/* CTA Buttons */}
        <div className="mt-8">
          <CTAButtons />
        </div>
      </section>

      {/* ===== STEPS ===== */}
      <section className="px-4 py-16 max-w-5xl mx-auto space-y-16">
        <div className="text-center space-y-3">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-400">More than just video chat</p>
          <h4 className="text-2xl md:text-3xl font-black text-white leading-snug" style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}>
            On C24Club, every chat <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">unlocks rewards</span><br />
            including perks & <span className="text-yellow-300">real prizes.</span>
          </h4>
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="w-8 h-px bg-gradient-to-r from-transparent to-orange-500" />
            <span className="text-orange-400 text-xs font-bold tracking-widest uppercase">Here's how it works</span>
            <span className="w-8 h-px bg-gradient-to-l from-transparent to-orange-500" />
          </div>
        </div>

        {/* Step 1 */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 rounded-3xl blur-lg opacity-40 group-hover:opacity-70 transition-opacity duration-500" />
          <div className="relative bg-[#1a1a2e] rounded-3xl p-8 md:p-10 border border-white/10 overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl" />
            
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/20 border border-orange-500/30">
                  <span className="text-orange-400 font-black text-sm">STEP 1</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}>
                  Video Chat With Anyone & <span className="text-yellow-400">Collect Minutes!</span>
                </h3>
                <p className="text-white/60 text-base leading-relaxed">
                  Jump into random video chats with people worldwide. Every minute you talk, you collect reward minutes. Have fun, meet new people, stack minutes.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                    <Clock className="h-4 w-4 text-orange-400" />
                    <span className="text-white/80 text-sm font-medium">1 min chatting = 1 min collected</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                    <Users className="h-4 w-4 text-orange-400" />
                    <span className="text-white/80 text-sm font-medium">Random matching</span>
                  </div>
                </div>
              </div>
              
              {/* Animated visual */}
              <div className="relative w-56 h-56 md:w-64 md:h-64 flex-shrink-0">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-orange-500/20 to-yellow-600/20 border border-orange-500/20 flex items-center justify-center">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/30 animate-pulse">
                      <Video className="h-10 w-10 text-white" />
                    </div>
                    <div className="absolute -top-3 -right-6 animate-bounce" style={{ animationDelay: '0s' }}>
                      <div className="w-10 h-10 rounded-full bg-yellow-500/90 flex items-center justify-center shadow-lg">
                        <Zap className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <div className="absolute -bottom-4 -left-5 animate-bounce" style={{ animationDelay: '0.5s' }}>
                      <div className="w-10 h-10 rounded-full bg-orange-500/90 flex items-center justify-center shadow-lg">
                        <Clock className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <div className="absolute top-1/2 -right-10 animate-bounce" style={{ animationDelay: '1s' }}>
                      <div className="w-8 h-8 rounded-full bg-red-500/90 flex items-center justify-center shadow-lg">
                        <Star className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 shadow-lg shadow-orange-500/30">
                  <span className="text-white font-black text-sm tracking-wide">+1 MIN ⏱️</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-pink-500 rounded-3xl blur-lg opacity-40 group-hover:opacity-70 transition-opacity duration-500" />
          <div className="relative bg-[#1a1a2e] rounded-3xl p-8 md:p-10 border border-white/10 overflow-hidden">
            <div className="absolute top-0 left-0 w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl" />
            
            <div className="flex flex-col md:flex-row-reverse items-center gap-8">
              <div className="flex-1 space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/30">
                  <span className="text-yellow-400 font-black text-sm">STEP 2</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}>
                  Redeem Minutes For <span className="text-yellow-400">Prizes & Rewards!</span>
                </h3>
                <p className="text-white/60 text-base leading-relaxed">
                  Head to the Reward Store and redeem your minutes for gift cards, designer bags, clothing, tech accessories, and way more.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                    <Gift className="h-4 w-4 text-yellow-400" />
                    <span className="text-white/80 text-sm font-medium">Gift cards & more</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                    <Gift className="h-4 w-4 text-yellow-400" />
                    <span className="text-white/80 text-sm font-medium">100+ rewards</span>
                  </div>
                </div>
              </div>
              
              {/* Reward grid visual */}
              <div className="relative w-56 h-56 md:w-64 md:h-64 flex-shrink-0">
                <div className="grid grid-cols-3 gap-2 h-full">
                  {[bagImg, bag3, boots2, reward3, hat2, phonecase2].map((img, i) => (
                    <div
                      key={i}
                      className="rounded-xl overflow-hidden border border-white/10 shadow-lg hover:scale-110 transition-transform duration-300 hover:border-yellow-400/50"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    >
                      <img src={img} alt="Reward" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 shadow-lg shadow-yellow-500/30">
                  <span className="text-white font-black text-sm tracking-wide">REDEEM 🎁</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 rounded-3xl blur-lg opacity-40 group-hover:opacity-70 transition-opacity duration-500" />
          <div className="relative bg-[#1a1a2e] rounded-3xl p-8 md:p-10 border border-white/10 overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-red-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />
            
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/20 border border-red-500/30">
                  <span className="text-red-400 font-black text-sm">STEP 3</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}>
                  Create Promos To <span className="text-orange-400">Reach More People!</span>
                </h3>
                <p className="text-white/60 text-base leading-relaxed">
                  Don't want to video chat? Create eye-catching promo posts that display between other users' sessions. Promote your brand, socials, or anything you want — reach thousands!
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                    <Megaphone className="h-4 w-4 text-orange-400" />
                    <span className="text-white/80 text-sm font-medium">Custom promos</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                    <MessageCircle className="h-4 w-4 text-orange-400" />
                    <span className="text-white/80 text-sm font-medium">Thousands of viewers</span>
                  </div>
                </div>
              </div>
              
              {/* Promo visual */}
              <div className="relative w-56 h-56 md:w-64 md:h-64 flex-shrink-0">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-600/20 border border-red-500/20 flex items-center justify-center">
                  <div className="relative">
                    <div className="w-44 bg-[#252535] rounded-2xl p-4 border border-orange-500/20 shadow-xl shadow-orange-500/10 transform -rotate-2 hover:rotate-0 transition-transform duration-500">
                      <div className="w-full h-20 rounded-lg bg-gradient-to-br from-orange-400/30 to-red-400/30 mb-3 flex items-center justify-center">
                        <Megaphone className="h-8 w-8 text-orange-300" />
                      </div>
                      <div className="h-2 w-3/4 bg-white/20 rounded-full mb-2" />
                      <div className="h-2 w-1/2 bg-white/10 rounded-full mb-3" />
                      <div className="flex gap-1">
                        <div className="h-6 flex-1 rounded-md bg-orange-500/40 flex items-center justify-center">
                          <span className="text-[10px] text-white font-bold">Visit Link</span>
                        </div>
                      </div>
                    </div>
                    <div className="absolute -top-4 -right-4 animate-bounce" style={{ animationDelay: '0.3s' }}>
                      <div className="px-2 py-1 rounded-full bg-red-500/90 shadow-lg">
                        <span className="text-[10px] text-white font-bold">❤️ 2.4k</span>
                      </div>
                    </div>
                    <div className="absolute -bottom-3 -left-3 animate-bounce" style={{ animationDelay: '0.8s' }}>
                      <div className="px-2 py-1 rounded-full bg-orange-500/90 shadow-lg">
                        <span className="text-[10px] text-white font-bold">👁 5.1k</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full bg-gradient-to-r from-red-500 to-orange-500 shadow-lg shadow-red-500/30">
                  <span className="text-white font-black text-sm tracking-wide">CREATE 🚀</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="pt-8">
          <CTAButtons variant="bottom" />
        </div>
      </section>

      {/* Omegle Alternatives CTA Section */}
      <section className="px-4 py-12 max-w-4xl mx-auto">
        <div className="relative rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-yellow-500/5 p-8 text-center overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl" />
          <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-400 mb-2">
            Looking for Omegle alternatives?
          </p>
          <h2
            className="text-2xl md:text-3xl font-black text-white mb-3"
            style={{ fontFamily: "'Antigone', 'Poppins', sans-serif" }}
          >
            See How C24 Club Compares To <span className="text-yellow-400">Other Platforms</span>
          </h2>
          <p className="text-white/50 text-sm mb-6 max-w-lg mx-auto">
            We ranked the top 5 Omegle alternatives. Spoiler: C24 Club is #1 because we're the only one with a built-in rewards program.
          </p>
          <Link
            to="/top-omegle-alternatives"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-black text-sm uppercase tracking-wide shadow-lg transition-all hover:scale-105"
          >
            View Top 5 Omegle Alternatives →
          </Link>
        </div>
      </section>

      {/* 18+ Warning */}
      <div className="max-w-3xl mx-auto px-4 mt-16 mb-8">
        <div className="border border-red-500/30 bg-red-950/20 rounded-2xl px-6 py-5 text-center space-y-2">
          <p className="text-red-400 font-black text-lg tracking-wide">🔞 18+ ONLY</p>
          <p className="text-neutral-300 text-sm leading-relaxed">
            You must be <span className="text-white font-bold">18 years or older</span> to use this platform.
            By signing up, you confirm you meet this age requirement.
            Inappropriate behavior, explicit content, and harassment are <span className="text-red-400 font-bold">strictly prohibited</span> and will result in a permanent ban.
          </p>
          <a href="/rules" className="inline-block text-orange-400 font-bold text-sm hover:underline mt-1">
            Read our Community Rules →
          </a>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
};

export default HomePage;
