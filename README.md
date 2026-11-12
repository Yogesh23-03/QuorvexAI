# QuorvexAI

A multi-agent AI command center: six specialist agents behind one interface, with
live code sandboxes, document exports, web search and credit-based billing.

---

## What it does

| Agent      | Cost       | What it produces                                          |
| ---------- | ---------- | --------------------------------------------------------- |
| **Chat**   | 1 credit   | Reasoning, explanations, markdown answers                 |
| **Search** | 5 credits  | Tavily-backed live web results, then a synthesised answer |
| **Code**   | 10 credits | Multi-file projects with tabs + live iframe sandbox       |
| **PDF**    | 10 credits | Server-rendered PDF uploaded to S3 (pre-signed download)  |
| **PPT**    | 10 credits | PPTX deck uploaded to S3 (pre-signed download)            |
| **Vision** | 10 credits | Generated images (Gemini)                                 |

An **Auto** mode routes each prompt through a Groq intent classifier; PDF and
image uploads are detected from the MIME type before the classifier runs.

Credits: 100 free on signup, **Starter ₹199 = 500**, **Pro ₹499 = 1,000**.
Failed or timed-out runs are refunded automatically. A depleted balance tops
itself back up to 100 every five hours — see [Credits and the 5-hour
reset](#credits-and-the-5-hour-reset).

---

## Architecture

```
                    ┌──────────────────────────────┐
   React SPA        │  API Gateway  :8000          │
   (Vite, Redux,    │  CORS · JWT · rate limits    │
    Firebase Auth)  │  limits · request IDs        │
        │           └───────┬──────────────────────┘
        │  HttpOnly cookies │ x-user-id + x-request-id + x-internal-key
        └──────────────────►│
                            ├── /api/auth/*    → Auth    :8001  (Firebase verify, users, credits)
                            ├── /api/chat/*    → Chat    :8002  (conversations, messages)
                            ├── /api/agent/*   → Agent   :8003  (LangGraph, 6 agents, S3)
                            └── /api/billing/* → Billing :8004  (Razorpay orders + verification)

   Redis  ── sessions, rate-limit windows, agent-limit counters, chat memory
   MongoDB Atlas ── isolated databases per service
   S3 ── generated PDF / PPTX / images, served via pre-signed URLs
```

Services never trust the browser: the gateway verifies the access token and
forwards `x-user-id`. Ports 8001–8004 also reject direct calls when
`INTERNAL_API_KEY` is configured. Legacy Redis session cookies are still
honoured until they expire, so the JWT rollout did not sign anyone out.

### Repository layout

```
backend/
  gateway/            Express gateway + health/aggregation endpoint
  services/auth/      Firebase token verification, user + credit ledger
  services/chat/      Conversations and messages
  services/agent/     LangGraph graph, agents, S3, PDF/PPT generators
  shared/             logger, errors, health, redis, sessions, rate limiting
  tests/              Vitest + Supertest suites (89 tests)
  scripts/dev-up.sh   Boots all five processes into backend/logs/*.log
frontend/
  src/components/     UI library (GlassCard, GlowButton, HudFrame, AICoreLoader…)
  src/pages/          Landing, Login, Chat, Pricing, Settings, 404
  src/features/       Typed API wrappers (auth, agent, billing, conversations)
  src/redux/          user / conversation / message / ui slices
  src/test/           Vitest + Testing Library suites (28 tests)
```

---

## Tech stack

- **Frontend** — React 19, Vite 8, Tailwind CSS 4, Framer Motion (`motion/react`),
  Redux Toolkit, React Router 7, Three.js via React Three Fiber + drei (lazy,
  idle-mounted), react-markdown + syntax highlighting, Firebase Web SDK,
  Razorpay Checkout.
- **Backend** — Node 20+, Express 5, Mongoose, ioredis, pino, express-http-proxy,
  Multer, AWS SDK v3, Razorpay SDK.
- **AI** — LangChain + LangGraph, DeepSeek-Chat via OpenRouter (primary),
  Groq (intent routing), Gemini (vision/images), Tavily (search), Qdrant (PDF RAG).

---

## Auth flows

One identity system for every client: whatever the sign-in method, the result is
the same QuorvexAI JWT pair in `HttpOnly` cookies.

| Flow                     | Endpoint                           | What happens                                                                                   |
| ------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| Email + password sign-up | `POST /api/auth/register`          | bcrypt (12 rounds) hash, account created with 100 credits                                      |
| Email + password sign-in | `POST /api/auth/login`             | password verified with a constant-time compare, generic "invalid email or password" on failure |
| Google sign-in           | `POST /api/auth/login` `{ token }` | Firebase ID token verified server-side; the ID token is exchanged, never accepted downstream   |
| Account linking          | both of the above                  | a Google account and a password account with the same email become one user (`authProviders`)  |
| Session refresh          | `POST /api/auth/refresh`           | rotates the refresh token and issues a fresh 15m access token                                  |
| Sign-out                 | `POST`/`GET /api/auth/logout`      | access + refresh tokens revoked in Redis, cookies cleared                                      |
| Forgot password          | `POST /api/auth/forgot-password`   | single-use token (30 min, hashed in Redis) mailed through SMTP; always the same response       |
| Reset password           | `POST /api/auth/reset-password`    | token consumed once, password re-hashed, all refresh tokens revoked                            |
| Current user             | `GET /api/auth/me`                 | profile, plan, credit balance and `nextResetAt`                                                |

Tokens: access 15 minutes, refresh 7 days, both `HttpOnly` + `SameSite=Lax` +
`Secure` in production (refresh cookie scoped to `/api/auth`). Credential and
reset endpoints are rate limited per IP + email. With `SMTP_HOST` empty the
reset mail is logged instead of sent, so the flow is testable locally.

---

## Credits and the 5-hour reset

Every account starts with 100 credits. Agents charge 1–10 credits, deducted
with one atomic `findOneAndUpdate` that also asserts `credits >= cost`, so
concurrent requests can never double-spend or go negative. Any agent failure or
timeout refunds the exact amount (never above the purchased total).

On top of that there is a **lazy top-up instead of a cron job**:

- every `CREDIT_RESET_HOURS` (default 5) the balance is restored to
  `CREDIT_RESET_AMOUNT` (default 100) — **but only for accounts below it**;
  purchased credits above the amount are never reduced;
- the check runs inside a single conditional update
  (`credits < amount` + `lastCreditResetAt <= now - window`), so several service
  instances handling the same user at once still produce exactly one reset;
- the same call reads credits, so no scheduler, no extra Redis key and no
  cross-service coordination is needed (there is no user cache to invalidate —
  Redis holds tokens, rate-limit windows and agent counters only);
- `GET /api/auth/credits` (and `/me`) return `nextResetAt`, `resetHours` and
  `resetAmount`; the credits card renders the countdown and updates itself when
  the window elapses.

---

## Design system

Industrial robot identity: graphite or ceramic shell, signal-orange accents and
HUD ice-blue for information. All colours are CSS variables in
`frontend/src/index.css` and re-exported as Tailwind tokens, so both themes share
one component set.

| Token            | Dark — “Graphite”         | Light — “Ceramic”     |
| ---------------- | ------------------------- | --------------------- |
| Canvas           | `#0A0C11` → `#12151C`     | `#F4F6FA` → `#E9EDF4` |
| Panel / steel    | `#171B23` / `#232935`     | `#FFFFFF` / `#DFE5EE` |
| Primary accent   | `#FF6A2B` (signal orange) | `#E8541B`             |
| Secondary accent | `#38BDF8` (HUD ice blue)  | `#2563EB`             |
| Success / error  | `#A3E635` / `#F43F5E`     | `#4D7C0F` / `#DC2626` |
| Primary text     | `#E2E8F1`                 | `#1E2836`             |

**Dark / light.** `frontend/src/lib/theme-context.js` stores the choice in
`localStorage` (`quorvex-theme`), and an inline script in `index.html` sets the
`dark` class before React renders, so the first paint is never the wrong theme.
The very first visit is seeded from the OS preference, then the sun / moon toggle
in the navbar decides. Everything
theme-aware is driven by the variables above: shell, chat bubbles, markdown and
code blocks, sandbox chrome, modals, toasts, scrollbars, the 3D scene
materials and lights, and the favicon. Glass panels keep a visible border and
shadow in light mode instead of relying on white translucency.

**Components.** `GlassCard`, `GlowButton`, `ThemeToggle`, `RobotMascot`,
`RobotScene`, `AgentBadge`, `AgentGlyph`, `AICoreLoader`, `HudFrame`,
`StatusPill`, `StatePanel`, `ArtifactCard` and the `fx/` layers
(`BlueprintBackground`, `CircuitBackground`, `MachineParts`, `FloatingElements`,
`CursorGlow`, `TypewriterText`) replace per-page styling. The 3D mascot is
lazy-loaded and degrades to a static SVG robot with fewer floating parts on
small screens, low core counts or `prefers-reduced-motion`.

---

## Quick start

Prerequisites: **Node 20.19+**, MongoDB (local or Atlas), Redis (optional —
services degrade to an in-memory store), Firebase project, and API keys for the
providers you want to exercise.

```bash
# 1. Backend dependencies (npm workspaces at backend/)
cd backend
npm install

# 2. Environment files — copy every example and fill in real values
cp gateway/.env.example gateway/.env
cp services/auth/.env.example services/auth/.env
cp services/chat/.env.example services/chat/.env
cp services/agent/.env.example services/agent/.env
cp services/billing/.env.example services/billing/.env

# 3. Frontend
cd ../frontend
npm install
cp .env.example .env

# 4. Run
cd ../backend && npm run dev        # all five services, colour-coded logs
cd ../frontend && npm run dev       # http://localhost:5173
```

`npm run dev:all` in `backend/` uses `scripts/dev-up.sh` (background processes,
logs in `backend/logs/`). Point the whole backend at a local MongoDB with
`LOCAL_MONGO=mongodb://127.0.0.1:27017 bash scripts/dev-up.sh`.

### Databases

One logical database per service on the same MongoDB deployment — that is why
every service `.env` carries its own `MONGODB_URI`:

| Service | Default database  |
| ------- | ----------------- |
| auth    | `quorvex_auth`    |
| chat    | `quorvex_chat`    |
| agent   | `quorvex_agent`   |
| billing | `quorvex_billing` |

The gateway has no MongoDB at all; its sessions and rate limits live in Redis.

**`bad auth : Authentication failed`** in `backend/logs/*.log` means the
credentials in `MONGODB_URI` are wrong: regenerate the DB user (Atlas →
Database Access), percent-encode special characters in the password, add
`?authSource=admin` when the user lives in the `admin` database, and allowlist
your IP (Atlas → Network Access). The service logs the cause with a hint and
retries every 10 s while `/health` reports `degraded` — it never crashes. For
local development use `mongodb://127.0.0.1:27017/quorvex_<service>`.

### Health checks

Two endpoints per service, because ECS and a human need different answers:

- **`GET /live`** → `200` whenever the process is up. No I/O, no dependencies.
  This is the ALB/ECS health check path, so a Mongo or Redis blip can never
  restart healthy tasks.
- **`GET /health`** → status, service, version, uptime, Mongo state, Redis mode,
  plus cheap checks (provider keys on the agent, cookie flags on auth). Always
  `200`, with `status: "degraded"` when something is down. It never returns
  503: a load balancer polling this would otherwise remove every task during a
  shared-dependency outage.

`GET /health?deep=1` adds bounded probes: Redis ping, and — on the gateway —
reachability of all four upstreams, answered from each service's `/live` with a
1.5 s timeout. Diagnostics, not traffic decisions.

---

## Environment variables

Real values belong only in `.env` files (git-ignored). `.env.example` files list
every key the code reads, with placeholders and comments. Every service runs
`validateEnv()` from `shared/env.js` at boot: variables it cannot work without
are checked for presence and shape (`mongodb://`, absolute URL, port, positive
integer), and a failure prints **names only** — never values — then exits.
Optional configuration is logged as a warning and the related feature stays
disabled.

`INTERNAL_API_KEY` matters in production: once it is set, the chat, agent and
billing services and the auth service's service-to-service endpoints reject any
call that does not carry the matching `x-internal-key` header, so ports 8001-8004
are not usable directly from the internet.

**frontend** — `VITE_SERVER_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
`VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
`VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, optional
`VITE_RAZORPAY_KEY_ID`.

**gateway** — `PORT`, `NODE_ENV`, `LOG_LEVEL`, `FRONTEND_URL` (CORS allow-list),
`AUTH_SERVICE`, `CHAT_SERVICE`, `AGENT_SERVICE`, `BILLING_SERVICE`, `REDIS_URL`,
`INTERNAL_API_KEY`, `PROXY_TIMEOUT_MS`, optional `AGENT_PROXY_TIMEOUT_MS` and
`REQUEST_TIMEOUT_MS`.

**auth** — `PORT`, `MONGODB_URI`, `REDIS_URL`, `INTERNAL_API_KEY`, `JWT_SECRET`,
`JWT_REFRESH_SECRET`, optional `COOKIE_SECURE` / `COOKIE_SAMESITE` /
`COOKIE_DOMAIN` (defaults: Secure in production, `lax`), `CREDIT_RESET_HOURS`,
`CREDIT_RESET_AMOUNT`, `FRONTEND_URL` (reset links), one of
`FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_SERVICE_ACCOUNT_BASE64`, or the local
`serviceAccountKey.json` (git-ignored), and `SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` for password-reset mail
(empty `SMTP_HOST` logs the message instead of sending it).

**chat** — `PORT`, `MONGODB_URI`, `REDIS_URL`, `INTERNAL_API_KEY`, optional
`REDIS_DISABLED=true` to force the in-memory fallback.

**agent** — `PORT`, `MONGODB_URI`, `REDIS_URL`, `INTERNAL_API_KEY`,
`AUTH_SERVICE`, `CHAT_SERVICE`, `OPENROUTER_API_KEY`/`OPENROUTER_MODEL`,
`GROQ_API_KEY`/`GROQ_MODEL`, `GOOGLE_API_KEY`/`GEMINI_MODEL`, `TAVILY_API_KEY`,
`QDRANT_URL`/`QDRANT_API_KEY`/`EMBEDDING_MODEL`, `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_BUCKET_NAME`, `SIGNED_URL_TTL_SECONDS`,
optional `UPLOAD_DIR` (defaults to the OS temp directory), and
`LLM_TIMEOUT_MS`, `IMAGE_TIMEOUT_MS`, `AGENT_TIMEOUT_MS`.

**billing** — `PORT`, `MONGODB_URI`, `AUTH_SERVICE`, `INTERNAL_API_KEY`,
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.

---

## Scripts

### Backend (root, npm workspaces)

| Command                           | Description                             |
| --------------------------------- | --------------------------------------- |
| `npm run dev`                     | All services with nodemon               |
| `npm run start`                   | All services, production mode           |
| `npm run dev:all`                 | Background boot via `scripts/dev-up.sh` |
| `npm test`                        | Vitest + Supertest (89 tests)           |
| `npm run lint` / `lint:fix`       | ESLint flat config                      |
| `npm run format` / `format:check` | Prettier                                |

Every workspace also exposes `start`, `dev`, `test`, `lint`, `format` and
`format:check`, so a container image or a CI job can use the same interface.

### Frontend

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Vite dev server on :5173             |
| `npm run build`   | Static production build into `dist/` |
| `npm run preview` | Serve the build locally              |
| `npm test`        | Vitest + Testing Library (28 tests)  |
| `npm run lint`    | ESLint (zero errors)                 |
| `npm run format`  | Prettier                             |

---

## Testing

```bash
cd backend && npm test      # requires MongoDB on 127.0.0.1:27017
cd frontend && npm test
```

Backend suites cover: Firebase login + 100-credit signup, JWT cookie auth,
chat CRUD + ownership checks, atomic credit deduction and refunds, the credit
reset policy on a mocked clock (window not elapsed, top-up below the amount,
purchased credits untouched, one reset under concurrent calls, env override),
Razorpay order creation and signature verification (mocked SDK), intent routing
and malformed-JSON fallbacks, every agent endpoint with mocked providers,
gateway end-to-end routing to fake upstreams, and health reporting for all five
services.

Frontend suites cover: API error normalisation, agent chips and credit labels,
submit behaviour (Enter vs Shift+Enter), markdown and image rendering, glass
components, loading/empty/error states, and the protected-route guard.

---

## Security notes

- Rotate the Firebase service-account key if it has ever been committed; prefer
  `FIREBASE_SERVICE_ACCOUNT_BASE64` in deployment.
- Auth is a 15-minute access JWT plus a 7-day refresh token, both `HttpOnly`
  and `SameSite=Lax` (`Secure` in production); the browser never sees a Firebase
  token after login, and sign-out revokes both tokens in Redis.
- Razorpay verification is HMAC-SHA256 with a timing-safe compare, refuses to run
  without a secret, cross-checks the order amount with Razorpay, and claims each
  order exactly once (idempotent replay).
- Rate limits are applied at the gateway (login 20/min, chat 120/min, agent and
  billing 30/min) and fail open if Redis is unavailable.
- Uploads are limited to 20 MB, PDF/PNG/JPEG/WebP/GIF, stored under random names.
- pino redacts cookies, authorization headers, tokens and signatures.

---

## Deployment

Full instructions — build commands, per-service env tables, Secrets Manager vs
plain task env, ALB/CloudFront settings, and the post-deploy checklist — live in
**[DEPLOY.md](DEPLOY.md)**. The short version:

1. **Images** — one `Dockerfile` per service, build context `backend/`:
   `docker build -f services/auth/Dockerfile -t quorvex-auth .`. Pinned to
   `node:22-alpine` (production dependencies require Node ≥ 22), multi-stage,
   `npm ci --omit=dev`, non-root, exec-form `CMD`, and each image contains only
   `shared/` plus its own service.
2. **ECR + ECS Fargate** — tag images with the commit SHA. Health check path is
   **`/live`**; the gateway alone is attached to the public ALB listener, and
   the services are reached over Service Connect (`http://auth:8001`).
3. **CloudFront + S3** — one distribution: `default` → S3 (the SPA), `/api/*` →
   the ALB with caching disabled and cookies/`Origin` forwarded. Add a custom
   error response (403/404 → `/index.html`, 200) or deep links 404 on reload.
4. **Frontend** — `cd frontend && npm run build`, then sync `dist/` to S3. Leave
   `VITE_SERVER_URL` empty so the app calls `/api/*` on its own origin; that
   keeps the session cookies first-party and needs no CORS preflight.

---

## Deployment guarantees

What the code enforces, so a deployment cannot repeat the old failures:

- **Nothing waits forever.** Redis connects and commands are bounded
  (`REDIS_CONNECT_TIMEOUT_MS` / `REDIS_COMMAND_TIMEOUT_MS`, 4 s), Mongo selection
  and buffering are bounded, every request has a budget that turns a stuck
  handler into a logged `503 REQUEST_TIMEOUT`, and a cache that is down fails
  fast with `503 REDIS_UNAVAILABLE` instead of hanging. This was the bug that
  took authentication offline: an unbounded Redis handshake wedged every POST
  while GET/OPTIONS kept working.
- **`GET /live` on every service** — dependency-free liveness for the ALB/ECS.
  `GET /health` reports state but always answers 200; deep probes live behind
  `?deep=1`.
- **Correct proxy behaviour** — the gateway never parses a body
  (`parseReqBody: false`) so POST/multipart bodies reach the upstream intact, it
  streams responses, and upstream failures become JSON `503`/`504` inside a 60 s
  budget. Agent runs stream heartbeats so CloudFront's 30 s and the ALB's 60 s
  timeouts do not cut them.
- **Graceful shutdown** — shared `startServer` binds `0.0.0.0:${PORT}`, sets
  `keepAliveTimeout=65s` / `headersTimeout=66s` (above the ALB's 60 s), and on
  `SIGTERM` drains, closes Mongo/Redis and exits within the ECS stop timeout.
- **No hardcoded hosts** — service URLs, ports, CORS origins and the frontend
  API base all come from env vars. `127.0.0.1` defaults and localhost CORS
  origins only apply while `NODE_ENV !== "production"`.
- **Startup validation** — `validateEnv()` fails the boot on missing/invalid
  required variables (names only, never values) and warns about optional ones.
- **Structured logs** — pino JSON with `x-request-id` forwarded across services,
  cookie/authorization/token/signature redaction, and a startup line naming the
  service, version, port and pid.
- **No stack traces** — `errorHandler` returns
  `{ success: false, error: { code, message }, requestId }`; unknown 5xx errors
  keep a generic message, while deliberate 503/504s say what to retry.

---

## Before deploying

1. **Database** — put a working `MONGODB_URI` back into each service `.env`
   (Atlas → Database Access → regenerate the DB user's password; Network Access →
   allow your server IP). Keep the local `mongodb://127.0.0.1:27017/quorvex_*`
   URIs for development only. Verify with `curl localhost:8001/health`:
   `db.connected` must be `true` and the status `ok`.
2. **Secrets** — set real values for `JWT_SECRET` (identical in the gateway and
   the auth service), `JWT_REFRESH_SECRET`, `INTERNAL_API_KEY`,
   `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`, the LLM/Tavily/Qdrant/AWS keys, and
   the Firebase service account. Never commit them; prefer
   `FIREBASE_SERVICE_ACCOUNT_BASE64` so no file lands on the server.
3. **Rotate** anything that was ever written to a `.env` that could have been
   shared: the Mongo DB password, the Firebase service-account key, the
   Razorpay secret, every provider API key, and the old `INTERNAL_API_KEY`.
4. **Origins** — set `FRONTEND_URL` on the gateway and auth service to the
   deployed origin(s), comma-separated, no quotes or trailing slash. `localhost`
   origins are ignored in production.
5. **NODE_ENV=production** — enables `Secure` cookies, requires the JWT, service
   URL and `INTERNAL_API_KEY` variables, and turns the localhost defaults off.
   Set `COOKIE_SAMESITE=none` only if the SPA and API are on different sites.
6. **Frontend** — `cd frontend && npm run build` with `VITE_SERVER_URL` **empty**
   for the same-origin CloudFront setup (or an absolute API URL), then sync
   `dist/` to the S3 bucket.
7. **Check `/live`** on all five services (ECS/ALB path), then
   `curl https://<app>/health?deep=1` on the gateway and confirm every upstream
   is `up`.

---

## License

UNLICENSED — private project.
