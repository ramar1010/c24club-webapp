# People-first Discover for web

## Goal
Reorder the responsive web Discover page so profile cards appear quickly, while preserving every existing profile action, safety rule, and account flow.

## Build
- Keep the compact sticky Discover header, then move DMs, cash out/refill when eligible, and listing removal into a responsive action row.
- Add a prominent full-width **Ready to Chat** card before filters.
  - Open a focused dialog with exactly Text, Video, and Both.
  - Require a choice, show a separate confirmation step, prevent repeat submissions, and surface loading/errors.
  - Call the deployed `ready-to-chat` function using the provided action contract.
  - Show only the returned notification count, selected mode, server expiry countdown, active styling, and Cancel.
  - Retain the active session safely across a browser refresh until its server-provided expiry.
- Compress the selfie/profile setup into one status row with its existing retake and profile-edit controls available on demand.
- Restore **Interested in You** directly below selfie status, collapsed by default so it does not push profiles down.
- Keep filters immediately above the profile grid and retain Linked, online, gender, country, sorting, infinite scrolling, badges, DMs, calls, gifting, blocking/reporting, and VIP behavior.
- Remove or relocate oversized promotional panels above the grid so people remain the visual focus.

## Technical details
- Add a dedicated web `ReadyToChatCard` component and use the existing design-system dialog/button controls.
- Keep all identity and recipient selection server-controlled; never send or render a recipient list.
- Make the deployed function accept the documented camel-case `sessionId` while remaining compatible with its existing snake-case input.
- Use server-returned `expires_at`, `mode`, and `recipient_count`; do not invent client expiry or counts.
- Keep this scoped to the React/Vite website and shared backend function only; no Expo/mobile client files will change.

## Verification
- Check the updated Discover experience at mobile (393×852), tablet, and desktop widths.
- Verify modal selection/confirmation, duplicate-click prevention, active countdown/cancel, compact setup rows, and early profile visibility.
- Check current diagnostics and the automated build after edits.
