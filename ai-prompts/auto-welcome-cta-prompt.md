# AI Builder Prompt: Auto Welcome DM + Earn Money CTA Button

## Objective
Update the auto welcome DM system for female users so it explains the 3-free-message limit, then render a prominent CTA button inside the owner's welcome message in the chat UI that opens the existing "Earn money DMing guys" bounty guide modal.

## 1. Backend: Auto Welcome DM Trigger

Modify the existing `auto_dm_welcome()` trigger function (or create a new migration for it) so it conditionally sends a gender-specific welcome message.

### Requirements
- Detect the new user's gender in a case-insensitive way: `lower(COALESCE(NEW.gender, ''))`.
- If the user is female, append a **Step 4** to the auto welcome DM.
- If the user is male or gender is not set, keep the existing 3-step welcome message.
- Prevent duplicate welcome DMs by checking `member_welcome_dm_log`.
- The function must be `SECURITY DEFINER` and set `search_path = public`.

### Female welcome message (Step 4)
```
Guys can only send 3 free messages before they must buy VIP to keep chatting — so a flirty follow-up often converts. Go to your profile or home page and tap "Earn money dming guys" to learn more.
```

### Male/non-female welcome message
Keep the existing 3-step message:
1. Start Chatting
2. Redeem minutes
3. Browse Discover

## 2. Frontend: CTA Button in MessagesPage

### Location
`src/pages/public/MessagesPage.tsx` (or equivalent public/private messages page that renders the DM conversation with the owner/admin).

### Owner/Admin Identifier
- Owner account ID: `d920b693-9e1a-4afc-8545-5e0a85704822` (or whatever the owner UUID is in the project; verify against `auth.users` / admin metadata)
- Owner email: `realsubify@gmail.com`
- Define a constant: `const OWNER_ID = "d920b693-9e1a-4afc-8545-5e0a85704822";`

### CTA Button Logic
- Inside the messages list, for every message:
  - Check if the message is from the owner: `msg.sender_id === OWNER_ID` (or `msg.sender === OWNER_ID` depending on the message type used in the codebase).
  - Check if the current user is female: `myGender === "female"` (read from the current user's profile; gender is case-insensitive, so normalize to lowercase before comparing).
  - Check if the message content indicates the welcome DM: case-insensitive match for `/welcome to c24 club/i`.
- If all three conditions are true, render a CTA button below that message.

### CTA Button Design
```tsx
<button
  onClick={() => setShowBountyGuide(true)}
  className="bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold py-2 px-4 rounded-full shadow-lg hover:shadow-emerald-500/50 transition-all"
>
  Earn money DMing guys
</button>
```

- The button must be rendered **inside the owner's message bubble/container**.
- Change the message container from a single flex row to `flex flex-col gap-2` so the button sits directly below the welcome text.
- The button should only appear on the owner's welcome message, not on every message from the owner.

## 3. Bounty Guide Modal

The CTA button must open the existing bounty guide modal by calling `setShowBountyGuide(true)` (the same state used elsewhere in the page). Do not create a new modal.

If the page does not already have `showBountyGuide` state and the `BountyGuideModal` component imported, then:
- Import the existing modal component: `import { BountyGuideModal } from "@/components/discover/BountyGuideModal";` (or wherever it lives in the project).
- Add state: `const [showBountyGuide, setShowBountyGuide] = useState(false);`
- Render it conditionally: `{showBountyGuide && <BountyGuideModal onClose={() => setShowBountyGuide(false)} />}`
- Ensure the modal already exists and explains the 3-message limit + why it's easy to convert guys.

## 4. Important Constraints
- Do **not** expose the service role key in the frontend.
- Gender comparisons must be case-insensitive (`toLowerCase()` in JS, `lower()` / `ilike()` in SQL).
- Do not modify the existing welcome DM log / duplicate prevention logic.
- No backend changes beyond the auto welcome DM trigger.
- No new native app code is required.

## 5. Testing Checklist
- Create a new female test user → receive Step 4 in the welcome DM.
- Open the DM conversation with the owner → see the green "Earn money DMing guys" CTA button below the welcome message.
- Click the button → the existing bounty guide modal opens.
- Create a male test user → receive the original 3-step welcome DM and no CTA button.
- Verify existing users who already received the welcome DM still see the CTA button (because it matches on "Welcome to C24 Club").

## 6. Files Typically Involved
- `supabase/migrations/YYYYMMDDHHMMSS_update_auto_dm_welcome_female_step.sql` — trigger function update
- `src/pages/public/MessagesPage.tsx` — CTA button rendering
- `src/components/discover/BountyGuideModal.tsx` — existing modal (do not edit unless its content is outdated)
