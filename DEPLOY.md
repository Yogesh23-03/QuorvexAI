# Deploying QuorvexAI on AWS

Everything here assumes AWS from scratch: ECR, ECS Fargate, one ALB, one
CloudFront distribution, S3 for the SPA, MongoDB Atlas, ElastiCache Redis,
Firebase, Razorpay and S3 for generated artifacts.

`backend/` is an npm-workspaces monorepo. Each image is built **from the
`backend/` directory** so `shared/` is in the build context, and each image
copies only `shared/` plus its own service. A container therefore cannot start
another service's entrypoint even if a task definition points at the wrong
image tag.

---

## 1. Services

| Service | Dockerfile (context `backend/`) | Port | Liveness (ALB/ECS) | Diagnostics                         | Suggested Fargate  | Notes                                           |
| ------- | ------------------------------- | ---- | ------------------ | ----------------------------------- | ------------------ | ----------------------------------------------- |
| gateway | `gateway/Dockerfile`            | 8000 | `GET /live`        | `GET /health`, `GET /health?deep=1` | 0.5 vCPU / 1 GB    | Public entry point behind the ALB               |
| auth    | `services/auth/Dockerfile`      | 8001 | `GET /live`        | `GET /health`                       | 0.5 vCPU / 1 GB    | bcrypt-12 on login: keep ≥0.5 vCPU              |
| chat    | `services/chat/Dockerfile`      | 8002 | `GET /live`        | `GET /health`                       | 0.25 vCPU / 0.5 GB | Mongo only                                      |
| agent   | `services/agent/Dockerfile`     | 8003 | `GET /live`        | `GET /health`                       | 1 vCPU / 2 GB      | Largest image (LangChain); long-lived responses |
| billing | `services/billing/Dockerfile`   | 8004 | `GET /live`        | `GET /health`                       | 0.25 vCPU / 0.5 GB | Razorpay calls only at checkout                 |

All five listen on `0.0.0.0:$PORT`, set `keepAliveTimeout=65s`,
`headersTimeout=66s`, and shut down gracefully on `SIGTERM` (drain ≤15s, close
Mongo/Redis, exit inside ECS's 30s stop timeout). Set the target group
deregistration delay to **30s** to match.

### Build and push

```bash
AWS_REGION=ap-south-1
ACCOUNT=<aws-account-id>
REPO=$ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com

aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com

cd backend
for svc in gateway services/auth services/chat services/agent services/billing; do
  name=$(basename "$svc")
  docker build -f "$svc/Dockerfile" -t "$REPO/quorvex-$name:$(git rev-parse --short HEAD)" .
  docker push "$REPO/quorvex-$name:$(git rev-parse --short HEAD)"
done
```

Tag every image with the commit SHA (not `latest`); that is what makes a
"which code is actually running?" question answerable. The base image is pinned
to `node:22-alpine` because production dependencies (firebase-admin 14,
LangChain/OpenAI) declare Node ≥22 — `.nvmrc` and every `engines` field now say
the same thing.

---

## 2. Configuration per service

`Required` means the service **refuses to boot** in production without it.
`Secrets` marks values that belong in AWS Secrets Manager rather than plain task
environment (they are credentials, not configuration).

### gateway

| Variable                 | Required    | Example                   | Purpose                                           |
| ------------------------ | ----------- | ------------------------- | ------------------------------------------------- |
| `NODE_ENV`               | yes         | `production`              | Enables production defaults and strict validation |
| `PORT`                   | no          | `8000`                    | Listen port                                       |
| `AUTH_SERVICE`           | yes         | `http://auth:8001`        | Auth upstream                                     |
| `CHAT_SERVICE`           | yes         | `http://chat:8002`        | Chat upstream                                     |
| `AGENT_SERVICE`          | yes         | `http://agent:8003`       | Agent upstream                                    |
| `BILLING_SERVICE`        | yes         | `http://billing:8004`     | Billing upstream                                  |
| `FRONTEND_URL`           | yes         | `https://app.example.com` | CORS allow-list (comma-separated, no quotes)      |
| `JWT_SECRET`             | yes         | —                         | Verifies access tokens (identical to auth's)      |
| `INTERNAL_API_KEY`       | yes         | —                         | Sent to every upstream as `x-internal-key`        |
| `REDIS_URL`              | recommended | `rediss://...`            | Rate limits + legacy sessions                     |
| `PROXY_TIMEOUT_MS`       | no          | `60000`                   | Per-request proxy budget (< ALB idle timeout)     |
| `AGENT_PROXY_TIMEOUT_MS` | no          | `210000`                  | Agent runs (streamed, heartbeat-kept)             |
| `REQUEST_TIMEOUT_MS`     | no          | `30000`                   | Last-resort 503 for non-agent routes              |

Secrets: `JWT_SECRET`, `INTERNAL_API_KEY`, `REDIS_URL` (it embeds a password).

### auth

| Variable                                     | Required    | Example                        | Purpose                                                     |
| -------------------------------------------- | ----------- | ------------------------------ | ----------------------------------------------------------- |
| `MONGODB_URI`                                | yes         | `mongodb+srv://…/quorvex_auth` | Users, credits, plans                                       |
| `JWT_SECRET`                                 | yes         | —                              | Access tokens (15 min)                                      |
| `JWT_REFRESH_SECRET`                         | yes         | —                              | Refresh tokens (7 days)                                     |
| `INTERNAL_API_KEY`                           | yes         | —                              | Guards `/update-plan`, `/deduct-credits`, `/refund-credits` |
| `FRONTEND_URL`                               | yes         | `https://app.example.com`      | Reset links + CORS                                          |
| `REDIS_URL`                                  | recommended | `rediss://...`                 | Refresh-token store, reset tokens                           |
| `COOKIE_SECURE`                              | no          | `true`                         | Default: true in production                                 |
| `COOKIE_SAMESITE`                            | no          | `lax`                          | `lax` same-origin, `none` only for cross-site HTTPS         |
| `COOKIE_DOMAIN`                              | no          | `.example.com`                 | Only to share cookies across subdomains                     |
| `FIREBASE_SERVICE_ACCOUNT_BASE64`            | optional    | —                              | Google sign-in; unset ⇒ hidden on the client                |
| `SMTP_HOST` + `SMTP_*`                       | optional    | —                              | Password-reset mail; unset ⇒ link is logged                 |
| `CREDIT_RESET_HOURS` / `CREDIT_RESET_AMOUNT` | no          | `5` / `100`                    | Lazy credit top-up                                          |

Secrets: `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `INTERNAL_API_KEY`,
`FIREBASE_SERVICE_ACCOUNT_BASE64`, `SMTP_PASS`.

### chat

| Variable           | Required | Example                        | Purpose                           |
| ------------------ | -------- | ------------------------------ | --------------------------------- |
| `MONGODB_URI`      | yes      | `mongodb+srv://…/quorvex_chat` | Conversations + messages          |
| `INTERNAL_API_KEY` | yes      | —                              | Every route is service-to-service |
| `REDIS_URL`        | optional | —                              | Not used by any route today       |

### agent

| Variable                                        | Required  | Example                         | Purpose                                   |
| ----------------------------------------------- | --------- | ------------------------------- | ----------------------------------------- |
| `MONGODB_URI`                                   | yes       | `mongodb+srv://…/quorvex_agent` | Health + shared model layer               |
| `AUTH_SERVICE`                                  | yes       | `http://auth:8001`              | Credit deduction / refund                 |
| `CHAT_SERVICE`                                  | yes       | `http://chat:8002`              | Persist messages, load history            |
| `INTERNAL_API_KEY`                              | yes       | —                               | Internal guard on `/chat`                 |
| `GROQ_API_KEY`                                  | per agent | —                               | chat, search, pdf, ppt                    |
| `OPENROUTER_API_KEY`                            | per agent | —                               | coding                                    |
| `GOOGLE_API_KEY`                                | per agent | —                               | image analysis                            |
| `TAVILY_API_KEY`, `QDRANT_URL`/`QDRANT_API_KEY` | optional  | —                               | Web search, PDF-RAG                       |
| `AWS_BUCKET_NAME`, `AWS_REGION`                 | optional  | `quorvex-artifacts`             | Artifact storage (prefer a task IAM role) |
| `AGENT_TIMEOUT_MS`                              | no        | `180000`                        | Hard stop for one graph run               |
| `STREAM_HEARTBEAT_MS`                           | no        | `15000`                         | Keep-alive cadence (see §5)               |

Secrets: `MONGODB_URI`, `INTERNAL_API_KEY`, provider keys, `QDRANT_API_KEY`,
`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` **only if** you are not using a task
role.

> Uploads are written to `UPLOAD_DIR` (the image sets `/tmp/quorvex-uploads`, an
> ephemeral Fargate volume). Files are deleted per request; nothing durable is
> stored locally.

### billing

| Variable              | Required | Example                           | Purpose                                       |
| --------------------- | -------- | --------------------------------- | --------------------------------------------- |
| `MONGODB_URI`         | yes      | `mongodb+srv://…/quorvex_billing` | Payment records                               |
| `AUTH_SERVICE`        | yes      | `http://auth:8001`                | Apply the plan upgrade / read credits         |
| `INTERNAL_API_KEY`    | yes      | —                                 | Internal guard                                |
| `RAZORPAY_KEY_ID`     | yes      | `rzp_live_…`                      | Order creation (also returned to the browser) |
| `RAZORPAY_KEY_SECRET` | yes      | —                                 | HMAC signature verification                   |

Secrets: `MONGODB_URI`, `RAZORPAY_KEY_SECRET`, `INTERNAL_API_KEY`.

### frontend (build-time only)

| Variable               | Required        | Example      | Purpose                             |
| ---------------------- | --------------- | ------------ | ----------------------------------- |
| `VITE_SERVER_URL`      | **leave empty** | —            | Empty = same origin (`/api/...`)    |
| `VITE_FIREBASE_*`      | optional        | —            | Google sign-in (hidden when absent) |
| `VITE_RAZORPAY_KEY_ID` | optional        | `rzp_live_…` | Fallback when billing omits `keyId` |

Build, then upload `frontend/dist/` to the S3 bucket:

```bash
cd frontend
npm ci
npm run build            # requires no VITE_SERVER_URL for same-origin
aws s3 sync dist/ "s3://<bucket>/" --delete
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```

---

## 3. Inter-service calls

| From    | To      | Paths                                                     | Variable          |
| ------- | ------- | --------------------------------------------------------- | ----------------- |
| gateway | auth    | `/api/auth/*` → `/*`, `/api/me` → `/me`                   | `AUTH_SERVICE`    |
| gateway | chat    | `/api/chat/*`                                             | `CHAT_SERVICE`    |
| gateway | agent   | `/api/agent/*`                                            | `AGENT_SERVICE`   |
| gateway | billing | `/api/billing/*`                                          | `BILLING_SERVICE` |
| agent   | auth    | `POST /deduct-credits`, `POST /refund-credits`, `GET /me` | `AUTH_SERVICE`    |
| agent   | chat    | `POST /save-message`, `GET /get-messages/:id`             | `CHAT_SERVICE`    |
| billing | auth    | `POST /update-plan`, `GET /credits`                       | `AUTH_SERVICE`    |

Every one of these calls forwards `x-request-id` and `x-internal-key`. The
gateway adds `x-user-id` after verifying the JWT; the services trust it only
because the internal key is required in production.

Wire them up with **ECS Service Connect** (`http://auth:8001`) or an internal
ALB. Only the gateway's target group is attached to the public ALB listener.

---

## 4. ALB, CloudFront, S3

**Target group** (one per service, or one per service with path rules): protocol
HTTP, health check path **`/live`**, 5s timeout, 30s interval, healthy 2 /
unhealthy 3, deregistration delay **30s**. Use `/live`, not `/health`: a Mongo
or Redis blip must never replace all healthy tasks.

**ALB**: idle timeout 60s (default). Keep it **below** the gateway's
`keepAliveTimeout` (65s) — the node defaults (5s keep-alive) are the classic
source of sporadic 502s on a load-balanced Node service.

**CloudFront** — one distribution, two origins:

| Path            | Origin                 | Behaviour                                                                                                                                                                                                    |
| --------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/api/*`        | ALB                    | All methods; cache **disabled**; forward `Authorization`, `Origin`, `Cookie`, `Content-Type`; **Origin request policy: AllViewer**; **response headers policy: none that strips `Set-Cookie`**; compress off |
| `default` (`*`) | S3 REST/website origin | `CachingOptimized`; compress on                                                                                                                                                                              |

Also on the distribution:

- **Custom error response**: 403 and 404 → `/index.html` with **200**. Without
  it every deep link and page refresh (`/chat`, `/settings`, `/reset-password`)
  returns S3's 403/404 instead of the app.
- **Allowed methods**: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE.
- **Origin request policy must forward `Origin`** — the gateway's CORS allow-list
  compares it, and the browser needs `Access-Control-Allow-Credentials` for the
  session cookies.
- Cache `/api/*` **never**. API responses are `Cache-Control: no-store`, but a
  cache behaviour with a TTL would still replay one user's body to the next.

**S3**: private bucket, CloudFront Origin Access Control, no public access.
Upload `dist/` only — never `.env`, source maps or `node_modules`.

---

## 5. Long agent runs (the 30s/60s problem)

CloudFront's origin-response timeout defaults to 30s and the ALB's idle timeout
to 60s. An agent run can take minutes, so the naive "POST and wait for JSON"
shape dies at the edge.

**Chosen design: JSON-safe heartbeats.** Once credit checks pass, the agent
service flushes the response head immediately and writes a `\n` every
`STREAM_HEARTBEAT_MS` (15s) while the graph runs; the final body is the same
JSON object as before. Leading/trailing whitespace is legal JSON, so the client
parses one normal response — the UI is unchanged, no polling, no job store, and
no extra state to keep consistent across tasks.

The gateway proxies with `stream: true` so those bytes are forwarded rather than
buffered, and it gives `/api/agent` its own `AGENT_PROXY_TIMEOUT_MS` (default
210s) instead of the normal 60s budget.

Errors raised **before** the head is sent keep their real status (401, 402 out
of credits, 429). Errors **during** a run arrive as `{success:false, error:{…}}`
in a 200 body; the client turns that back into the same error object, so the
toast is identical. If you would rather have a job id + polling, the hook points
are `services/agent/controllers/agent.controller.js` (enqueue/return 202) and
`frontend/src/features/agent.js` (poll instead of awaiting).

---

## 6. Cookies and CORS

| Deployment shape                               | `COOKIE_SECURE` | `COOKIE_SAMESITE` | `FRONTEND_URL`           |
| ---------------------------------------------- | --------------- | ----------------- | ------------------------ |
| One distribution, `/api/*` → ALB (recommended) | `true`          | `lax`             | the CloudFront origin(s) |
| SPA on a different site than the API           | `true`          | `none`            | the SPA origin(s)        |

Leaving `COOKIE_SAMESITE` unset is recommended: the auth service decides per
request (`lax` when the browser says same-origin, `none` when it says
cross-site), so a frontend host and an API host on different platforms keep the
session across reloads without anybody remembering this table. A Lax cookie on a
cross-site call is stored but never sent back, which is what made every refresh
look like a sign-out.

With cookies blocked, the app still works for the lifetime of the tab: the
access token is held in memory and sent as `Authorization: Bearer`. A reload
finds no session and shows the sign-in page — there is no redirect loop, because
the refresh interceptor retries a 401 at most once and auth endpoints are
excluded from it.

`FRONTEND_URL` is a comma-separated allow-list. Quotes and trailing slashes are
stripped before comparison; localhost origins are only accepted outside
production.

---

## 7. What previously broke, and what the code does now

| Symptom                                                                                                                                | Root cause                                                                                                                                                                                                                                                                                                   | Fix                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every auth POST hung (gateway 504, no auth log), GET/OPTIONS fine, gateway `/health` showed all upstreams down, Redis in "memory" mode | The Redis handshake had no timeout and the in-flight connect promise was cached: one half-open socket (plaintext client against a TLS-only ElastiCache port) wedged every request that touched the cache — the login/register rate limiter, the refresh store, `/health`. Nothing failed, so nothing logged. | `shared/redis/redis.js`: bounded connect + command timeouts, TLS for `rediss://`, destroyed sockets, fail-fast 503, background retry. Reproduced and covered by tests. |
| Requests could hang forever for any other reason                                                                                       | No request budget, no server timeouts                                                                                                                                                                                                                                                                        | `shared/request.js` (`requestTimeout`), `shared/server.js` (keep-alive/headers/request timeouts)                                                                       |
| Tasks restarted during a dependency blip                                                                                               | ECS health check on `/health`, which returned 503 when dependencies were down                                                                                                                                                                                                                                | `/live` (no I/O) for ECS/ALB; `/health` always 200 with `status: degraded`                                                                                             |
| Gateway 502/504 with empty bodies                                                                                                      | Unbounded proxy, no streaming, upstream errors not mapped                                                                                                                                                                                                                                                    | `proxyWithHeader`: `stream: true`, 60s default budget, JSON 503/504                                                                                                    |
| Previous deployment ran the wrong service's code                                                                                       | Single `FROM node` build with `npm start`                                                                                                                                                                                                                                                                    | Per-service image containing only that service + `shared/`, exec-form `CMD`, startup log with service/version/pid                                                      |
| Deep links 404 on refresh                                                                                                              | No SPA fallback                                                                                                                                                                                                                                                                                              | CloudFront custom error response 403/404 → `/index.html` (200), §4                                                                                                     |

---

## 8. Manual checks after `terraform apply` / console work

1. Each task's health check is green on **`/live`**; the service is stable for
   10 minutes with no restarts.
2. `curl -s https://app.example.com/health?deep=1` (gateway) and confirm all
   four upstreams report `up`.
3. `POST /api/auth/register` with an email/password returns **201 in under 2s**
   (not a timeout) — this is the regression that mattered.
4. `POST /api/auth/login` returns 200, sets `access` and `refresh` cookies with
   `HttpOnly; Secure; SameSite=Lax`, and `GET /api/me` works afterwards.
5. Refresh: wait 15 minutes (or delete the in-memory token), reload `/chat`,
   confirm the session is restored without a redirect loop.
6. Google sign-in (only if Firebase is configured), Razorpay checkout with a
   test order, and one **agent run per agent** — watch the connection stay open
   past 30s for `coding`/`pdf` and complete with an artifact.
7. Reload `/chat`, `/pricing` and `/reset-password?token=x` directly: all must
   render the SPA, not an S3 error page.
8. Stop one non-critical target (e.g. billing) and confirm: other endpoints keep
   working, `/health?deep=1` shows billing `down`, and no task is restarted.
9. Terminate a task manually: the log must show `shutdown started` →
   `shutdown complete` before the process exits.

---

## 9. Not verified here

- `docker build` and container runs could not be completed on this machine:
  the Docker daemon fails with `input/output error` because the host disk is
  full. What did run was the dependency stage: `npm ci --omit=dev` succeeded
  from the workspace lockfile and reported only engine warnings (which is how
  the Node 20 → 22 correction was found). Final image assembly, non-root
  startup and a `/live` probe inside a container still need a machine with free
  disk.
- No real Firebase service account, Razorpay live keys, Atlas cluster,
  ElastiCache endpoint or AWS account was available, so those paths are covered
  by tests and code review, not by a live call.
- CloudFront/ALB timeout behaviour (heartbeats) is implemented and unit-tested
  at the service level, but only a deployed distribution can prove the edge
  behaviour end to end.
