# Fix Ready to Chat notification validation

## Changes
- Update the live validation function so an invite remains valid after it has been marked opened.
- Accept `both` as a backward-compatible availability check, while continuing to enforce a concrete `text` or `video` choice for the final action.
- Restrict resolving and validating to deliverable states so expired, failed, or skipped notifications cannot be reopened.
- Keep push expiry bounded to the remaining 15-minute Ready to Chat session and redeploy the function.

## Verification
- Confirm pending and already-opened invites validate correctly.
- Confirm expired/failed/skipped invites are rejected.
- Confirm `both` no longer creates a false unavailable result.
- Confirm the function still requires the signed-in recipient and preserves all existing rate limits.
