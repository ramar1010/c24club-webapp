import cashappIcon from "@/assets/socials/cashapp.png";
import tiktokIcon from "@/assets/socials/tiktok.png";
import instagramIcon from "@/assets/socials/instagram.png";
import snapchatIcon from "@/assets/socials/snapchat.png";
import venmoIcon from "@/assets/socials/venmo.png";
import paypalIcon from "@/assets/socials/paypal.png";
import discordIcon from "@/assets/socials/discord.png";

const SOCIAL_LINKS: Record<string, { icon: string; urlPrefix: string | null }> = {
  cashapp: { icon: cashappIcon, urlPrefix: "https://cash.app/" },
  tiktok: { icon: tiktokIcon, urlPrefix: "https://tiktok.com/@" },
  instagram: { icon: instagramIcon, urlPrefix: "https://instagram.com/" },
  snapchat: { icon: snapchatIcon, urlPrefix: "https://snapchat.com/add/" },
  discord: { icon: discordIcon, urlPrefix: null },
  venmo: { icon: venmoIcon, urlPrefix: "https://venmo.com/" },
  paypal: { icon: paypalIcon, urlPrefix: "https://paypal.me/" },
};

interface PinnedSocialsDisplayProps {
  pinnedSocials: string[];
}

const PinnedSocialsDisplay = ({ pinnedSocials }: PinnedSocialsDisplayProps) => {
  if (!pinnedSocials || pinnedSocials.length === 0) return null;

  const parsed = pinnedSocials
    .map((entry) => {
      const [platform, ...rest] = entry.split(":");
      const username = rest.join(":");
      if (!username || !SOCIAL_LINKS[platform]) return null;
      return { platform, username, ...SOCIAL_LINKS[platform] };
    })
    .filter(Boolean) as { platform: string; username: string; icon: string; urlPrefix: string | null }[];

  if (parsed.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      {parsed.map((s) => {
        // Strip leading @, $, / from username for URL
        const cleanUser = s.username.replace(/^[@$/]/, "");
        const url = s.urlPrefix + cleanUser;
        return (
          <a
            key={s.platform}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/40 hover:border-white hover:scale-110 transition-all shadow-lg"
            title={s.username}
          >
            <img src={s.icon} alt={s.platform} className="w-full h-full object-cover" />
          </a>
        );
      })}
    </div>
  );
};

export default PinnedSocialsDisplay;
