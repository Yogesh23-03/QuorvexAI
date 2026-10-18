# QuorvexAI — Audit & Verification Report

Date: 2026-10-17 · Branch: `feature/analytics-and-search-api`

## 1. Rename to QuorvexAI

A case-insensitive search for the legacy brand returns **no matches in
application code, packages, config, assets or build output**. The only remaining
mentions are the historical note in `README.md` and this report. Package names,
page title/meta, navbar/footer, agent prompts ("QuorvexAI Coding Agent"),
emails and comments all use QuorvexAI / `quorvex-ai`. Mongo database names are `quorvex_auth`, `quorvex_chat`,
`quorvex_agent`, `quorvex_billing`, `quorvex_gateway`; Redis keys use
`session-*`, `rl:*`, `agentlimit:*` prefixes (no vendor name).

No collections were renamed, so existing data keeps working.

## 2. Issues found → fixed

| #   | Area     | Issue                                                                                                 | Fix                                                                                            |
| --- | -------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | Build    | Vite 8 (rolldown) rejected `manualChunks` as an object                                                | Replaced with dynamic-import splitting                                                         |
| 2   | Build    | `Github` icon removed from lucide-react 1.59 → build error                                            | `ExternalLink`                                                                                 |
| 3   | Build    | Manual chunks made rolldown module-preload Monaco + three + markdown (≈500 KB gz) on the landing page | Removed manual chunks; only the route chunk is preloaded                                       |
| 4   | Perf     | Razorpay `checkout.js` loaded synchronously on every page                                             | Removed from `index.html`; `features/billing.js` already injects it on demand                  |
| 5   | Perf     | Google Fonts CSS was render-blocking                                                                  | Preload + async `media="print"` swap; Orbitron uses `display=optional`                         |
| 6   | Perf     | Hero typewriter caused 0.3 CLS (layout below shifted per character)                                   | Full copy rendered invisibly to reserve space; animation is an overlay                         |
| 7   | Perf     | Firebase Web SDK (~33 KB gz) in the initial bundle                                                    | Lazy `import()` of `firebase/app` + `firebase/auth` on sign-in/out                             |
| 8   | Perf     | Infinite Framer animations on `display:none` desktop chips + full-screen canvas ran on phones         | Chips not mounted below `lg`; particle canvas disabled below `md`                              |
| 9   | Perf     | One React render per typed character; four count-up rAF loops                                         | Batched typing; count-up capped at ~30 fps and skips no-op updates                             |
| 10  | Lint     | `setState` synchronously inside `useEffect` (ArtifactPanel)                                           | Reset state during render when the artifact id changes                                         |
| 11  | Lint     | Backend had no ESLint flat config                                                                     | Added `backend/eslint.config.js`; removed unused import                                        |
| 12  | UI       | Navbar overflowed horizontally at 390 px (logo + CTA + menu)                                          | Wordmark hidden below `xs`, logo mark kept; verified `scrollWidth === clientWidth`             |
| 13  | Security | Signature check ran even when `RAZORPAY_KEY_SECRET` was unset (HMAC of `""` is forgeable)             | 503 `PAYMENTS_UNAVAILABLE` before verification                                                 |
| 14  | Ops      | `billing/.env` had no `REDIS_URL`, so its health check could never report Redis                       | Added key + documented it in `.env.example`; verified `redis: {connected: true}` after restart |
| 15  | Repo     | No root `.gitignore`, no `.env.example` files, no backend Prettier/ESLint, no README                  | Added all of them; Prettier applied across `frontend/src` and `backend`                        |

Already correct on inspection: atomic credit deduction
(`findOneAndUpdate` with `credits: { $gte: cost }`), refund on any agent
failure, idempotent payment claiming, amount cross-check with Razorpay,
ownership checks on conversations, 20 MB upload limits with MIME allow-list,
request-id propagation gateway → services, graceful SIGTERM in every service.

## 3. Open items that need your decision

1. **Firebase service-account key is in the working tree**
   (`backend/services/auth/serviceAccountKey.json`, real private key, project
   `quorvex-6709f`). It is now git-ignored, but **rotate it** in Google Cloud
   and switch to `FIREBASE_SERVICE_ACCOUNT_BASE64`.
2. **Real `.env` files contain live keys** (OpenRouter, Groq, Gemini, Tavily,
   AWS, Qdrant, Razorpay, Mongo Atlas). They are git-ignored now. If this tree
   was ever pushed, rotate the non-Firebase keys too. The Firebase _web_ API key
   in `frontend/.env` is public by design.
3. **Mongo Atlas rejects fresh connections** with `bad auth` from the current
   `MONGODB_URI` (services that were already running still answer `/health`
   from their existing pool). Validate the URI/user before deployment.
4. **No Razorpay webhook.** Credits are only granted after the client callback
   verifies the signature; a closed browser after payment leaves the order in
   `created`. A webhook would make this self-healing.
5. **Agent-limit counter is not rolled back** when an agent run fails after the
   credit reservation (credits are refunded, the per-minute counter is not).
6. **Mobile Lighthouse performance is 78–85**, below the 85 target on throttled
   4G (desktop is 97). Remaining budget is React + Framer in the entry chunk.

## 4. Verification results

Commands run from the repo root:

```
backend:  npx eslint .        → 0 problems
          npx vitest run      → 9 files, 89 tests passed (see §5.4 for the new suite)
frontend: npx eslint .        → 0 problems
          npx vitest run      → 5 files, 28 tests passed
          npm run build       → success (dist/, entry 160 KB gz)
```

Every service was booted (`PORT` 8000–8004) and answered `/health`:

| Service       | Status   | DB                        | Redis | Notes                                                                                                                                    |
| ------------- | -------- | ------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| gateway :8000 | ok       | n/a                       | redis | upstreams: auth/chat/agent up, billing degraded (fixed by `REDIS_URL`)                                                                   |
| auth :8001    | ok       | connected                 | redis | firebase credentials from file                                                                                                           |
| chat :8002    | ok       | connected                 | redis |                                                                                                                                          |
| agent :8003   | ok       | connected                 | redis | all six provider flags true                                                                                                              |
| billing :8004 | degraded | disconnected (`bad auth`) | redis | Redis fix verified by restarting on :8104; Atlas rejects the configured credentials, so `/health` stays 503 until `MONGODB_URI` is valid |

### Flow checks

| Flow                                   | Status  | Notes                                                                                  |
| -------------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| Landing page render (desktop + 390 px) | PASS    | no horizontal overflow, 3D core on desktop, static core on mobile                      |
| Pricing page + plan cards              | PASS    | renders, table scrolls inside its card                                                 |
| `/chat` while signed out → `/login`    | PASS    | `RouteGuard` redirect observed in the browser and unit test                            |
| 404 route                              | PASS    | renders the 404 page for unknown paths                                                 |
| Google login → dashboard               | NOT RUN | needs a real Firebase popup + backend session; cannot be automated here                |
| New chat / send to each agent          | PARTIAL | agent endpoints covered by mocked integration tests; live provider calls not exercised |
| Artifact panel (tabs + iframe)         | PARTIAL | component tests + code review; not clicked through without a session                   |
| Chat history reload                    | PARTIAL | chat CRUD/ownership tests pass; live UI not exercised                                  |
| Credit balance update                  | PARTIAL | atomic deduct/refund tests pass; UI path not exercised                                 |
| Razorpay checkout → credits            | PARTIAL | order + signature tests (mocked SDK) pass; test-mode checkout needs a signed-in user   |
| Logout                                 | NOT RUN | same Firebase constraint                                                               |
| Reduced motion / keyboard / aria       | PASS    | Accessibility 100 in Lighthouse                                                        |

### Lighthouse (production build served with gzip) — superseded by §5.6

| Profile | Performance | Accessibility | Best Practices | SEO |
| ------- | ----------- | ------------- | -------------- | --- |
| Desktop | **97**      | **100**       | 96             | 91  |
| Mobile  | **80–83**   | **100**       | 96             | 91  |

Mobile metrics: FCP ≈ 2.3 s, LCP ≈ 3.6–4.1 s, TBT ≈ 170–450 ms, CLS ≈ 0.06.

---

## 5. Round 2 — verification, fixes and measurements

Date: 2026-10-18 · Branch: `feature/analytics-and-search-api`

### 5.1 Blocking bug found and fixed: the gateway used a different JWT secret

`POST /api/auth/login` returned 200 and set `access`/`refresh` cookies, but every
authenticated call through the gateway answered **401 "Your session expired"**.
Cause: `services/auth/.env` set `JWT_SECRET` while `gateway/.env` did not, so the
auth service signed tokens with the configured secret and the gateway verified
them with the shared development fallback in `shared/tokens.js`.

- `gateway/.env.example` now documents `JWT_SECRET` with the requirement that it
  matches `services/auth/.env`.
- `backend/gateway/config/services.js` gained `assertAuthConfig()`, called from
  `gateway/index.js` before the app is created: in production a missing
  `JWT_SECRET` **fails startup**, in development it logs a warning naming the
  consequence. `logConfig()` reports `jwt: env | development-fallback`.
- The local `gateway/.env` received the same value as `services/auth/.env`
  (copied, never printed) and the flow was re-verified end to end.

### 5.2 Navbar overflow at 768–1023 px

`document.scrollWidth` was 910 px in a 758 px viewport (measured in the browser):
the credits pill's decorative balance bar, the plan name and the three-way theme
switch all rendered at once. Fixes: balance bar `lg:block`, plan name `xl:inline`,
`ThemeToggle` compact (cycling) below `lg`, tighter `md` nav-link padding and
gaps. Re-measured: navbar `scrollWidth === clientWidth` at 360, 768, 1024, 1280
and 1920 px.

### 5.3 Dead code removed

| File                                             | Why                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `frontend/vite-project/**`                       | legacy pre-redesign app (removed earlier in the redesign)        |
| `frontend/src/components/three/HeroVisual.jsx`   | never imported                                                   |
| `frontend/src/components/three/AICoreScene.jsx`  | only reachable from `HeroVisual` (old neural-core/particle look) |
| `frontend/src/components/chat/ArtifactPanel.jsx` | superseded by `ArtifactCard` + `SandboxPanel`; never imported    |
| `@monaco-editor/react` (dependency)              | only consumer was the deleted `ArtifactPanel`                    |

### 5.4 New tests: the 5-hour credit reset

`backend/tests/auth/credits-reset.test.js` — 7 tests on a mocked clock
(`vi.useFakeTimers({ toFake: ["Date"] })`, so Mongo/Redis keep working): no reset
before the window, top-up below the amount after it, purchased credits above the
amount untouched, exactly one reset under six concurrent calls, `CREDIT_RESET_HOURS`
/ `CREDIT_RESET_AMOUNT` overrides, `nextResetAt` on `/me` and `/credits`, and the
unknown-user / no-anchor edges. There is no user cache in Redis, so nothing has to
be invalidated next to the atomic update (Redis holds tokens, rate-limit windows
and agent counters only).

### 5.5 Live verification (local Mongo/Redis, all five services)

| Check                                                 | Result           | Evidence                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/health` on 8000–8004                                | PASS             | all five return 200 `ok` with `db.connected` + `redis.connected`                                                                                                                                                                                                           |
| register → 100 credits + `nextResetAt`                | PASS             | `POST /api/auth/register` → 201/200 with the cookie pair                                                                                                                                                                                                                   |
| password login → authenticated call                   | PASS (after 5.1) | `/api/me` 200, `/api/chat/get-conversations` 200, `create-conversation` 201                                                                                                                                                                                                |
| CORS allows only the configured origin                | PASS             | `127.0.0.1:5173` blocked, `localhost:5173` allowed                                                                                                                                                                                                                         |
| Chat shell is exactly 100dvh, no page scroll          | PASS             | `scrollHeight === clientHeight === 727` at 1280×800; both axes report no page scroll                                                                                                                                                                                       |
| Only the list scrolls                                 | PASS             | sidebar list and message list are the only scroll containers                                                                                                                                                                                                               |
| Input bar visible, chips in one row                   | PASS             | textarea bottom 684 < 727; 7 chips, `flex-wrap: nowrap`, `overflow-x: auto`, 1 row                                                                                                                                                                                         |
| Bubbles: fit-content, 75 %/85 % cap, no word breaking | PASS             | user bubble 576 px of a 768 px column (75 %), `word-break: normal`, `scrollWidth === clientWidth`; AI left with 32 px avatar, user right                                                                                                                                   |
| Markdown answer rendering                             | PASS             | headings, ordered list, table, fenced block with language + COPY button, external link (rehype `target="_blank" rel="noreferrer"`), table inside an `overflow-x-auto` wrapper                                                                                              |
| "Scroll to newest message" button                     | PASS             | present in the message list header region                                                                                                                                                                                                                                  |
| Sidebar fits and pins credits/profile                 | PASS             | 288 px wide, height 663 ≤ 727, bottom flush at 727; footer reads `CREDITS free 100 / 100 · Resets in 4h 55m · QA Operator`                                                                                                                                                 |
| Mobile drawer                                         | PASS             | at 360 px closed: `translate: -100%`, `left: -288`; hamburger renders the z-40 overlay and slides the drawer in                                                                                                                                                            |
| Theme toggle + persistence                            | PASS             | two explicit buttons, light + dark (no system option); `localStorage["quorvex-theme"]` follows; `html.dark` toggles; first visit seeded from `prefers-color-scheme`                                                                                                        |
| No flash of the wrong theme                           | PASS             | inline script in `<head>` (before the module script) applies the stored class                                                                                                                                                                                              |
| Contrast (WCAG AA)                                    | PASS             | dark: ink 14.0, soft 6.98, faint 5.71, hud 8.05, lime 11.44, dark-on-orange 7.06. light: ink 14.87, soft 6.39, faint 5.04, hud 5.17, lime 4.99, dark-on-orange 5.19 — all ≥ 4.5. Orange on the ceramic canvas is 3.4:1, so it is used for large text, icons and fills only |

### 5.6 Lighthouse (production build, `vite preview`, headless Chrome)

| Profile            | Run                              | Performance | Accessibility | Best Practices | SEO     |
| ------------------ | -------------------------------- | ----------- | ------------- | -------------- | ------- |
| Desktop            | before this round                | 69 / 67     | 100           | 96             | 100     |
| Desktop            | after idle-mounting the 3D scene | **81**      | **100**       | 96             | **100** |
| Mobile (throttled) | after the same change            | **74**      | **100**       | 96             | **100** |

Metrics (desktop): FCP 1.1 s, LCP 1.1 s, TBT 660–770 ms → **340 ms**, CLS 0.001.
Mobile: FCP 3.9 s, LCP 4.3 s, TBT 190 ms, CLS 0.002.

Fix applied: `RobotMascot` now mounts the WebGL scene on `requestIdleCallback`
(1.5 s timeout, `setTimeout` fallback) with the static SVG glyph covering the gap.
Bootup time from the lazy three.js chunk dropped out of the critical window.

Remaining gap: Performance is still below the ≥ 85 target because the entry chunk
(React 19 + Redux + `motion` + router, ~150 KB gz) contributes a 542 ms long task.
Next levers, in order: replace `motion` transitions on the landing page with CSS
transitions, split the Redux store per route, and lazy-mount the floating `fx`
layers. The earlier full-app run recorded 97 desktop / 80–83 mobile, so these
numbers also depend on machine load — re-measure on an idle machine before/after
the next change.

The 3D/scroll screenshots could not be captured in this environment: the embedded
preview webview reports `document.hidden === true` and never fires
`requestAnimationFrame`, which stalls (a) page screenshots and (b) `AnimatePresence`
exit transitions. All layout evidence above is therefore DOM/geometry measurements
in the live app, which are unaffected.

### 5.7 Environment risk fixed in the docs

`backend/services/auth/.env.example` and `backend/gateway/.env.example` now list
every variable the code reads (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_DOMAIN`,
`CREDIT_RESET_HOURS`, `CREDIT_RESET_AMOUNT`, `FRONTEND_URL`, `SMTP_*`, `MAIL_FROM`),
and `README.md` documents the auth flows, the reset rule, the palette, the theme
system and a deployment-readiness checklist.
