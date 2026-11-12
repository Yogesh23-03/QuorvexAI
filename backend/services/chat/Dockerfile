# syntax=docker/dockerfile:1
#
# Build from backend/ so shared/ is in the context:
#   docker build -f services/chat/Dockerfile -t quorvex-chat .

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
    PORT=8002
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY shared ./shared
COPY services/chat ./services/chat

USER node
EXPOSE 8002

CMD ["node", "services/chat/index.js"]
