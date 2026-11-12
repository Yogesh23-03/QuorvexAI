# syntax=docker/dockerfile:1
#
# Build from backend/ so shared/ is in the context:
#   docker build -f gateway/Dockerfile -t quorvex-gateway .
#
# Base image is pinned to the version in .nvmrc. `FROM node` (latest) means a
# rebuild can silently jump to a new Node major — the deployment that first hit
# the hung-POST bug was built that way, so it could never be reproduced locally.

# ---------- dependencies ----------
FROM node:22-alpine AS deps
ENV NODE_ENV=production
WORKDIR /app

# Manifests only, so a source edit does not invalidate the npm layer. The whole
# workspace lockfile is installed because that is the only reproducible install
# npm offers for a workspace repo.
COPY package.json package-lock.json ./
COPY gateway/package.json ./gateway/
COPY services/auth/package.json ./services/auth/
COPY services/chat/package.json ./services/chat/
COPY services/agent/package.json ./services/agent/
COPY services/billing/package.json ./services/billing/
RUN npm ci --omit=dev && npm cache clean --force

# ---------- runtime ----------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8000
WORKDIR /app

# Production dependencies only, and only this service's code + shared/. The
# image therefore cannot start another service's entrypoint even by accident.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY shared ./shared
COPY gateway ./gateway

USER node
EXPOSE 8000

# exec form: SIGTERM reaches node, so the graceful shutdown in shared/server.js
# actually runs instead of being swallowed by a shell or npm.
CMD ["node", "gateway/index.js"]
