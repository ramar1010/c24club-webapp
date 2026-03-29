

## Hard-Coded Weekly Challenges with Extensible Architecture

### Overview
Rewrite the WeeklyChallengesPage to render 3 hard-coded challenge cards (Bestie Challenge, Blue Eyes Hunt, Marathon Talk), each with a unique neon design and custom mechanics. The architecture uses a challenge registry pattern so adding future challenges is just adding an entry to an array — no structural changes needed.

### Architecture: Challenge Registry Pattern

A `CHALLENGE_CONFIGS` array defines each challenge with its slug, title, description, reward, difficulty, colors, icon, mechanic type (manual proof vs auto-tracked), max participants, and a custom React component or style config. The page iterates over this array to render cards. Adding a new challenge later = adding one object to the array.

```text
CHALLENGE_CONFIGS[]
  ├── bestie-challenge   (purple/pink neon, referral + duration, manual proof)
  ├── blue-eyes-hunt     (blue/cyan neon, screenshot snap, manual proof, max 3)
  ├── marathon-talk      (green/emerald neon, auto-tracked 60min, max 2)
  └── ... future challenges just add here
```

### Database Changes
- **Migration**: Add `slug TEXT UNIQUE` column to `weekly_challenges` table so hard-coded UI can match to DB records for submission tracking.
- Seed the 3 challenges with slugs: `bestie-challenge`, `blue-eyes-hunt`, `marathon-talk`.

### File Changes

**1. `src/pages/public/WeeklyChallengesPage.tsx`** — Full rewrite:
- Define `CHALLENGE_CONFIGS` array with all visual/behavioral config per challenge.
- Each card gets its own neon color scheme:
  - **Bestie Challenge**: purple-pink gradient, Users icon, "EASY" badge, $25 reward. Shows 3-day progress tracker (Day 1/2/3 with checkmarks). Referral link copy + proof submission.
  - **Blue Eyes Hunt**: blue-cyan gradient, Eye icon, "MEDIUM" badge, 15 min reward. "1/2 found" counter, screenshot upload/proof text, "Max 3 participants" indicator.
  - **Marathon Talk**: green-emerald gradient, Clock icon, "MEDIUM" badge, $35 reward. Timer/progress bar toward 60 min, auto-tracked status, "Max 2 participants" indicator.
- Each card rendered by mapping over configs, matching DB challenge by slug for submission status.
- Bottom section: **"CASH OUT MINUTES FOR CASH / REWARDS!"** neon gold banner that opens the CashoutModal or navigates to My Rewards.
- Still queries `challenge_submissions` table for user's submission status per challenge.

**2. `src/components/videocall/GrowthPanel.tsx`** — Minor update:
- Instead of querying DB for challenge previews, show the 3 hard-coded challenge names/rewards directly so the preview always shows content even if DB isn't seeded yet.

### Card Design (per challenge)
Each card includes:
- Unique gradient background + glowing border (like existing neon style)
- Shimmer animation overlay
- Difficulty badge (EASY/MEDIUM/HARD) color-coded
- Large reward display with neon glow
- Description text
- Progress indicator (custom per challenge type)
- Action button (Submit Proof / auto-tracked status)
- Max participants badge where applicable
- Submission status overlay when submitted (pending/approved/rejected)

### Extensibility
To add a 4th challenge later, just push another object to `CHALLENGE_CONFIGS` with its unique colors, icon, slug, and mechanic type. The rendering loop handles everything else. DB-driven challenges from the admin panel can still render below the hard-coded ones as a fallback section.

