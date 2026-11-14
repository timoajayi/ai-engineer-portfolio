# Stage 1: Vercel / Render integration (offline verified only)

Public chat remains disabled by default. This change supplies production composition;
no real environment, deployment, service, database schema or activation flag was changed.

## Vercel identity

`src/app/api/chat/route.ts` uses `vercel-chat.ts` only inside Vercel's production
Node runtime. It requires the platform's server-side runtime markers and the fixed
`vercel-direct-v1` ingress policy. HTTP headers cannot supply runtime attestation.
Only `x-vercel-forwarded-for` supplies identity. Missing, malformed, duplicate/list
values or conflicting `x-forwarded-for`/`x-real-ip` aliases fail closed. IPv6 uses
the existing canonicalization. Forwarded metadata is removed before the generic
chat gateway; it is never forwarded to Render or used as a fallback.

This relies on Vercel's documented overwritten ingress headers inside a Vercel
Function, not the header name alone: [Vercel request headers](https://vercel.com/docs/headers/request-headers).
Serve the approved origin directly through Vercel. Additional proxies, Enterprise
Trusted Proxy overrides, middleware rewrites, or non-Vercel hosting require review;
they are not a way to supply a caller-selected IP. No webhook signature is assumed
for ordinary visitor requests. Preview and local Next routes stay unavailable.
The separate existing loopback HTTPS launcher is unchanged.

## Configuration names (no credentials or sample activation commands)

Vercel supplies `VERCEL`, `VERCEL_ENV`, `NODE_ENV`; do not simulate them on another host.
Existing application settings remain:

- `CHAT_ENABLED`, `CHAT_SESSION_ENABLED`, `APP_ORIGIN`
- `AI_ASSISTANT_BACKEND_URL`, `AI_ASSISTANT_BACKEND_TOKEN`, `AI_ASSISTANT_CHAT_TOKEN`
- `GATEWAY_ASSERTION_ISSUER`, `GATEWAY_ASSERTION_AUDIENCE`, `GATEWAY_ASSERTION_KEY_ID`
- `GATEWAY_ASSERTION_KEY`, `GATEWAY_ASSERTION_KEY_NOT_BEFORE`, `GATEWAY_ASSERTION_KEY_NOT_AFTER`
- `GATEWAY_INGRESS_POLICY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public widget identifier only)

Issuer, audience, key ID, canonical base64url key, Unix-second validity bounds and
fixed ingress policy must match Render's composition. Chat and issuance bearer
credentials remain distinct, server-only, and map to their existing backend scopes.
See the backend's `docs/production-integration.md` for its configuration names.

## Activation prerequisites and limits of verification

Keep both public flags disabled until separately authorized. Confirm the actual
Vercel header overwrite/provenance behavior with spoofed inputs, approved HTTPS
origin, Render transport headers, clock/key windows, scoped credential mapping,
Turnstile hostname/action, and persistent ledger schema/kill switches/quotas.
No proxy/header may become a replacement for the signed visitor assertion.

The backend pins the configured gateway authority, verifies scoped auth and the
assertion, consumes durable replay, then delegates identity only to that approved
Vercel deployment. A compromised deployment/signing key is not solved by headers.
Render's added `x-forwarded-for` is discarded only under this composed production
policy and never used as browser identity. Other forbidden identity headers are
still rejected. HTTPS/TLS, body/response bounds, session verification, deadlines,
no retries, budgets and legacy production denial remain intact.

Offline checks: `npm test`, `npm run lint`, local TypeScript, and
`node tests/production-integration.mjs --backend /path/to/backend`. The last command
runs actual Node/Render composition with synthetic runtime metadata, credentials,
mocked verification/Gemini and disposable SQLite. It does not prove hosting behavior
or authorize activation. No production images or deployments were built/tested.
