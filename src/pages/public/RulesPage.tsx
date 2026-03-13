import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

const sections = [
  {
    title: "Promo Content",
    items: [
      "When creating promos, all rules outlined in this rulebook apply. Any violations within created promos will result in the same offense durations as those for video calls and general platform behavior.",
      'Never incentivize or use exploitative ways to get clicks. For example: "Click my link to get a gift from me" or "Click my link and I\'ll be your friend". This will result in a ban for 2 days!',
    ],
  },
  {
    title: "Age Restrictions",
    items: [
      "Minimum Age: You must have reached the age of majority (18+ in most countries) in your country to use C24 Club.",
    ],
  },
  {
    title: "Explicit Content and Behavior",
    items: [
      "No Sexual Acts or Nudity: Any sexual behavior, nudity, or explicit content is strictly forbidden during video calls. Violating this rule will result in an immediate ban.",
      "Avoid Inappropriate Language: Use respectful language. Sexually explicit or suggestive remarks are not allowed and will result in suspension or ban.",
    ],
  },
  {
    title: "Respectful Communication",
    items: [
      "No Harassment: Treat other users with kindness and respect. Bullying, threats, or harassment are not allowed and will lead to account suspension.",
      "Hate Speech: Racist, sexist, or other discriminatory language is not tolerated and will result in a suspension or ban.",
    ],
  },
  {
    title: "Privacy and Safety",
    items: [
      "Do Not Share Personal Information: Never share your address, phone number, or other personal details during video calls. This is for your own safety.",
      "No Unauthorized Recording: Recording or taking screenshots of video calls without permission is prohibited, except as part of platform challenges. Violations will result in account suspension.",
    ],
  },
  {
    title: "Prohibited Activities",
    items: [
      "No Violence or Threatening Behavior: Displaying weapons or threatening others in any way is strictly forbidden.",
      "No Illegal Activities: Discussions or displays of illegal activities, such as drug use, are not allowed and will result in an immediate ban or account suspension.",
    ],
  },
  {
    title: "Scams and Fraud",
    items: [
      "No Scamming: Attempting to scam other users or engage in fraudulent behavior is strictly prohibited and will result in immediate ban.",
    ],
  },
  {
    title: "Appropriate Attire",
    items: [
      "Dress Properly: Ensure you are dressed appropriately during video calls. No nudity, sexually suggestive clothing, or partial clothing removal (e.g., shirt off) is allowed and will result in account suspension or ban.",
    ],
  },
  {
    title: "Substance Use",
    items: [
      "No Alcohol or Drugs: Displaying or using alcohol or drugs during video calls is not allowed and may lead to account suspension or ban.",
    ],
  },
  {
    title: "Reporting Violations",
    items: [
      "Report Misconduct: If you encounter any behavior that violates these rules, use the reporting features to notify moderators.",
    ],
  },
  {
    title: "Multiple Offenses",
    items: [
      "Repeat Violators: Users who repeatedly violate these rules will be banned indefinitely.",
    ],
  },
];

const RulesPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col items-center px-4 pb-12">
      {/* Back button */}
      <div className="w-full flex items-center pt-3 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
        >
          <ChevronLeft className="w-7 h-7" />
          <span className="font-black text-sm tracking-wider">BACK</span>
        </button>
      </div>

      <h1 className="text-3xl font-black tracking-wide mt-2 mb-6">RULES</h1>

      <div className="w-full max-w-lg space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="text-lg font-black tracking-wide text-yellow-400 mb-2">
              {section.title}
            </h2>
            <div className="space-y-2">
              {section.items.map((item, i) => (
                <p
                  key={i}
                  className="text-sm text-neutral-300 leading-relaxed pl-3 border-l-2 border-neutral-700"
                >
                  {item}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RulesPage;
