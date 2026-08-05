# Sync Prompt: Recharge Minutes Economy + Female Earnings UX

Implement the following in the native app so it matches the web app. All backend
(Supabase) pieces already exist and are shared — do NOT re-create tables, columns,
RPCs, or edge functions. Only build the native UI + wire it to what's listed here.

---

## 1. Backend that already exists (reference only)

**Tables / columns**
- `member_minutes.recharge_minutes` (int) — a guy's purchased call-minute balance.
- `member_minutes.call_earned_minutes` (int) — raw call minutes a female has earned.
- `member_minutes.gifted_minutes` (int) — cashable balance ($0.01 per unit).
- `recharge_purchases` — one row per completed Stripe pack purchase.
- `cashout_settings.rate_per_minute` (default `0.01`) and
  `cashout_settings.call_rate_per_minute` (default `0.20`).

**RPCs**
- `add_recharge_minutes(p_user_id uuid, p_amount int) -> int`
- `spend_recharge_minutes(p_user_id uuid, p_amount int) -> (spent, remaining)`
- `atomic_increment_member_balances(p_user_id, p_total_amount, p_gifted_amount)`

**Edge functions**
- `recharge-minutes` — actions: `balance`, `checkout` (creates Stripe session),
  `verify` (confirms session and credits minutes).
- `earn-minutes` — during a Discover private call it spends the guy's
  `recharge_minutes` and credits the female.

---

## 2. Payout economics (the important part)

Two different rates, one shared cashable unit:

| Source | Rate | Notes |
|---|---|---|
| Discover private video call minutes | **$0.20 / min** | 20x credit |
| Gifted minutes | $0.01 / min | unchanged |
| Bounty (VIP conversion) minutes | $0.01 / min | unchanged |

Everything is stored in the same $0.01 cashable unit. So when a guy burns
1 recharge minute on a call, the female is credited
`spent * (call_rate_per_minute / rate_per_minute)` = **20 gifted minutes**
(= $0.20). Her raw call minutes are separately tracked in `call_earned_minutes`.

Example: guy buys the 20-minute pack ($6.99) and uses it all →
female receives 400 cashable minutes = **$4.00**.

Do NOT hardcode 20 in the client. Read both rates from `cashout_settings` and
compute the multiplier, defaulting to `0.01` / `0.20`.

---

## 3. Stripe minute packs (one-time payments)

| Pack | Price | Per minute |
|---|---|---|
| 20 call minutes | $6.99 | $0.350 |
| 60 call minutes | $17.99 | $0.300 |
| 150 call minutes | $34.99 | $0.233 |

Bigger packs are laddered so the per-minute price drops.

Web uses Stripe Checkout via the `recharge-minutes` edge function.
**On native, use IAP products instead** (App Store / Play Store require it for
digital goods). Create matching consumable IAP products, verify the receipt with
the existing `verify-iap-purchase` edge function, then credit via
`add_recharge_minutes`. Never open Stripe Checkout in an in-app webview for these.

---

## 4. Native UI to build

### 4a. Recharge gate on the call button
On each Discover member card, the video-call button for a **male** user must:
- show a small badge with his remaining `recharge_minutes`
  (green when > 0, red when 0);
- when balance is 0, open a **Recharge** sheet listing the three packs instead of
  starting the call;
- refresh the balance immediately after a successful purchase (broadcast the new
  balance app-wide so every card updates without a reload).

VIP status does NOT bypass the recharge requirement — VIP gates access, recharge
minutes pay for call time. Resolve VIP state from the database before showing any
VIP gate so a freshly granted VIP is never blocked by stale cache.

### 4b. "Earning right now" ticker (female, in-call)
Inside an active Discover private call, when the current user is female and the
partner is not female, show a live emerald ticker:

```text
Earning right now
+<sessionMinutes> cash minutes · <mm:ss> on call
$0.20 per call minute — stay on to keep earning
$<sessionCash>
```

- `sessionMinutes` = current `gifted_minutes` minus the value captured when the
  call started (baseline snapshot on mount).
- `sessionCash` = `sessionMinutes * 0.01`, formatted to 2 decimals.
- Poll her balance the same way the web `useCallMinutes` hook does.

### 4c. "Earn Money DMing Guys" guide
Replace the old linear slides with a **menu of 4 cards**; tapping one shows a
short, plain-language explanation:

1. **Convert guys to VIP** — he subscribes after talking to you, you get a bounty.
2. **Gifted minutes** — guys send you minutes directly.
3. **Video call recharges (new)** — guys buy call minutes; you earn $0.20 for
   every minute you're on a Discover video call with them.
4. **Cash out via PayPal** — turn cashable minutes into real money.

Also on this screen:
- a primary **"REDEEM MINUTES FOR CASH"** button (same flow as the profile cashout);
- a shortcut button into the **Girls Only Earnings Chat**;
- the main CTA is **"Start Chatting With Guys"** and routes to Discover
  (not to an earnings view).

### 4d. Profile
Show lifetime bounty history plus the new call earnings, using
`call_earned_minutes` for "minutes earned on calls" and `gifted_minutes` for the
cashable balance.

---

## 5. Acceptance checks

- Male with 0 recharge minutes cannot start a Discover call; buying a pack unblocks
  it and the badge updates without restarting the app.
- One minute of Discover call time increases the female's `gifted_minutes` by 20
  and `call_earned_minutes` by 1, and decreases the male's `recharge_minutes` by 1.
- Gift and bounty flows still credit at $0.01 — unchanged.
- Ticker cash value matches `gifted_minutes` delta / 100.
- Rates come from `cashout_settings`, so changing them in the DB changes the app.