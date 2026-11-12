# syntax=docker/dockerfile:1
#
# Build from backend/ so shared/ is in the context:
#   docker build -f services/auth/Dockerfile -t quorvex-auth .
#
# Base image is pinned to .nvmrc; never "FROM node" (latest).

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
    PORT=8001
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY shared ./shared
COPY services/auth ./services/auth

USER node
EXPOSE 8001

CMD ["node", "services/auth/index.js"]
