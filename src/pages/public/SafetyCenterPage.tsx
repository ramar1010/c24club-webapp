import { Shield, Eye, Lock, AlertTriangle, UserX, Camera, Clock, MessageCircle, Phone, Ban } from "lucide-react";
import { Link } from "react-router-dom";

const SafetyCenterPage = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero */}
      <section className="relative px-4 py-16 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-green-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-full px-4 py-1.5 mb-6">
            <Shield className="w-4 h-4 text-green-400" />
            <span className="text-green-300 text-xs font-bold uppercase tracking-wider">Safety Center</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4">
            Your Safety Is Our <span className="text-green-400">Top Priority</span>
          </h1>
          <p className="text-white/60 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            C24 Club is built with multiple layers of protection to keep you safe while video chatting. Here's how our platform protects you and what you can do to stay safe.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 pb-20 space-y-12">

        {/* Built-in Protections */}
        <section>
          <h2 className="text-xl md:text-2xl font-black mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Lock className="w-4 h-4 text-green-400" />
            </div>
            Built-In Platform Protections
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                icon: Lock,
                title: "End-to-End Encrypted Calls",
                desc: "All video calls use WebRTC with mandatory DTLS-SRTP encryption. Your video and audio are encrypted in transit — not even C24 Club can see your call content.",
              },
              {
                icon: Eye,
                title: "4-Second Pre-Blur Shield",
                desc: "Every time you connect with a new partner, the remote video is blurred for 4 seconds. This gives you a safe transition period before you see or are fully visible to your match.",
              },
              {
                icon: Camera,
                title: "AI-Powered NSFW Detection",
                desc: "Our system uses AI moderation to detect inappropriate content in real time. Users who violate content rules receive automatic strikes and can be banned from the platform.",
              },
              {
                icon: Ban,
                title: "Automatic Ban System",
                desc: "Users who violate community rules are automatically flagged and banned. Repeated NSFW strikes lead to permanent bans. Some bans include IP-level blocking to prevent repeat offenders.",
              },
              {
                icon: Clock,
                title: "Quiet Hours Protection",
                desc: "During low-traffic periods, the platform notifies you and encourages scheduling sessions during busier, safer hours with more active moderation coverage.",
              },
              {
                icon: UserX,
                title: "One-Tap Reporting",
                desc: "During any video call, you can instantly report a user by tapping the report icon. Select a reason, add details, and our moderation team will review it promptly.",
              },
            ].map((item, i) => (
              <div key={i} className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <item.icon className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm mb-1">{item.title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tips for Users */}
        <section>
          <h2 className="text-xl md:text-2xl font-black mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            How to Stay Safe on C24 Club
          </h2>
          <div className="space-y-3">
            {[
              {
                title: "Never Share Personal Information",
                desc: "Don't share your real name, address, phone number, school, workplace, or any identifying details during video calls. Keep conversations fun but anonymous.",
              },
              {
                title: "Don't Show Your Face If You're Uncomfortable",
                desc: "C24 Club supports Voice Mode — you can chat with your camera off using an avatar. Use this if you ever feel uncomfortable showing your face.",
              },
              {
                title: "Skip Immediately If Something Feels Wrong",
                desc: "Trust your instincts. If a conversation makes you uncomfortable, hit the skip button immediately. There's no penalty for protecting yourself — you'll be matched with someone new right away.",
              },
              {
                title: "Report Inappropriate Behavior",
                desc: "Use the report button during any call to flag users who are being inappropriate, harassing, or breaking rules. Reports are reviewed by our moderation team and help keep the community safe.",
              },
              {
                title: "Don't Click Suspicious Links",
                desc: "If someone shares a link during a call or in messages, be cautious. Never click links from strangers that ask for personal information or downloads.",
              },
              {
                title: "Use Strong, Unique Passwords",
                desc: "Protect your C24 Club account with a strong password that you don't use on other sites. This prevents unauthorized access to your account and earned rewards.",
              },
              {
                title: "Be Aware of Screen Recording",
                desc: "While C24 Club prohibits unauthorized recording, you should always behave as if you could be recorded. Never do or show anything on camera that you wouldn't want shared publicly.",
              },
              {
                title: "Don't Send Money to Strangers",
                desc: "The only monetary features on C24 Club are official platform features like gifting minutes and purchasing VIP. Never send money, gift cards, or cryptocurrency to someone you met on the platform.",
              },
            ].map((item, i) => (
              <div key={i} className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 flex gap-3">
                <span className="text-amber-400 font-black text-sm mt-0.5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="font-bold text-sm mb-0.5">{item.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* For Parents */}
        <section>
          <h2 className="text-xl md:text-2xl font-black mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-blue-400" />
            </div>
            Age Requirement & Parental Notice
          </h2>
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 space-y-4">
            <p className="text-white/60 text-sm leading-relaxed">
              <strong className="text-white">C24 Club is strictly for users aged 18 and older.</strong> All users must confirm they are at least 18 years old before accessing the platform. We enforce this through our age gate verification during sign-up.
            </p>
            <p className="text-white/60 text-sm leading-relaxed">
              If you are a parent or guardian and believe your child has accessed C24 Club, please contact us immediately. We take underage usage very seriously and will promptly remove any accounts belonging to minors.
            </p>
            <p className="text-white/60 text-sm leading-relaxed">
              We recommend parents use parental control software to block access to random video chat platforms if they have minors in their household.
            </p>
          </div>
        </section>

        {/* What To Do If... */}
        <section>
          <h2 className="text-xl md:text-2xl font-black mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
              <Phone className="w-4 h-4 text-red-400" />
            </div>
            What To Do If Something Goes Wrong
          </h2>
          <div className="space-y-3">
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5">
              <h3 className="font-bold text-sm mb-2 text-red-300">If someone is being inappropriate:</h3>
              <p className="text-white/50 text-sm leading-relaxed">Skip the call immediately and use the report button. Our AI moderation system may have already flagged them, but your report helps confirm and speed up action.</p>
            </div>
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5">
              <h3 className="font-bold text-sm mb-2 text-red-300">If someone threatens you:</h3>
              <p className="text-white/50 text-sm leading-relaxed">End the call, report the user, and if you feel you are in immediate danger, contact your local law enforcement. C24 Club cooperates with authorities when required by law.</p>
            </div>
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5">
              <h3 className="font-bold text-sm mb-2 text-red-300">If you were banned unfairly:</h3>
              <p className="text-white/50 text-sm leading-relaxed">Bans are issued based on AI detection and user reports. If you believe your ban was a mistake, you may have the option to appeal through the unban process shown on your ban screen.</p>
            </div>
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5">
              <h3 className="font-bold text-sm mb-2 text-red-300">If someone asks for personal info or money:</h3>
              <p className="text-white/50 text-sm leading-relaxed">Never comply. This is likely a scam. Skip the call, report the user, and remember that C24 Club staff will never ask for your password, payment info, or personal details during a video call.</p>
            </div>
          </div>
        </section>

        {/* Community Standards Link */}
        <section className="text-center pt-4">
          <p className="text-white/40 text-sm mb-4">
            For full details on what's allowed and what's not, review our community guidelines.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/rules" className="inline-flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors">
              Site Rules
            </Link>
            <Link to="/terms" className="inline-flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors">
              Terms & Conditions
            </Link>
            <Link to="/privacy" className="inline-flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors">
              Privacy Policy
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SafetyCenterPage;
