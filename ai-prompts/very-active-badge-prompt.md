# Native App Task: "Very Active" Badge on Discover Cards

Add an orange **⚡ Very Active** badge to Discover member cards, matching the web app exactly. No backend work needed — it's derived purely from `members.last_active_at`.

## 1. Data

- Source field: `members.last_active_at` (timestamptz, nullable) — already returned by the Discover query.
- `last_active_at` is refreshed by the existing 5-minute presence heartbeat.

## 2. Logic (must match web exactly)

```ts
const ONLINE_WINDOW_MS = 5 * 60 * 1000;       // existing "Online" rule
const VERY_ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

const realOnline = isOnlineNow(member.last_active_at);            // existing helper
const online = realOnline || (!isSelf && isFakeOnline(member.id, member.gender));

// Very Active = seen in the last 24h but NOT currently shown as online.
const isVeryActive =
  !online &&
  !!member.last_active_at &&
  Date.now() - new Date(member.last_active_at).getTime() < VERY_ACTIVE_WINDOW_MS;
```

Rules:
- **Online takes precedence.** Never render both badges on the same card.
- Applies to all genders, and to self-cards too (self just can't be fake-online).
- No badge if `last_active_at` is null or older than 24h.

## 3. Badge placement & style

Badges stack vertically in the **top-left** corner of the card, in this order:

1. `Online` (emerald, pulsing white dot)
2. `⚡ Very Active` (orange) ← new
3. `New` (amber, sparkles)
4. `Match!` (pink)
5. `Owner` / `VIP` / `Mod` / `You`

Very Active badge spec:
- Background: orange `#F97316` at 90% opacity, with a subtle drop shadow and backdrop blur.
- Text: white, bold, uppercase-off, label exactly `Very Active`.
- Icon: lightning bolt (Ionicons `flash`/Lucide `Zap`), filled, sits left of the label.
- Font size: 8px on small/mobile, 10px on larger screens.
- Padding: 6px horizontal, 2px vertical. Fully rounded pill.
- Icon size: 8px mobile / 10px larger, 2px gap between icon and text.

Reference (web/Tailwind):
```tsx
<span className="flex items-center gap-0.5 bg-orange-500/90 text-white text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full backdrop-blur-sm shadow-lg">
  <Zap className="w-2 h-2 sm:w-2.5 sm:h-2.5 fill-current" />
  Very Active
</span>
```

## 4. Freshness

The badge is computed at render time from `last_active_at`. Recompute whenever the Discover list refetches (pull-to-refresh / focus). No timer or realtime subscription required.

## 5. Acceptance checks

- A member active 3 minutes ago shows **Online** only — no Very Active badge.
- A member active 4 hours ago shows **⚡ Very Active** and no Online badge.
- A member active 3 days ago shows neither.
- A member with `last_active_at = null` shows neither.
- Badge order and spacing visually match the web Discover card.