# AI Engineer Portfolio

Current security integration: [Stage 1 Vercel / Render composition](docs/production-integration.md) is implemented and offline tested; public activation and hosting verification remain pending. Older phase reports below describe their historical state.

A modern AI Engineer portfolio built with **Next.js, React, TypeScript, and Tailwind CSS**, designed to present my machine learning, LLM, agentic AI, and MLOps work through structured technical case studies.

The portfolio also includes an integrated **AI Portfolio Assistant** that allows recruiters, hiring managers, and technical visitors to ask questions about my projects, skills, experience, and current work.

---

## Overview

This portfolio was built as more than a static personal website.

The goal is to provide a clear technical view of my work as an AI Engineer, including:

- machine learning projects
- LLM and RAG applications
- agentic AI systems
- backend and API development
- MLOps and deployment workflows
- technical case studies
- professional experience and engineering background

Projects are stored as structured data and rendered through reusable components and dynamic Next.js routes.

The portfolio also connects to a separate FastAPI-based RAG backend that powers the conversational AI assistant.

---

## Key Features

- Responsive AI Engineer portfolio
- Dark-first technical interface
- Reusable React components
- Data-driven project system
- Dynamic project case-study routes
- Individual and team project distinction
- Completed and in-progress project states
- Technical architecture visualizations
- Integrated AI Portfolio Assistant
- Markdown rendering for assistant responses
- Environment-based backend configuration
- TypeScript type safety
- ESLint validation
- Production build support

---

## Architecture

```text
                        AI Engineer Portfolio
                                |
                                v
                      Next.js / React Frontend
                                |
              +-----------------+------------------+
              |                                    |
              v                                    v
       Portfolio Content                    AI Portfolio Assistant
              |                                    |
              v                                    |
       Structured Project Data                     |
              |                                    |
              v                                    |
      Dynamic Case Studies                         |
                                                   |
                                                   | same-origin /api/chat/session + /api/chat
                                                   v
                                          Next.js secure gateways
                                                   | authenticated /internal/session-chat
                                                   v
                                          FastAPI RAG Backend
                                                   |
                                                   v
                                         Hybrid Retrieval
                                                   |
                                                   v
                                             Google Gemini
                                                   |
                                                   v
                                         Grounded Response
```

The portfolio frontend and AI assistant backend are maintained as separate applications.

This separation allows the Next.js application to focus on presentation and user experience while the Python backend handles retrieval, embeddings, routing, and language-model interaction.

---

## Portfolio Structure

The homepage is composed from reusable sections:

```text
Navbar
   |
   v
Hero
   |
   v
Featured Projects
   |
   v
About
   |
   v
Technical Skills
   |
   v
AI Portfolio Assistant
   |
   v
Experience / Journey
   |
   v
Contact
```

Each section is implemented as an independent React component.

---

## Project Case Studies

Project information is stored centrally in:

```text
src/data/projects.ts
```

Each project contains structured information such as:

- title
- slug
- category
- project type
- description
- technologies
- development status
- problem
- solution
- architecture
- contributions
- results
- GitHub or demo links

The project cards on the homepage and the detailed case-study pages use the same data source.

This avoids duplicating project information across the website.

---

## Dynamic Routing

Detailed project pages are generated through the dynamic Next.js route:

```text
src/app/projects/[slug]/page.tsx
```

For example:

```text
/projects/bundeshost-tourism-forecasting
/projects/customer-churn-prediction
/projects/ai-project-status-agent
```

The route reads the requested slug, finds the corresponding project in the central project dataset, and renders the appropriate case study.

This allows new projects to be added primarily by extending the project data rather than creating a completely separate page for every project.

---

## Individual vs Team Projects

The project model distinguishes between:

```text
solo
team
```

This allows case studies to communicate ownership accurately.

For individual projects, the case study presents:

```text
What I Built
```

For team projects, it presents:

```text
My Contribution
```

This distinction is intentional so that collaborative work is not presented as individual ownership.

---

## Current Projects

The portfolio currently presents work across machine learning, MLOps, RAG, agentic AI, and generative AI.

### BundesHost Tourism Forecasting

A team-based tourism forecasting system covering Germany's 16 federal states.

The project combines time-series forecasting with an engineering stack including FastAPI, PostgreSQL, dbt, MLflow, Prefect, Docker, and Streamlit.

### Customer Churn Prediction

An end-to-end machine-learning project focused on identifying customers at risk of churn.

The project explores multiple classification models, class imbalance strategies, threshold tuning, evaluation metrics, and an interactive Streamlit application.

### AI Project Status Agent

A tool-using AI agent that answers project-management questions from structured project data.

The system uses LangChain, Google Gemini, Python tools, tool calling, and Streamlit.

### AI Creative Studio

A generative AI application for creating marketing-oriented visual content through an application interface and generative image workflow.

### AI Portfolio Assistant

A RAG-based conversational assistant integrated directly into this portfolio.

It uses a separate FastAPI backend with hybrid semantic and BM25 retrieval, query expansion, query routing, Gemini embeddings, and grounded response generation.

### Industrial AI Operations Copilot

An in-development Industrial AI concept focused on combining machine learning, RAG, and tool-driven AI workflows to investigate abnormal machine behavior and retrieve relevant technical guidance.

---

## AI Portfolio Assistant

The portfolio includes a conversational interface implemented in:

```text
src/components/FloatingPortfolioAssistant.tsx
```

Visitors can ask questions such as:

```text
What AI projects has Timothy built?

What experience does Timothy have with MLOps?

Has Timothy worked with RAG and agentic AI?
```

The browser uses same-origin gateways; it never addresses the backend directly.
The flow passed offline tests and a controlled live test through the local HTTPS
portfolio: Cloudflare verification succeeded, FastAPI issued a verified session,
and the RAG/Gemini assistant answered a question about BundesHost. This live result
was confirmed by the operator on 2026-11-14. It does not establish production
readiness; ordinary public chat defaults remain disabled.

```text
Visitor
   |
   v
FloatingPortfolioAssistant.tsx
   |
   | Bot proof → POST /api/chat/session → HttpOnly cookie
   | POST /api/chat
   v
Next.js authenticated, signed gateway
   | POST /internal/session-chat
   v
FastAPI Backend
   |
   v
RAG Pipeline
   |
   v
Grounded Answer
   |
   v
Portfolio UI
```

The backend is intentionally kept separate from the Next.js application so that AI retrieval and generation logic remains isolated from frontend presentation.

---

## AI Assistant Backend

### Disabled server-side gateway — Phase 6B-2

**Historical checkpoint:** the legacy destination/credential behavior described
below is superseded by Phase 6B-4G-2. The active `/api/chat` implementation has no
legacy fallback; see the secure session-chat section at the end of this document.

`src/app/api/chat/route.ts` establishes a server-side boundary for a future
authenticated integration. It is **disabled by default** and is not connected
to `FloatingPortfolioAssistant.tsx`; the existing UI still uses its existing
backend configuration. This phase does not activate public chat or change
FastAPI authentication.

The gateway reads only these server-side settings:

| Variable | Purpose |
| --- | --- |
| `CHAT_ENABLED` | Only the exact value `true` opts in. Leave absent or `false` in this phase. |
| `APP_ORIGIN` | Exact expected frontend origin, compared to the request's `Origin`. |
| `AI_ASSISTANT_BACKEND_URL` | Backend origin only, with an optional trailing slash; the route always appends `/chat`. |
| `AI_ASSISTANT_BACKEND_TOKEN` | Server-only bearer token matching the protected FastAPI configuration. |

Never put the bearer token or Gemini key in `NEXT_PUBLIC_*`, URLs, client code,
logs, or source control. No environment files are changed by this phase.
Both origin settings require HTTPS except for explicit loopback hosts used in
local development. Credentials, paths, queries and fragments in origin settings
are rejected. The backend token must match FastAPI's 43–256 URL-safe character
format. Missing or invalid configuration produces a generic 503 without fetch.

The POST contract is exactly `{ "message": "..." }`. The gateway requires JSON
and the configured Origin, rejects explicitly cross-site/non-fetch browser
metadata, limits streamed input to 8KiB and reading to five seconds, and validates
nonblank messages of at most 1,000 Unicode code points before trimming, matching
the backend validation order. It constructs new upstream headers and forwards no
browser cookies, Authorization, IP or identity headers. It follows no redirects,
retries nothing, and caps upstream JSON at 64KiB with a 45-second deadline covering
both fetch and response reading. Successful responses contain only a nonempty
string `answer`. All gateway responses use `Cache-Control: no-store`.

Other supported HTTP methods return 405 with `Allow: POST`. Invalid input returns
400, wrong origin/Fetch Metadata 403, request-read timeout 408, oversized input 413,
and unsupported media/encoding 415. Upstream failures use generic 502/503/504
responses; backend 401 is treated as a service failure, never as a request for
visitors to supply credentials. Upstream response headers and error bodies are
not relayed. Client disconnects abort gateway work, but cannot guarantee that an
already-running backend/provider operation stops or incurs no charge.

The hosting platform must support at least the route's 55-second duration hint;
the application separately bounds body reading and upstream work. Browser-origin
checks are not authentication or bot protection and can be forged by scripts.
No IP header is trusted, no rate/session/bot budget is added, and serverless
concurrency is not constrained by this phase. Keep the route disabled publicly
until deployment-wide admission, durable usage budgets and the visitor access
policy have been implemented and verified. A future same-origin gateway does
not need a browser CORS allowlist on FastAPI; bearer authentication remains
mandatory there.

Run the offline security suite with Node.js 24 or newer:

```sh
npm run test:gateway
```

Tests use Node's built-in runner and the existing TypeScript compiler in memory.
They inject synthetic configuration and mocked fetch responses, do not load
environment files, and do not contact FastAPI, Gemini, or other network services.

**Phase 6B-2 does not make public AI chat production-ready.**

### Disabled verified-session gateway — Phase 6B-4F-2B

**Historical checkpoint:** the disconnected UI described in this subsection was
subsequently integrated. The current local HTTPS/session/RAG flow is documented
under Local Development; production gateway defaults remain disabled.

`POST /api/chat/session` is a separate Node.js server-only route. Its feature
flag is `CHAT_SESSION_ENABLED`: absent, `false`, or any value other than the
exact string `true` returns generic HTTP 503 without contacting the backend.
Leave this flag absent or false. It is independent of `CHAT_ENABLED`; neither
the existing chat gateway nor `FloatingPortfolioAssistant.tsx` is connected to
this session route. No real environment files are required for the offline tests.

The route reuses server-only `APP_ORIGIN`, `AI_ASSISTANT_BACKEND_URL`, and
`AI_ASSISTANT_BACKEND_TOKEN`. The browser origin must use HTTPS, including local
browser testing. The backend origin must use HTTPS except for an explicitly
configured loopback connection. Origins cannot contain credentials, paths,
queries, fragments, whitespace or backslashes. Missing/invalid settings fail
closed. Never place the backend credential in public environment variables.

The browser sends JSON containing exactly one `proof` string, no query parameters.
The proof must contain 1–2048 printable non-whitespace ASCII characters. Origin
and restrictive Fetch Metadata checks apply. Unsupported methods/media/encoding,
extra fields and duplicate decoded JSON keys are rejected. A bounded shallow JSON
parser detects duplicates before object construction, including escaped key names.
Input is limited to 4096 streamed bytes and a five-second upload deadline.

The gateway constructs exactly this backend request:

```http
POST /internal/verified-sessions
Authorization: Bearer <server-only credential>
Content-Type: application/json
Accept: application/json

{"proof":"<verification proof>"}
```

It sends no browser cookies, Authorization, Origin, IP/identity headers, request
IDs, gateway IDs or `verified` claims. FastAPI creates its own request ID. There
are no redirects or automatic retries. A 15-second overall upstream deadline
covers both the request and response body; at most 2048 response bytes are read.
The host must support the route's 25-second duration hint for its bounded work.

Only HTTP 201 with exactly `token` and `expires_at` is accepted. Response JSON
must be strict and duplicate-free. The token must be canonical unpadded
base64url encoding of exactly 32 bytes. Expiry must be a safe integer Unix-second
timestamp in the future, at most four hours ahead, matching the backend's current
14400-second default policy. Decimal/exponent encodings are rejected. Backend
configuration allowing a longer lifetime is intentionally incompatible until
the frontend ceiling receives a separate review. Synchronized server clocks are
required; invalid or implausible timestamps fail closed.

After full validation, the browser receives HTTP 201 and only
`{"status":"ready"}`. The raw session token is delivered solely as:

```text
__Host-portfolio-chat=<token>; Secure; HttpOnly; SameSite=Strict; Path=/; Expires=<absolute UTC timestamp>
```

There is no Domain or sliding Max-Age. Expiration is never later than the backend
timestamp. Keep Secure for local development; use offline tests or HTTPS instead
of weakening attributes. The token is never included in JSON, URLs or application
logs. Failed issuance sets no cookie, preserving an existing browser cookie.
Backend response headers, bodies and provider errors are not relayed. Selected
safe failure statuses are preserved; backend authentication errors become generic
service errors. All responses use `Cache-Control: no-store`.

If issuance succeeds remotely but the response is lost, no browser cookie is set.
The gateway never retries; a later separately authorized attempt needs a fresh
proof according to backend policy, and the orphaned session may persist until
backend expiry. Cancellation cannot undo remote issuance already in progress.

The existing backend verification adapter has a provisional Turnstile-compatible
contract and must be configured/validated separately for its hostname, action,
age and proof rules. This phase adds no vendor widget, provider credentials or
verification calls. Other provider proof formats are not automatically compatible.
Origin checks are not bot authentication. Hosting-specific trusted ingress/IP
handling is still required before visitor IP headers can be used; this route
trusts and forwards none of them.

This route does not protect or activate paid chat. A future separately approved
chat endpoint must validate verified sessions and atomically enforce session,
trusted-IP and global usage admission before paid work. The legacy backend `/chat`
path must not be treated as session-protected. Public chat remains disabled.

Offline checks, using only installed dependencies and mocked fetch:

```sh
npm run test:session
npm run test:gateway
npm test
```

The RAG backend is maintained in a separate repository:

**AI Portfolio Assistant**

https://github.com/timoajayi/ai-portfolio-assistant

The backend provides:

- FastAPI REST API
- portfolio knowledge base
- Gemini embeddings
- semantic retrieval
- BM25 lexical retrieval
- hybrid ranking
- deterministic query expansion
- project-collection query routing
- grounded Gemini generation
- retrieval evaluation
- query-router evaluation

---

## Project Structure

```text
ai-engineer-portfolio/
|
├── public/
|
├── src/
│   ├── app/
│   │   ├── projects/
│   │   │   └── [slug]/
│   │   │       └── page.tsx
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── About.tsx
│   │   ├── ArchitectureDiagram.tsx
│   │   ├── Contact.tsx
│   │   ├── Experience.tsx
│   │   ├── FeaturedProjects.tsx
│   │   ├── Hero.tsx
│   │   ├── Navbar.tsx
│   │   ├── FloatingPortfolioAssistant.tsx
│   │   ├── ProjectCard.tsx
│   │   └── Skills.tsx
│   │
│   └── data/
│       └── projects.ts
│
├── eslint.config.mjs
├── next.config.mjs
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

---

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4

### AI Assistant Integration

- REST API
- FastAPI backend
- React Markdown
- Retrieval-Augmented Generation
- Google Gemini

### Development

- Node.js
- npm
- ESLint
- Git
- GitHub

### Deployment

The application is structured for deployment with:

- Vercel for the Next.js frontend
- a separately hosted FastAPI backend

Deployment is currently pending.

---

## Local Development

### 1. Clone the repository

```bash
git clone git@github.com:timoajayi/ai-engineer-portfolio.git
cd ai-engineer-portfolio
```

### 2. Install dependencies

```bash
npm install
```

### 3. Keep public chat disabled

No assistant configuration is needed to view the portfolio. The retired
`NEXT_PUBLIC_AI_ASSISTANT_API_URL` is no longer read. Do not use a direct backend
URL or disable authentication to enable local chat. Use the offline integration
tests in [tests/README.md](tests/README.md) for repeatable provider-free checks.
The separate loopback composition below provides the verified local live flow.

Public activation requires verified hosting ingress and the existing trusted
identity contracts; flags and credentials alone cannot activate the real route.

### 4. Start the development server

```bash
npm run dev -- --hostname 127.0.0.1 --port 3000
```

This HTTP port serves the UI/assets. The secure local chatbot uses the HTTPS
origin below. Do not start duplicate servers or restart existing services without
operator authorization.

### 5. Verified local HTTPS integration

| Service | Local address | Purpose |
| --- | --- | --- |
| Next.js development server | `http://127.0.0.1:3000` | UI, assets and HMR |
| Loopback HTTPS launcher | **`https://localhost:3443`** | Browser origin, secure cookies and existing gateway composition |
| Secure FastAPI backend | `http://127.0.0.1:8001` | Authenticated verified-session/chat APIs, RAG and Gemini |

Open **https://localhost:3443** for the working assistant. The launcher is
`scripts/local_frontend.mjs` in the separate backend repository; it is not a
second frontend implementation or a production service. It forwards UI/assets/HMR
to Next.js and invokes the existing frontend gateway factories for API requests.
The normal Next.js chat route still has no approved production identity provider
and fails closed; the launcher supplies only an explicit loopback development
identity. Never expose this local composition through a tunnel or public listener.

Use the backend's `docs/local-development.md` for private state, TLS certificate
and startup procedures. The matching backend checkpoint is
`63b2399f93ddc8aa2aa19f1a5ddf46758c6fbaa3`. Keep the certificate, profile, session
cookies, scoped credentials, signing keys, API keys and operational SQLite outside
Git. Reuse existing state and never initialize new storage to regain allowances.
The local backend reads Gemini/Turnstile secrets from its launch-process environment;
the Next.js process needs only the public `NEXT_PUBLIC_TURNSTILE_SITE_KEY` for the
widget. Do not embed backend credentials in any public variable or browser code.

Live Cloudflare or Gemini requests require explicit authorization. The backend's
`--session-only` mode intentionally denies chat while preserving session issuance;
it must be omitted only for an authorized live RAG/Gemini test. Production hosting,
ingress provenance, deployment configuration and production builds remain unverified.

---

## Development Checks

### ESLint

```bash
npm run lint
```

### TypeScript

```bash
npx tsc --noEmit
```

### Production Build

```bash
npm run build
```

These commands are release checks, not a claim that every check has passed.
Offline tests, lint and TypeScript validation passed for this local checkpoint.
The latest isolated production-build attempt (Webpack) failed because offline
networking blocked `next/font/google` downloads of Geist and Geist Mono.
**Production-build success has not been verified.** Font loading is unchanged;
an authorized build with the required font access or a separately reviewed font
change is still needed before deployment. No production deployment has been tested.

---

## Environment Variables

The optional `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is a public widget identifier, not
a secret. Backend URLs, scoped bearer credentials and signing keys are server-only;
Gemini credentials remain in FastAPI. The secure gateway sections document their
names and constraints. Both chat flags stay disabled by default; no real
environment files are needed for offline tests.

---

## Current Status

The portfolio application is functional locally, including one operator-confirmed
live HTTPS/Cloudflare/verified-session/RAG/Gemini answer about BundesHost.
Automated regression tests remain offline and use mocked providers. Local success
does not establish production ingress trust, build success or deployment readiness.

Completed:

- portfolio design and layout
- responsive component structure
- homepage sections
- project data model
- reusable project cards
- dynamic project case-study routes
- architecture visualization component
- AI assistant chat interface
- suggested assistant questions
- conversational message rendering
- loading and error states
- Markdown assistant responses
- secure session/chat gateway integration (offline tests and controlled local live test)
- FastAPI backend integration
- ESLint validation
- TypeScript validation

Remaining before public release:

- successful production build (current offline font-download blocker)
- approved production visitor-identity provenance and gateway/backend composition
- runtime secret, persistent-ledger, backup and operational deployment validation

- final content and link review
- contact information
- CV integration
- final responsive testing
- production backend configuration
- frontend deployment
- backend deployment

---

## Related Repository

### AI Portfolio Assistant

The Python RAG backend powering the portfolio assistant:

https://github.com/timoajayi/ai-portfolio-assistant

---

## Author

**Timothy Ajayi**

AI Engineer focused on machine learning, LLM applications, RAG, agentic AI, backend systems, and MLOps.

Based in Germany.


### Disabled secure session-chat gateway — Phase 6B-4G-2

`POST /api/chat` now reads the existing `__Host-portfolio-chat` cookie server-side,
requires a separately scoped chat credential, signs the exact outgoing UTF-8 body
with the existing v1 signer, and targets only `POST /internal/session-chat`.
No browser token JSON, legacy credential/destination fallback, retry, session
creation or cookie refresh is introduced. Session issuance remains independent.

`CHAT_ENABLED` still requires exact opt-in and stays disabled. Crucially, the real
route has no approved visitor-identity provider: flags and keys alone cannot
activate it. An injected server-only provider must independently authorize
canonical visitor identity and ingress policy; headers or signatures alone do
not prove provenance. Offline fixtures are not production evidence and cannot
be selected with an environment setting.

New server-only settings include `AI_ASSISTANT_CHAT_TOKEN` and the
`GATEWAY_ASSERTION_*` key/authority/window settings plus `GATEWAY_INGRESS_POLICY`.
The existing `AI_ASSISTANT_BACKEND_TOKEN` remains issuance-only and is never a chat
fallback. Never expose these through `NEXT_PUBLIC_` variables or browser source.
See [secure gateway contract](docs/session-chat-gateway.md) for the exact settings,
request/response limits, cookie, deadline and key separation requirements.

All checks are offline: `npm test`, ESLint, TypeScript and the explicit optional
Node-to-Python contract check documented in [tests/README.md](tests/README.md).
The UI now uses only same-origin `/api/chat/session` and `/api/chat`. It obtains
a single-use bot proof, requests the secure HttpOnly cookie, then submits messages
without reading that cookie or receiving a session token in JSON. The old public
backend URL is no longer used. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is an optional
public widget identifier, never a credential; without it verification is unavailable.
No environment files or activation flags were changed.

Public chat remains unavailable: the real route still has no approved production
visitor-identity provider. Do not substitute headers or the test-only resolver.
The backend's existing production policy denies the legacy endpoint; actual hosting
ingress, scoped secrets, persistent storage, provider compatibility and HTTPS still
require deployment verification. Local tests do not establish production readiness.
See [offline integration checks](tests/README.md) for the complete mocked workflow.
