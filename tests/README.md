# Offline gateway security tests

Use the installed dependencies; no network, accounts, credentials or databases are
needed. `npm test` runs all Node tests. `npm run test:gateway` and
`npm run test:session` remain available. Tests compile the actual TypeScript
modules in memory with the existing compiler and inject mocked fetch/evidence.
No real fetch, filesystem, environment or provider client is exposed inside the VM.

- `chat-gateway.test.mjs`: preserves existing method, origin/metadata, body/message,
  stream bounds, timeout/cancellation, response and error tests. Expectations now
  use scoped session-chat headers/path/cookie rather than legacy `/chat`. Metadata
  responses previously stripped are now rejected; unexpected browser credentials
  are rejected. No test is skipped or removed.
- `session-chat-gateway.test.mjs`: cookie/credential/key/policy failures, runtime
  provider trust, canonical IP, exact buffer/session hashes, nonce uniqueness,
  strict JSON, no late upstream work, credential echoes, absent production provider
  and actual route disabled behavior. No legacy fallback exists.
- `session-gateway.test.mjs`: unchanged issuance, strict proof/response handling,
  absolute Secure/HttpOnly/Strict host-cookie attributes, deadlines and no retries.
- `gateway-assertions.test.mjs`: unchanged deterministic shared protocol vectors,
  HMAC, key windows/rotation, canonical encodings, request bytes and IP handling.

`check_gateway_contract.py --backend <checkout>` is an optional explicit check
using the existing backend Python environment. It invokes the mocked Node capture,
verifies actual gateway assertions in Python, rejects body/session/method/path/time
mismatches and runs independent negative gateway probes. It never imports the API,
loads .env, accesses SQLite, or calls a provider. Test fixtures contain public
synthetic keys only; never deploy them.

These tests establish local enforcement and cross-language compatibility, not
production ingress trust, live provider behavior or frontend/backend deployment
isolation. The real chat route has no identity provider and remains unavailable.
See `docs/session-chat-gateway.md` for the current contract and outstanding work.

## Complete local security integration

With the existing backend virtual environment, run from the frontend checkout:

```sh
node tests/security-integration.mjs --backend /path/to/ai-portfolio-assistant
node tests/chat-ui-security.mjs --backend /path/to/ai-portfolio-assistant
/path/to/ai-portfolio-assistant/.venv/bin/python -B tests/run_backend_security.py --backend /path/to/ai-portfolio-assistant
```

The browser check uses installed Chrome (optional `--chrome /path/to/binary`),
bundles the actual React assistant with existing Next/TypeScript dependencies and
intercepts browser traffic before navigation. It mocks the widget script at its
fixed URL; no Cloudflare connection is made. Actual Node gateway handlers exchange
messages over pipes with the real backend ASGI/authentication/session/RAG path.
Only verification and the Gemini SDK are mocked. Chrome enforces the actual
Secure/HttpOnly/Strict cookie; JavaScript cannot read it. The fixture clock advances
to browser time so absolute cookie expiry remains meaningful.

All identities, keys and credentials are synthetic and test-only. Backend fixtures
create disposable SQLite files; an audit guard rejects operational SQLite access,
environment-file reads and network connections. The backend checkout is not edited.
The backend suite checks atomic rate/admission limits, durable replay, daily/monthly
budgets, restart persistence, storage failure and clock rollback. Cross-stack probes
tamper credentials, assertions, bodies, session/IP/policy bindings and replay claims;
rejections must leave the mocked provider invocation count unchanged.

`assistant-client.test.mjs` additionally checks browser request mapping, sanitized
failures, no retries and rejection of unexpected token-bearing response JSON.
No test identity provider is exported by a production route, and no activation flag
is enabled. These tests establish local behavior only, not production ingress trust,
real provider availability, hosting isolation or production readiness.


## Local live evidence versus automated checks

The operator confirmed one successful local HTTPS session/RAG/Gemini question
about BundesHost on 2026-11-14. The stack was Next.js on 127.0.0.1:3000, the
backend repository's HTTPS development launcher at https://localhost:3443, and
secure FastAPI on 127.0.0.1:8001 (backend commit
`63b2399f93ddc8aa2aa19f1a5ddf46758c6fbaa3`). This is distinct from the automated
tests above: those use mocked provider transports and disposable SQLite, and
must never contact Cloudflare or Gemini. No live test is run by `npm test`.

Local success does not approve production IP provenance or hosting. The ordinary
Next.js chat route has no production identity provider and remains fail closed.
Only the separate backend launcher supplies the reviewed loopback development
composition. Private certificates, credentials, environment files, cookies, logs
and operational state must never be staged.

The last isolated production build used Webpack with networking blocked and failed
while fetching Geist and Geist Mono via the existing Google Fonts loader. Do not
report production-build validation as passed. Font-loading code remains unchanged;
a successful authorized production build and deployment checks are outstanding.
