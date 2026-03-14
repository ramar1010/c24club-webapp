import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PrivacyPolicyPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="sticky top-0 z-40 bg-[#1a1a1a]/95 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-white hover:text-orange-400 transition-colors">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-black tracking-wide uppercase" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Privacy Policy
        </h1>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-10 text-sm leading-relaxed text-neutral-300">
        <section>
          <h2 className="text-2xl font-black text-white mb-4">C24 Club Privacy Policy</h2>
          <p>
            This Privacy Policy describes how <strong className="text-white">Cyber Media Rush LLC</strong>, doing business as{" "}
            <strong className="text-white">C24 Club</strong>, collects, uses, and protects your personal information when you use our platform.
            By using C24 Club, you consent to the practices described in this policy.
          </p>
        </section>

        {/* Information Collection */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">1. Information Collection & Use</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>C24 Club collects users' names, email addresses, and shipping addresses (when redeeming physical rewards).</li>
            <li>Information is used to process and ship rewards, manage accounts, and improve our services.</li>
            <li>Users' addresses and contact information may be stored for future reward redemptions.</li>
          </ul>
        </section>

        {/* Third-Party Sharing */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">2. Third-Party Sharing</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Users' shipping information may be shared with third-party sellers solely for the purpose of shipping rewards.</li>
            <li>C24 Club uses third-party sites to provide gift cards as rewards.</li>
            <li>Promo data may be shared with third-party service providers for analytics, subject to confidentiality agreements.</li>
          </ul>
        </section>

        {/* Data Security */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">3. Data Security</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>C24 Club is committed to protecting the privacy and security of users' information with appropriate measures against unauthorized access or disclosure.</li>
            <li>All screenshots and user content submitted for challenges are handled in compliance with applicable privacy laws, including CCPA and GDPR.</li>
            <li>Screenshots and media files submitted for weekly challenges are retained for a maximum of 30 days and then permanently deleted.</li>
          </ul>
        </section>

        {/* Social/Pay App Privacy */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">4. Social/Pay App Privacy</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>When users pin social/pay apps, they acknowledge their personal information may be shared with or used by other users. C24 Club is not responsible for how others use this information.</li>
            <li>C24 Club cannot guarantee the security of interactions through pinned apps. Users should review third-party app privacy policies.</li>
            <li>By using the pinning feature, users consent to sharing their information and understand the associated risks.</li>
          </ul>
        </section>

        {/* Screen Recording & Privacy */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">5. Screen Recording & Privacy</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Users acknowledge that their interactions may be recorded by other users. C24 Club is not liable for privacy violations resulting from screen recordings by users with malicious intent.</li>
            <li>C24 Club does not assume responsibility for such interactions but will investigate and take action against violators where possible.</li>
            <li>Users are encouraged to report any suspicious or harmful behavior.</li>
          </ul>
        </section>

        {/* User Content and Screenshots */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">6. User Content & Screenshots</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>By using the video call feature, you acknowledge that other users may take screenshots or screen recordings for the purpose of participating in weekly challenges.</li>
            <li>These screenshots may be submitted to C24 Club and stored on our servers for challenge validation purposes.</li>
            <li>Submitted media will be deleted after challenge approval/disapproval or after a maximum of 30 days.</li>
          </ul>
        </section>

        {/* CCPA */}
        <div className="border-t border-white/10 pt-8">
          <h2 className="text-xl font-black text-white mb-4">California Consumer Rights (CCPA)</h2>
        </div>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">7. Your CCPA Rights</h3>
          <ul className="list-disc list-inside space-y-2">
            <li><strong className="text-white">Right to Know:</strong> You have the right to know what personal information we collect, the sources, the purpose, and the third parties with whom we share it.</li>
            <li><strong className="text-white">Right to Delete:</strong> You may request deletion of your personal information by contacting business@c24club.com. We will respond in accordance with CCPA regulations.</li>
            <li><strong className="text-white">Abuse of Deletion Rights:</strong> To prevent fraud, C24 Club may retain non-identifiable account activity logs and verify deletion requests through additional security measures. Requests found to be part of exploitation attempts may be denied and the account permanently banned.</li>
            <li><strong className="text-white">Right to Opt-Out:</strong> C24 Club does not currently sell personal information. If this changes, a "Do Not Sell My Personal Information" link will be provided.</li>
            <li><strong className="text-white">Right to Non-Discrimination:</strong> We will not discriminate against you for exercising any of your CCPA rights.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">8. Do Not Sell My Information</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>C24 Club does not currently sell personal information. If this policy changes, we will provide a clear "Do Not Sell My Personal Information" link on our homepage and notify users accordingly.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">9. Notice at Collection</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>At or before the point of collection of your personal information, we will provide you with a notice outlining your CCPA rights and how we intend to use your information.</li>
            <li>This notice will include the categories of personal information to be collected, the purpose, and whether we share it with third parties.</li>
          </ul>
        </section>

        {/* Protection of Minors */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">10. Protection of Minors</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>C24 Club does not knowingly collect personal information from users under the age of 18. If we become aware that a minor has provided personal information, we will delete it and terminate the account.</li>
            <li>Users misrepresenting their age do so in violation of our Terms & Conditions. C24 Club is not liable for resulting consequences.</li>
            <li>Parents and legal guardians are responsible for monitoring the online activity of minors.</li>
          </ul>
        </section>

        {/* Promo Feature Privacy */}
        <div className="border-t border-white/10 pt-8">
          <h2 className="text-xl font-black text-white mb-4">Promo Feature Privacy</h2>
        </div>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">11. Promo Data Collection</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>When users create promos, C24 Club collects the promo title, description, target URL, and targeting criteria (country, interest, gender).</li>
            <li>This information is used solely for displaying the promo to the appropriate audience.</li>
            <li>C24 Club does not share promo data with third parties except as necessary to deliver the promo.</li>
            <li>Users are responsible for ensuring any personal data in their promos complies with privacy laws.</li>
          </ul>
        </section>

        {/* Updates */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">12. Updates to This Policy</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>C24 Club may update this Privacy Policy from time to time to reflect changes in our practices or for legal/regulatory reasons.</li>
            <li>Users will be notified of significant changes through the platform.</li>
            <li>Continuing to use the website after changes constitutes acceptance of the updated policy.</li>
          </ul>
        </section>

        {/* Contact */}
        <div className="border-t border-white/10 pt-8">
          <section>
            <h3 className="text-lg font-bold text-orange-400 mb-2">Contact Information</h3>
            <p>If you have any questions or concerns about this Privacy Policy, please contact us at <strong className="text-white">business@c24club.com</strong>.</p>
          </section>
        </div>

        <p className="text-neutral-500 text-xs text-center pt-4 pb-8">© {new Date().getFullYear()} Cyber Media Rush LLC, d/b/a C24 Club. All rights reserved.</p>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
