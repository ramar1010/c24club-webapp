# Sync prompt: Earnings card instead of daily DM spam

Backend is already updated on the shared Supabase project. Please mirror this in the native app.

## What changed on the backend

1. New table `public.female_earnings_snapshots` (one row per female user, always current):
   - `user_id` (uuid, PK)
   - `snapshot_date` (date, UTC)
   - `earned_today_minutes` (int)
   - `cashable_minutes` (int)
   - `near_limit_count` (int)
   - `near_limit_names` (text[])
   - `dm_message_id`, `dm_last_posted_at` (internal, used by the digest job)
   - `updated_at`
   - RLS: a signed-in user can `SELECT` only her own row. No client writes.

2. `female-earnings-digest` edge function (runs daily) now:
   - Upserts each woman's snapshot row every run.
   - Rewrites the SAME existing DM message in place instead of inserting a new one each day.
   - Only posts a brand new DM once every 7 days (weekly nudge).
   - Still sends the daily push notification, deduped per UTC day.

## What the app should do

1. **Pinned earnings card** at the top of the Messages list for female users:
   ```ts
   const { data } = await supabase
     .from("female_earnings_snapshots")
     .select("earned_today_minutes, cashable_minutes, near_limit_count, near_limit_names, updated_at")
     .eq("user_id", user.id)
     .maybeSingle();
   ```
   Show: today's earnings in dollars (`minutes * 0.01`), cashable balance in dollars, and an amber line when
   `near_limit_count > 0` listing up to 3 names from `near_limit_names`. Buttons: "Cash Out" (when
   `cashable_minutes > 0`) and "How to earn more" (opens the existing earn guide).

2. **Do not** create a new DM thread or new chat row for earnings. The single reusable message from the owner
   account is enough; it updates in place.

3. **Keep push notifications daily** — deep link `screen: "/messages"` as today.

4. Refresh the snapshot query on Messages screen focus so the card feels live.

## Verification
- Female user sees one earnings card, no growing stack of daily DMs.
- After the daily job runs, the card values change but the chat list does not gain a new message.
- Once a week a fresh earnings DM appears and bumps the owner conversation.
- A user cannot read another user's snapshot row.
