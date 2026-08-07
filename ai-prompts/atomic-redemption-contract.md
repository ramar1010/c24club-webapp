# Atomic Redemption Contract (mobile app must use these — no client-side inserts/deducts)

Backend is unchanged and already atomic. The mobile app must STOP doing
`insert member_redemptions` + `update member_minutes` from the client for
rewards, store products, wishlist items and spin wins. Every one of those paths
already has a server action that (1) verifies eligibility, (2) deducts the
balance, (3) inserts the redemption row, (4) resets female `call_earned_minutes`
inside the same transaction, and (5) returns fresh balances.

All calls: `supabase.functions.invoke("redeem-reward", { body })` with the
user's auth session (Authorization: Bearer <access_token>). Errors come back
either as a non-2xx with `{ error: string }` or as 200 with `{ error: string }`
— check both.

## 1. Physical / product / store reward (also used for spin wins)

```ts
const { data, error } = await supabase.functions.invoke("redeem-reward", {
  body: {
    action: "create-redemption",
    rewardId: reward.id,                 // rewards.id (uuid)
    shipping: {                          // required for physical, omit for digital
      firstName, lastName, address, city, state, zip, country, notes
    },
    selectedColor: string | null,        // required if the reward has variants
    selectedSize: string | null,
  },
});
```

Response:
```json
{
  "success": true,
  "requiresPayment": false,          // true when a shipping fee applies (free for Premium VIP)
  "checkoutUrl": "https://...",      // present only when requiresPayment
  "redemptionId": "uuid",
  "balances": {
    "total_minutes": 0,
    "gifted_minutes": 0,
    "recharge_minutes": 0,
    "call_earned_minutes": 0,        // already reset to 0 for females on success
    "purchased_spins": 0,
    "ad_points": 0
  }
}
```
Failure examples (nothing deducted, nothing reset): `{"error":"Not enough minutes"}`,
`{"error":"Address Taken — ..."}`, `{"error":"Reward not found"}`.

If `requiresPayment` is true, open `checkoutUrl` in an external browser /
WebView; the redemption sits in `pending_payment` until Stripe confirms.

## 2. Instant rewards (Spins / Ad Points grants)

```ts
body: { action: "redeem-instant", rewardId }
```
Response: `{ success, grantAmount, grantType: "Spins" | "Ad Points", balances }`

## 3. Wishlist / goal item (guaranteed win)

```ts
body: { action: "redeem-wishlist", wishlistItemId, shipping, selectedColor, selectedSize }
```
Response: `{ success, redemptionId, requiresShipping: true, balances }`

## 4. Link-clicks free reward (no minutes cost)

```ts
body: { action: "create-free-redemption", rewardId, shipping }
```
Response: same shape as #1.

## 5. Legendary cash-out (Premium VIP only)

```ts
body: { action: "cashout-legendary", rewardId, paypalEmail }
```
Response: `{ success, cashoutAmount, balances }`

## 6. Gift cards — `redeem-giftcard`
Already server-side; keep as-is. Response includes the same `balances` object.

## 7. PayPal cash out — `request_cashout` RPC
Already server-side and transactional; keep as-is.

## Spin wheel — `spin-wheel`
`spin-wheel` (`{ type: "spin", use_purchased?: boolean }`) never inserts
`member_redemptions`. It only awards ad points / bonus minutes / unfreeze and
records `spin_results`. When a spin lands on a **physical item**, the app must
NOT insert a redemption itself — it must collect shipping and then call
`create-redemption` (#1) with the won `rewardId`. That single call does the
deduction, the insert and the `call_earned_minutes` reset atomically.
A second-chance re-spin that produces no win makes no call at all.

## Why this removes the race the builder flagged
The trigger `trg_reset_female_call_earned_on_redemption` fires AFTER INSERT on
`member_redemptions`, inside the edge function's transaction, which always runs
*after* the balance deduction. There is no window where the reset can commit
while a deduction fails — as long as the insert is not done from the client.
Client-side inserts are the only unsafe path, and they must be removed.

## App-side checklist
- `app/(tabs)/rewards.tsx` — replace insert+deduct with `create-redemption`
- `app/store/[id].tsx` — same
- `components/modals/RewardSpinModal.tsx` — on physical win, route to shipping → `create-redemption`
- Everywhere: use the returned `balances` object to update local state; do not
  recompute balances client-side.
