import { ChevronLeft, Shield, AlertTriangle, Phone, Flag, Lock, Eye, Users } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

const CSAEPolicyPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-neutral-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1 hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="font-black text-lg tracking-wide">CSAE POLICY</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 pb-20 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-2">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-black tracking-wide">
            Child Sexual Abuse &amp; Exploitation (CSAE) Policy
          </h2>
          <p className="text-neutral-400 text-sm leading-relaxed max-w-lg mx-auto">
            C24 Club maintains a zero-tolerance policy against child sexual abuse and exploitation. The safety of minors is our highest priority.
          </p>
        </div>

        {/* Zero Tolerance */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <h3 className="font-bold text-base">Zero-Tolerance Policy</h3>
          </div>
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3 text-sm text-neutral-300 leading-relaxed">
            <p>
              C24 Club has an absolute zero-tolerance policy toward any form of child sexual abuse material (CSAM), child exploitation, grooming, or any conduct that endangers minors. This applies to all content shared, uploaded, or transmitted on our platform — including video calls, selfies, messages, and profile content.
            </p>
            <p>
              Any user found violating this policy will be <strong className="text-white">permanently banned immediately</strong> and reported to the appropriate law enforcement authorities, including the National Center for Missing &amp; Exploited Children (NCMEC).
            </p>
          </div>
        </section>

        {/* Age Requirements */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-400 shrink-0" />
            <h3 className="font-bold text-base">Age Requirements</h3>
          </div>
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3 text-sm text-neutral-300 leading-relaxed">
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>You must be <strong className="text-white">18 years or older</strong> to use C24 Club.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Users are required to confirm their age during signup. We reserve the right to request additional verification at any time.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Any account suspected of belonging to a minor will be suspended immediately pending investigation.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Prohibited Content */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-400 shrink-0" />
            <h3 className="font-bold text-base">Prohibited Content &amp; Conduct</h3>
          </div>
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3 text-sm text-neutral-300 leading-relaxed">
            <p>The following are strictly prohibited and will result in an immediate permanent ban and law enforcement referral:</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                <span>Sharing, uploading, requesting, or distributing child sexual abuse material (CSAM) in any form</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                <span>Soliciting or grooming minors for sexual purposes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                <span>Any sexual communication involving or directed at minors</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                <span>Sexualized depictions of minors, including AI-generated or illustrated content</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                <span>Attempting to circumvent age restrictions or verification systems</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                <span>Any conduct that facilitates, encourages, or normalizes the abuse or exploitation of children</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Detection & Prevention */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-400 shrink-0" />
            <h3 className="font-bold text-base">Detection &amp; Prevention Measures</h3>
          </div>
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3 text-sm text-neutral-300 leading-relaxed">
            <p>C24 Club employs multiple layers of protection to prevent CSAE on our platform:</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                <span><strong className="text-white">AI-Powered Monitoring:</strong> Automated detection systems scan video streams and uploaded images for inappropriate content in real time.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                <span><strong className="text-white">Human Moderation:</strong> Our moderation team manually reviews flagged content, reported users, and Discover selfies.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                <span><strong className="text-white">User Reporting:</strong> One-tap reporting during video calls and on profiles lets the community help identify violations quickly.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                <span><strong className="text-white">IP-Based Enforcement:</strong> Banned users are blocked at the IP level to prevent account recreation.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                <span><strong className="text-white">NCMEC Reporting:</strong> All identified CSAM is reported to the National Center for Missing &amp; Exploited Children (NCMEC) in compliance with federal law.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Reporting */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-green-400 shrink-0" />
            <h3 className="font-bold text-base">How to Report</h3>
          </div>
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3 text-sm text-neutral-300 leading-relaxed">
            <p>If you encounter any content or behavior on C24 Club that involves the exploitation of a child, please report it immediately:</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">•</span>
                <span><strong className="text-white">In-App:</strong> Use the report button during any video call or on a user's Discover profile.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">•</span>
                <span><strong className="text-white">Email:</strong> Contact us at <a href="mailto:safety@c24club.com" className="text-blue-400 underline">safety@c24club.com</a></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">•</span>
                <span><strong className="text-white">NCMEC CyberTipline:</strong> You can also report directly at <a href="https://report.cybertip.org" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">report.cybertip.org</a></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">•</span>
                <span><strong className="text-white">Law Enforcement:</strong> If a child is in immediate danger, call 911 or your local emergency number.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Cooperation */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400 shrink-0" />
            <h3 className="font-bold text-base">Law Enforcement Cooperation</h3>
          </div>
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3 text-sm text-neutral-300 leading-relaxed">
            <p>
              C24 Club fully cooperates with law enforcement agencies investigating child exploitation cases. We will provide relevant account data, IP addresses, and any other available information as required by law or in response to valid legal process.
            </p>
            <p>
              We are committed to working with organizations like NCMEC, the Internet Watch Foundation (IWF), and other child protection bodies to combat CSAE globally.
            </p>
          </div>
        </section>

        {/* Commitment Statement */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-center space-y-2">
          <p className="text-sm font-semibold text-red-300">
            Our Commitment
          </p>
          <p className="text-sm text-neutral-300 leading-relaxed">
            C24 Club is dedicated to maintaining a platform free from child exploitation. We continuously invest in technology, moderation, and partnerships to protect minors and hold violators accountable. This policy is reviewed and updated regularly to reflect evolving threats and best practices.
          </p>
        </div>

        {/* Footer links */}
        <div className="flex flex-wrap justify-center gap-4 text-xs text-neutral-500 pt-4">
          <Link to="/safety" className="hover:text-white transition-colors">Safety Center</Link>
          <Link to="/rules" className="hover:text-white transition-colors">Community Rules</Link>
          <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
        </div>

        <p className="text-center text-xs text-neutral-600">
          Last updated: April 2026
        </p>
      </div>
    </div>
  );
};

export default CSAEPolicyPage;
