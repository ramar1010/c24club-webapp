# Native App Task: Girls Earnings Group Chat

Build a female-only group chat in the native app that reads/writes the **same backend table** the web app already uses. No new backend work is needed — everything below already exists in the database.

## 1. Table: `public.group_chat_messages`

| column | type | notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | null for system/earnings announcements |
| `body` | text | message text |
| `is_system` | boolean | true = auto earnings announcement, render as a centered green banner |
| `amount_cents` | integer | nullable; cash value of the event (bounty/gift/cashout) |
| `created_at` | timestamptz | sort ascending for display |
| `updated_at` | timestamptz | |

Realtime is already enabled on this table (`supabase_realtime` publication).

## 2. Access rules (enforced by RLS — mirror them in the UI)

A user can read and post **only** if they are:
- `members.gender ILIKE 'female'` AND `members.image_status = 'approved'` AND `members.image_url IS NOT NULL`
- …or has the `admin` / `moderator` role in `user_roles`.

There is a helper you can call: `select public.is_verified_female(auth.uid())` returns boolean.

Gate UI states to implement:
- **Not female** → "This group chat is for verified female members only."
- **Female, no selfie yet** (`image_url` null) → CTA button → Discover selfie flow → "Get Verified".
- **Female, selfie pending** (`image_status <> 'approved'`) → "Your selfie is under review. You'll get access as soon as it's approved."
- **Verified** → open chat.

Inserts must include `user_id = auth.uid()` and `is_system = false`, or RLS rejects them.

## 3. Queries

Initial load:
```ts
supabase.from('group_chat_messages')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(150)
// then reverse() for display
```

Author names/avatars — batch fetch, don't join:
```ts
supabase.from('members').select('id, name, image_thumb_url, image_url').in('id', authorIds)
```

Realtime:
```ts
supabase.channel('group-earnings-chat')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_chat_messages' }, handleInsert)
  .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_chat_messages' }, handleDelete)
  .subscribe()
```
Unsubscribe on unmount (`supabase.removeChannel`). Dedupe by `id` — the local optimistic row and the realtime echo can both arrive.

Send:
```ts
supabase.from('group_chat_messages').insert({ user_id: user.id, body: clean.slice(0, 500), is_system: false })
```

Delete own message: `.delete().eq('id', id)` (RLS allows author-only deletes).

## 4. Client-side sanitization (must match web exactly)

Before inserting, strip links / contact info so earners don't get poached off-platform. Replace each match with ` [removed] `, collapse whitespace, trim. If everything is removed, block the send with an error toast; if something was removed, send it but show a warning toast.

```ts
const BLOCK_PATTERNS = [
  /https?:\/\/\S+/gi,
  /\bwww\.\S+/gi,
  /\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi,
  /\b[\w-]+\.(com|net|org|io|co|me|ly|onlyfans|xyz|link)\b/gi,
  /(?:\+?\d[\s-]?){7,}/g,
  /(?:^|\s)@[A-Za-z0-9_.]{3,}/g,
];
```
Max length: 500 chars.

## 5. Auto-posted earnings events (already live — do NOT re-implement)

Database triggers insert `is_system = true` rows automatically. The native app just renders them:
- **Bounty awarded** (`bounty_earnings` insert) → `💸 Sofia just earned $10.00 — a guy she was chatting with went VIP!`
- **Gift completed** (`gift_transactions` → `completed`) → `🎁 Sofia was just gifted 400 minutes ($4.00)`
- **Cashout approved/paid** (`cashout_requests` status change) → `💵 Cashout approved: Sofia withdrew $25.00 to PayPal 🎉`

Only first names are used — never show emails or user IDs in this chat.

## 6. UI spec (match the web app)

- Header: `💸 Girls Earnings Chat` / subtitle `Verified female members only · no links or contact info`. Right side shows the summed `amount_cents` of loaded messages as a dollar total.
- System messages: centered, emerald border + emerald tint background, green bold text, relative timestamp below.
- Member messages: avatar + first name on the left for others; own messages right-aligned in a pink bubble. Relative timestamps (`now`, `5m`, `3h`, `2d`).
- Composer pinned to the bottom: rounded input + pink circular send button, Enter to send.
- Auto-scroll to the newest message.

## 7. Entry points

- Discover screen: green banner for female users → `💸 Girls Earnings Chat — see what other verified girls are making today`.
- Optional: entry on the Profile / earnings screen next to Bounty History.
- Optional: push notification when a system earnings message posts, throttled to at most one per few hours.

## 8. Acceptance checks

- A male account and an unverified female account both see the gate, not the messages.
- A verified female sees history + live updates without reloading.
- Pasting a link or `@handle` results in `[removed]` in the stored row.
- A real bounty award appears in both web and native chat within seconds of being written.
