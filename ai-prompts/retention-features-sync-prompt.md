# Sync prompt: Retention features (Empty Queue Bridge, M↔M suppression, Power Hour, Skip Recapture)

Backend is the existing Lovable/Supabase project (do NOT switch backends). All changes below are
already live on the server — the app only needs UI + calls.

## A. Empty Queue Bridge (client only)

### A1. Male auto-redirect to Discover after 10 seconds
If the waiting user is **male**, do not let them sit in an empty queue:

- After **10 seconds** in the random-chat "waiting" state with no match, automatically leave the
  queue (clean queue-row removal, cancel matching) and navigate them to the **Discover** tab
  filtered to girls (`gender ilike 'female'`, `is_discoverable = true`, `image_status = 'approved'`,
  order `last_active_at desc nulls last`).
- On arrival, immediately show a popup on Discover:
  - Title: "Nobody's in the queue right now"
  - Body: "Try DMing an active girl to get a chat going — she gets a notification instantly and can
    hop on a video call with you."
  - Primary button: "Message an active girl" → dismiss popup and scroll to the top of the list
    (most recently active girls first).
  - Secondary: "Back to random chat" → returns to the video tab and re-queues.
- Show this auto-redirect at most **once every 10 minutes** per user (persist a local timestamp) so
  it doesn't fight users who intentionally keep waiting.
- Females are NOT auto-redirected; they keep waiting and see the panel in A2.

### A2. Waiting panel (all other cases)
When the user has been in the random-chat "waiting" state for **20 seconds** with no match, show a
**centered popup modal** (not an inline box in the video frame), dismissable with an ✕:

- Query: `members` where `is_discoverable = true`, `image_status = 'approved'`,
  `gender ilike <opposite gender>`, `id != me`, `image_url not null`,
  order `last_active_at desc nulls last`, limit 6.
- Show a 3-column grid of photos with a **Message** button per card that opens the DM thread with
  that user (same deep link the Discover card uses).
- Copy: "It's quiet right now — don't leave. These {girls|guys} were online recently. Send a message
  and they get notified instantly."
- Footer button: "Browse everyone on Discover →".

## B. Male↔male suppression (backend already done — no app change needed)
`videocall-match` (type `join`) now matches in this order:
1. explicit VIP gender preference, 2. opposite gender, 3. same gender — but a **male↔male** pairing is
only allowed when the queued male has already waited **45+ seconds**.
App impact: guys may wait slightly longer before being paired with another guy. Do not add any
client-side re-join loop that deletes/reinserts the queue row, it resets the wait timer.
Optional UI: while waiting, show an encouraging "Wait time: 0:23 — holding out for a better match"
counter instead of a plain spinner.

## C. Power Hour invite popup (new table)
**Never show this during a connected call.** The point of Power Hour is to rescue users who can't
find anyone — interrupting a live conversation to advertise a future session hurts the exact
behavior we want. Show it only at "dead air" moments:

Triggers (whichever comes first, once per user per day — persist a `ph_invite_<YYYY-MM-DD>` flag):
1. **Empty queue, still waiting at 30 seconds** (i.e. the A2 waiting popup was dismissed or the user
   is a female who kept waiting), or
2. **Right after the user leaves the random chat tab / ends a session with no successful match**, or
3. **On the Discover popup from A1** — if the male was auto-redirected because the queue was empty,
   append a Power Hour line + "Save my spot" button to that same popup instead of a second modal.

Mutual exclusion: enforce a single `activePopup` value with priority
`SkipRecapture > EmptyQueueBridge > PowerHour`. While `callState === 'connected'`, all three are
suppressed except SkipRecapture (which only renders after the call has ended).

Data:
- Session times: `anchor_settings.power_hour_start` / `power_hour_end` (stored as UTC `HH:MM`).
  Compute the next upcoming start; if now is between start and end, it's LIVE.
- New table **`public.power_hour_optins`**: `id`, `user_id`, `session_date` (date, UTC date of the
  session start), `gender`, `created_at`, `updated_at`. Unique on `(user_id, session_date)`.
  RLS: any signed-in user can read all rows (for the counter); users insert/update/delete only their own.
- Social proof count: read rows for that `session_date`, count rows whose `gender` is the
  **opposite** of the viewer. Guys see "N girls already signed up for this session", girls see
  "N guys already signed up for this session".
- Join action: upsert `{ user_id, session_date, gender }` on conflict `(user_id, session_date)`.
  After success show "You're on the list — we'll ping you".

Popup content: ⚡ "Join the next Power Hour", subtitle "Everyone hops on at the same time so the room
is packed — no more empty queue", the local start time + a live countdown, the opposite-gender
counter, primary button "NOTIFY ME & SAVE MY SPOT", secondary "Keep chatting".

### Power Hour reminder notifications (3 pushes)
Send to every user in `power_hour_optins` for that `session_date`. All three deep link straight to
the random chat tab. Dedupe per user per session per stage (store a sent-stage key so a retry can't
double-send), and skip a stage if the user is already actively in a random chat.

| When | Title | Body |
| --- | --- | --- |
| **30 min before start** | ⚡ Power Hour starts in 30 minutes | "Get ready — {N} {girls\|guys} are signed up for tonight's session." |
| **5 min before start** | ⚡ Power Hour starts in 5 minutes | "Open the app now so you're in the queue the second it kicks off." |
| **At start (LIVE)** | ⚡ Power Hour is LIVE | "Guys and girls are hopping on right now — tap to join." |

Implementation: schedule local notifications on the device at opt-in time (so they fire even
offline) **and** have the server cron fire the same three stages as a backstop for users whose
local schedule was cleared. Cancel the local schedule if the user opts out.

## D. Skip Recapture (F)
When a random chat ends (skip or partner left) and:
- the call lasted **between 2 and 90 seconds**, and
- the partner is the **opposite gender**, and
- fewer than 3 recapture prompts have been shown this app session,

show a small modal with the partner's photo/name: "That was quick 👀 — Send {name} a message,
{her|him} gets a notification even after leaving." Primary button opens the DM thread with that
partner id; secondary "Keep swiping" dismisses and continues matching.

Do not block matching while the modal is up — the next search should keep running behind it.
