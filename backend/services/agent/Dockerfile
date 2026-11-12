# syntax=docker/dockerfile:1
#
# Build from backend/ so shared/ is in the context:
#   docker build -f services/agent/Dockerfile -t quorvex-agent .
#
# This image carries the LLM stack and is the largest of the five; it also needs
# CPU headroom, because every request holds a connection open while a graph runs.

FROM node:22-alpine AS deps
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY gateway/package.json ./gateway/
COPY services/auth/package.json ./services/auth/
COPY services/chat/package.json ./services/chat/
COPY services/agent/package.json ./services/agent/
COPY services/billing/package.json ./services/billing/
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8003 \
    UPLOAD_DIR=/tmp/quorvex-uploads
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY shared ./shared
COPY services/agent ./services/agent

# multer writes multipart uploads here; the process runs as `node` (uid 1000).
RUN mkdir -p /tmp/quorvex-uploads && chown -R node:node /tmp/quorvex-uploads

USER node
EXPOSE 8003

# ECS sends SIGTERM to PID 1: exec form and no shell so the graceful shutdown
# in shared/server.js runs (uploads are cleaned per request, nothing to drain).
CMD ["node", "services/agent/index.js"]
