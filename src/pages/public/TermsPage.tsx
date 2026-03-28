import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TermsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#1a1a1a]/95 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-white hover:text-orange-400 transition-colors">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-black tracking-wide uppercase" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Terms & Conditions
        </h1>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-10 text-sm leading-relaxed text-neutral-300">
        {/* Intro */}
        <section>
          <h2 className="text-2xl font-black text-white mb-4">C24 Club Terms & Conditions</h2>
          <p>
            This document, referred to as "Terms of Service," "Terms," or "Agreement," is a legally binding agreement between{" "}
            <strong className="text-white">Cyber Media Rush LLC</strong>, doing business as{" "}
            <strong className="text-white">C24 Club</strong> (referred to as "we," "us," or "ours"), and you, the user
            (referred to as "you," "your," or "user"). By accessing or using our website, you agree to comply with this
            Agreement, including our Privacy Policy and any other relevant policies on this page or other pages in this
            website domain.
          </p>
          <p className="mt-3">By using C24 Club, you confirm that you are at least 18 years of age, or older.</p>
          <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-red-400 font-bold text-xs uppercase tracking-wider mb-1">⚠️ WARNING</p>
            <p className="text-red-300 text-xs">
              If you are under 18 years of age, your access to this platform is strictly prohibited. By using C24 Club, you
              confirm that you meet the minimum age requirement. If we determine that you are under 18, we reserve the right
              to take immediate action, including notifying your legal guardians and potentially pursuing further legal
              measures.
            </p>
          </div>
        </section>

        {/* 1 */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">1. Gaining Access to and Using the Website</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>We grant you a non-exclusive, non-transferable, and revocable license to access and use the platform in accordance with these Terms.</li>
            <li>Your rights under this agreement cannot be transferred or assigned to others. Any attempt to do so is void.</li>
            <li>This agreement does not create any type of partnership, employment relationship, or agency between you and C24 Club.</li>
          </ul>
        </section>

        {/* 2 */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">2. Website Availability and Maintenance</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>C24 Club may be temporarily or permanently unavailable due to maintenance, updates, technical issues, or other reasons beyond our control. We are not responsible for any damages or losses during these periods.</li>
            <li>We reserve the right to modify, suspend, or discontinue the website at any time without prior notice.</li>
            <li>In the event of technical difficulties, we will take reasonable actions to restore the website's functionality as quickly as possible.</li>
          </ul>
        </section>

        {/* 3 */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">3. User Content Licensing</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>By submitting content on C24 Club (including text, audio, video, or any other material), you grant us a worldwide, non-exclusive, transferable, royalty-free license to use, modify, distribute, and display your content on our platform and through third-party websites, including for promotional and commercial purposes.</li>
            <li>While we have the right to use your content, you retain ownership of your content.</li>
            <li>You are responsible for ensuring that your content does not infringe on any third-party intellectual property rights, privacy rights, or any other applicable laws.</li>
          </ul>
        </section>

        {/* 4 */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">4. Malicious Activity</h3>
          <p className="mb-2">Users are prohibited from engaging in any malicious activities on the platform, including but not limited to:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Attempting to breach the security of the platform or test its vulnerabilities.</li>
            <li>Circumventing security measures implemented by us or third-party providers.</li>
            <li>Using automated bots, crawlers, or other tools to access or extract data from the website.</li>
            <li>Attempting to reverse-engineer any of the platform's software or systems.</li>
            <li>Disrupting or overloading the platform through attacks, spamming, or mail-bombing.</li>
            <li>Encouraging others to engage in any of the prohibited activities listed above.</li>
          </ul>
        </section>

        {/* 5 */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">5. Paid Products or Services</h3>
          <p className="mb-2">C24 Club offers paid products and services including VIP memberships, ad point packages, spin purchases, and unfreeze payments. By making a purchase, you agree to:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Provide accurate payment information.</li>
            <li>Ensure that you have read and understood the product or service description.</li>
            <li>Honor all charges incurred, including taxes and any applicable fees.</li>
            <li>Use only valid payment methods, and agree to pay all incurred charges even if the initial payment method fails.</li>
          </ul>
          <p className="mt-2">Paid products or services are non-transferable unless explicitly stated. All payments are subject to the terms outlined in our Refund Policy below.</p>
        </section>

        {/* 6 */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">6. External URLs</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>C24 Club may provide links to external websites and resources. We are not responsible for the content, security, or privacy practices of third-party sites.</li>
            <li>Users acknowledge that C24 Club is not liable for any damages or losses incurred as a result of accessing third-party links.</li>
          </ul>
        </section>

        {/* 7 */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">7. Embedding and Linking</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>You may provide links to or embed C24 Club on your own websites, provided that you do not remove or obscure any part of C24 Club content.</li>
            <li>Your site or application must not engage in illegal or inappropriate activities.</li>
            <li>You must immediately cease embedding or linking to C24 Club if we request you to do so.</li>
          </ul>
        </section>

        {/* 8 */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">8. Termination of Access</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Users who violate C24 Club's terms or rules may have their access limited, suspended, or permanently revoked without prior notice.</li>
            <li>C24 Club reserves the right to block users or IP addresses involved in prohibited activities.</li>
            <li>If your access is terminated, C24 Club is not liable for any damages or losses that may result from the restriction or termination of your account.</li>
          </ul>
        </section>

        {/* 9 */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">9. Limitation of Liability</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>C24 Club is not responsible for any actions taken by users on the platform, nor are we liable for any damages including service interruptions, data loss, hardware damage, virus infections, or unauthorized access.</li>
            <li>We are not liable for loss of business opportunities, income, profits, data, or any other type of loss.</li>
            <li>You agree to indemnify C24 Club and its employees against any claims or damages resulting from your actions on the platform.</li>
          </ul>
        </section>

        {/* 10 */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">10. Force Majeure</h3>
          <p>C24 Club is not liable for any delay or failure to perform obligations due to events outside of its reasonable control, including but not limited to natural disasters, strikes, acts of government, terrorism, pandemics, or other unforeseen events.</p>
        </section>

        {/* 11 */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">11. Amendments</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>We reserve the right to modify or amend the Terms of Service, Privacy Policy, and other agreements without prior notice.</li>
            <li>It is the user's responsibility to review the Terms regularly. Continuing to use the website after changes constitutes acceptance of the amended terms.</li>
          </ul>
        </section>

        {/* 12 */}
        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">12. Abuse and Complaints</h3>
          <p>Users can report incidents of abuse or improper use of the platform by contacting C24 Club at <strong className="text-white">business@c24club.com</strong> or through the in-app report feature during video calls.</p>
        </section>

        {/* === VIDEO CHATTING & MINUTES EARNING === */}
        <div className="border-t border-white/10 pt-8">
          <h2 className="text-xl font-black text-white mb-4">Video Chatting & Minutes Earning</h2>
        </div>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">13. Earning Minutes</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Users earn reward minutes by participating in video calls. For every 5 minutes spent in a video call, users earn reward minutes automatically.</li>
            <li>An earning cap exists per partner per session: standard members can earn up to 10 minutes per partner; VIP members can earn up to 30 minutes per partner. This cap resets each time you reconnect with the same partner and encourages diverse community engagement.</li>
            <li>Quick-skipping calls (disconnecting within seconds) reduces earning potential. The system rewards quality conversations.</li>
            <li>Minutes may be frozen if certain thresholds are met. Frozen users earn at a reduced rate until unfrozen (via VIP unfreezes or one-time unfreeze payments).</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">14. Ad Points</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Ad Points are earned automatically through active chatting, not through ad consumption. They are used to fuel promo campaigns on the platform.</li>
            <li>Ad Points can also be purchased as paid packages.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">15. Female Earning Bonus (Anchor Program)</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Female users may be eligible for the Anchor Earning program, which provides additional earning opportunities.</li>
            <li>Females earn cash at a higher rate while actively connected to a male user (active rate) and at a reduced rate while waiting/idle (idle rate). Both rates are configurable by administrators.</li>
            <li>Anchor earnings are subject to rules including: connecting with male users, greeting and chatting actively, and never disclosing that you are paid or rewarded to chat. Violation of these rules may result in a ban.</li>
            <li>No earning occurs during female-to-female calls. Normal minute earning is paused while the Anchor bonus is active.</li>
          </ul>
        </section>

        {/* === REWARDS === */}
        <div className="border-t border-white/10 pt-8">
          <h2 className="text-xl font-black text-white mb-4">Reward System</h2>
        </div>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">16. Reward Fulfillment</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Rewards are sourced from third-party sellers. C24 Club does not control shipping times, item quality, or accuracy of item descriptions.</li>
            <li>If an item is not delivered as per the tracking code, C24 Club will provide 400+ extra minutes or ad points as compensation, or allow users to rechoose their reward.</li>
            <li>If an item is out of stock, C24 Club may replace it with the best possible alternative or allow users to rechoose.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">17. Reward Rarities & Spin to Win</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Rewards come in different rarities: Common, Rare, and Legendary. Common items (Spins, Ad Points) are instant-redeem. Rare and Legendary items go through the Spin to Win mechanic.</li>
            <li><strong className="text-white">Reward Spins</strong> are automated spins triggered during high-rarity (Rare/Legendary) redemptions. <strong className="text-white">Daily Spins</strong> are available in the Events hub and can also be purchased.</li>
            <li>VIP members receive enhanced spin benefits including a second spin chance and the ability to spin for Legendary-tier prizes.</li>
            <li>C24 Club reserves the right to modify spin odds, prizes, and mechanics at any time.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">18. Shipping</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Shipping times and conditions are determined by third-party sellers.</li>
            <li>Users may be required to pay a shipping fee ranging from $0.99 to $2 for certain items. Premium VIP members get free shipping on all products.</li>
            <li>C24 Club is not responsible for lost items during shipping, shipping times, or item quality.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">19. Address Usage</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>The address provided by users will be used solely for shipping rewards.</li>
            <li>C24 Club may save the address on its website for future reward redemptions.</li>
            <li>Users must ensure their address details are accurate and up-to-date. Changes must be communicated promptly via business@c24club.com.</li>
          </ul>
        </section>

        {/* === VIP === */}
        <div className="border-t border-white/10 pt-8">
          <h2 className="text-xl font-black text-white mb-4">VIP Membership</h2>
        </div>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">20. VIP Subscription</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>C24 Club offers VIP membership tiers (Starter, Standard, Premium) with recurring billing via Stripe.</li>
            <li>VIP benefits include: extended earning caps (30 min per partner), gender selection, second spin chances, Legendary spin access, custom topics, free shipping (Premium), promo creation, pinned social/pay apps, and more.</li>
            <li>VIP subscriptions are non-transferable and auto-renew unless cancelled before the billing cycle ends.</li>
            <li>C24 Club reserves the right to modify VIP tier pricing, benefits, and availability at any time.</li>
          </ul>
        </section>

        {/* === ELIGIBILITY === */}
        <div className="border-t border-white/10 pt-8">
          <h2 className="text-xl font-black text-white mb-4">Eligibility & Participation</h2>
        </div>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">21. Eligibility</h3>
          <p className="mb-2">Users must comply with the eligibility criteria set forth by C24 Club. Any misuse of the reward system may result in disqualification and account suspension, including but not limited to:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Creating multiple accounts to claim multiple rewards or manipulate the system.</li>
            <li>Submitting false or fraudulent information during reward redemption.</li>
            <li>Using automated bots or scripts to participate in reward programs, spin features, or video calls.</li>
            <li>Engaging in deceptive practices such as exploiting promotional offers or loopholes.</li>
            <li>Sharing accounts or allowing others to use your account.</li>
            <li>Using VPNs, proxies, or other means to bypass geographic restrictions.</li>
            <li>Misuse of gift card redemption, including selling or transferring gift cards.</li>
            <li>Showing a black screen, pre-recorded video, or refusing to show your face during video calls to farm minutes.</li>
          </ul>
        </section>

        {/* === USER INTERACTIONS === */}
        <div className="border-t border-white/10 pt-8">
          <h2 className="text-xl font-black text-white mb-4">User Interactions & Liability</h2>
        </div>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">22. User Interactions</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>C24 Club is not responsible or liable for any user interactions on the platform, including communication, screen recordings, or any form of media capture by other users.</li>
            <li>Users are advised to exercise caution and discretion when interacting with others.</li>
            <li>C24 Club is not liable for misuse of screen recordings or other media captured by users for malicious intent.</li>
            <li>By using C24 Club, users agree to hold C24 Club harmless from any claims or damages arising from such interactions.</li>
            <li>The platform will investigate and take action against violators where possible.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">23. User Agreement to Screenshots</h3>
          <p>By participating in video calls on C24 Club, you consent to the possibility that other users may take screenshots of your video feed as part of their participation in weekly challenges.</p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">24. Weekly Challenges</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>C24 Club offers weekly challenges where users can earn bonus minutes by completing specific tasks during video calls.</li>
            <li>Challenge submissions (including screenshots or screen recordings) are stored for validation and will be deleted after approval/disapproval or after 30 days.</li>
            <li>Submission of proof does not guarantee acceptance or approval.</li>
          </ul>
        </section>

        {/* === SOCIAL/PAY APPS === */}
        <div className="border-t border-white/10 pt-8">
          <h2 className="text-xl font-black text-white mb-4">Social / Pay Apps</h2>
        </div>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">25. Pinning Social/Pay Apps</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>VIP users may pin social media and payment app profiles (e.g., CashApp, Instagram, PayPal, Venmo, Snapchat, TikTok) on their screen during video calls.</li>
            <li>Users are solely responsible for the information they share via pinned apps, including payment details and social media links.</li>
            <li>C24 Club is not responsible for any interactions, transactions, scams, fraud, or malicious activity that results from the use of pinned apps.</li>
            <li>Users agree to hold C24 Club harmless from any claims or damages arising from their interactions on these third-party platforms.</li>
            <li>Fraudulent activity conducted on the platform using these apps may lead to account suspension.</li>
          </ul>
        </section>

        {/* === PROMO FEATURE === */}
        <div className="border-t border-white/10 pt-8">
          <h2 className="text-xl font-black text-white mb-4">Promo Feature</h2>
        </div>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">26. Promo Creation and Ad Points</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>VIP users may create and submit promotions displayed to other users during video calls.</li>
            <li>Users allocate Ad Points to reach a specific number of viewers. C24 Club is not responsible for the effectiveness of promos.</li>
            <li>Promos can be targeted by country, interests, and gender. Targeting accuracy is not guaranteed.</li>
            <li>Promos must comply with all applicable laws and content guidelines. C24 Club reserves the right to reject, remove, or modify any promo that violates its policies.</li>
            <li>C24 Club is not liable for any damages or losses resulting from the promo feature.</li>
          </ul>
        </section>

        {/* === NSFW & BANS === */}
        <div className="border-t border-white/10 pt-8">
          <h2 className="text-xl font-black text-white mb-4">Content Moderation & Bans</h2>
        </div>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">27. NSFW Detection & Bans</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>C24 Club employs automated NSFW detection systems and black screen detection. Users displaying inappropriate content or black screens may receive strikes or be automatically banned.</li>
            <li>Bans may be temporary or permanent depending on the severity and frequency of violations.</li>
            <li>Banned users may have the option to pay an unban fee to regain access, subject to C24 Club's discretion.</li>
            <li>Users can report other users for inappropriate behavior directly from the video call interface.</li>
          </ul>
        </section>

        {/* === SECTION 230 === */}
        <div className="border-t border-white/10 pt-8">
          <h2 className="text-xl font-black text-white mb-4">Section 230 Protection</h2>
        </div>

        <section>
          <p className="mb-3">C24 Club operates under the protections granted by Section 230 of the Communications Decency Act (CDA) in the United States.</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong className="text-white">User-Generated Content:</strong> C24 Club does not take responsibility for user-generated content, including content shared during video chats, promos, and pinned social or payment app links.</li>
            <li><strong className="text-white">Immunity Limitations:</strong> This protection does not apply if the platform facilitates or encourages illegal activities, or knowingly allows content that violates applicable laws.</li>
            <li><strong className="text-white">Prohibited Content:</strong> Users are prohibited from sharing illegal, harmful, or inappropriate content. Violations will be investigated and may result in content removal and account suspension.</li>
            <li><strong className="text-white">Moderation:</strong> C24 Club cannot pre-screen all content but strives to identify and address violations quickly while complying with relevant laws.</li>
          </ul>
        </section>

        {/* === PRIVACY POLICY LINK === */}
        <div className="border-t border-white/10 pt-8">
          <section>
            <h3 className="text-lg font-bold text-orange-400 mb-2">Privacy Policy</h3>
            <p>For details on how we collect, use, and protect your personal information, please see our full <a href="/privacy" className="text-orange-400 underline hover:text-orange-300">Privacy Policy</a>.</p>
          </section>
        </div>

        {/* === REFUND POLICY === */}
        <div className="border-t border-white/10 pt-8">
          <h2 className="text-xl font-black text-white mb-4">Refund Policy</h2>
        </div>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">35. General Refund Policy</h3>
          <p>Refunds will generally not be issued once a service has been provided or a digital good has been delivered, including ad points, VIP memberships, spin purchases, promotional services, or unfreeze payments.</p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">36. Conditions for Refunds</h3>
          <ul className="list-disc list-inside space-y-1">
            <li><strong className="text-white">Technical issues:</strong> If a platform malfunction prevents use of a purchased service, a partial or full refund may be issued. Report within 3 days of purchase.</li>
            <li><strong className="text-white">Duplicate payments:</strong> A full refund for duplicate charges will be issued after verification.</li>
            <li><strong className="text-white">Non-delivery:</strong> If a paid service has not been delivered within the agreed timeframe, a refund may be requested, subject to review.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">37. Non-Refundable Situations</h3>
          <ul className="list-disc list-inside space-y-1">
            <li><strong className="text-white">Change of mind:</strong> No refunds once payment is made and service delivered.</li>
            <li><strong className="text-white">User negligence:</strong> Failure to use a purchased service within the available period or violating Terms.</li>
            <li><strong className="text-white">Misuse:</strong> Refunds will not be provided for abused or misused services.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">38. VIP Ban & Refund</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>VIP users banned for violating community guidelines receive no refund.</li>
            <li>VIP users banned due to error or non-violation may be eligible for a prorated refund.</li>
            <li>Users can submit an appeal within 7 days to business@c24club.com.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">39. Requesting a Refund</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Contact business@c24club.com with your account information, details of the service purchased, and the reason for your refund request.</li>
            <li>Refund requests will be reviewed within 7 business days.</li>
            <li>Approved refunds will be processed through the original payment method and may take up to 10 business days to appear.</li>
          </ul>
        </section>

        {/* SMS Text Messaging Terms */}
        <div className="border-t border-white/10 pt-8">
          <h2 className="text-xl font-black text-white mb-4">SMS Text Messaging Terms</h2>
        </div>

        <section>
          <h3 className="text-lg font-bold text-orange-400 mb-2">40. SMS Text Messaging Program</h3>
          <ul className="list-disc list-inside space-y-2">
            <li><strong className="text-white">Program Name:</strong> C24 Club Video Chat Alerts</li>
            <li><strong className="text-white">Program Description:</strong> C24 Club offers an optional SMS notification service that alerts opted-in users when another user wants to initiate a live video chat. Messages contain a time-limited link to join the call.</li>
            <li><strong className="text-white">Message Frequency:</strong> Message frequency varies. You may receive up to 10 text messages per day.</li>
            <li><strong className="text-white">Message & Data Rates:</strong> Message and data rates may apply. Please contact your wireless carrier for details about your text plan or data plan. You are solely responsible for all charges related to SMS/text messages, including charges from your wireless provider.</li>
            <li><strong className="text-white">Opt-In:</strong> By providing your phone number and checking the consent box in the app, you expressly consent to receive automated SMS messages from C24 Club. Consent is not required to use the platform.</li>
            <li><strong className="text-white">Opt-Out:</strong> You can opt out at any time by replying <strong className="text-white">STOP</strong> to any message or by toggling off SMS notifications in your account Settings. Upon opting out, you will receive one final confirmation message and no further texts will be sent.</li>
            <li><strong className="text-white">Help:</strong> For support, reply <strong className="text-white">HELP</strong> to any message or contact us at <strong className="text-white">business@c24club.com</strong>.</li>
            <li><strong className="text-white">Supported Carriers:</strong> Supported carriers may include, but are not limited to, AT&T, Verizon, T-Mobile, Sprint, and other major US carriers. C24 Club is not liable for delayed or undelivered messages.</li>
            <li><strong className="text-white">Privacy:</strong> Your phone number will not be sold, rented, or shared with third parties for marketing purposes. See our <a href="/privacy-policy" className="text-orange-400 underline hover:text-orange-300">Privacy Policy</a> for details.</li>
          </ul>
        </section>

        {/* Contact */}
        <div className="border-t border-white/10 pt-8">
          <section>
            <h3 className="text-lg font-bold text-orange-400 mb-2">Contact Information</h3>
            <p>If you have any questions or concerns about these Terms of Service, Privacy Policy, or Refund Policy, please contact us at <strong className="text-white">business@c24club.com</strong>.</p>
          </section>
        </div>

        <p className="text-neutral-500 text-xs text-center pt-4 pb-8">© {new Date().getFullYear()} Cyber Media Rush LLC, d/b/a C24 Club. All rights reserved.</p>
      </div>
    </div>
  );
};

export default TermsPage;
