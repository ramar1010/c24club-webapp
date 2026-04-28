---
name: TURN/ICE Server Configuration
description: Cloudflare TURN service used for WebRTC NAT traversal, ephemeral creds via edge function
type: feature
---
WebRTC connections require TURN relay for users behind symmetric NATs (mobile carriers, corporate networks). Without working TURN, peers see grey/black screens because no media path is established.

**Provider**: Cloudflare Realtime TURN (free up to 1 TB/month).

**Secrets**:
- `CLOUDFLARE_TURN_TOKEN_ID` — TURN app Token ID from dash.cloudflare.com → Calls
- `CLOUDFLARE_TURN_API_TOKEN` — TURN app API Token (shown once at creation)

**Implementation**: `supabase/functions/get-ice-servers/index.ts` calls `https://rtc.live.cloudflare.com/v1/turn/keys/{TOKEN_ID}/credentials/generate-ice-servers` with `ttl: 3600` to get per-session credentials. Response includes STUN + TURN over UDP/TCP/TLS on ports 3478, 53, 80, 443, 5349 for max NAT compatibility.

**Cache-Control**: `no-store` — ephemeral credentials must not be cached by CDN/proxy.

**Legacy fallback**: If `CLOUDFLARE_TURN_*` secrets are missing, falls back to Metered static creds (`METERED_TURN_HOST/USERNAME/CREDENTIAL`) — but Metered creds were verified non-functional in 2026-04, do not rely on them.

**Diagnostic**: If users report grey/black screens connecting, check `room_signals` table for ICE candidates — only `host`/`srflx` types (no `relay`) means TURN is broken.