# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production

# Vite has no runtime env — every VITE_* var must be a build ARG, plumbed to
# ENV before `npm run build` so import.meta.env picks it up (DESIGN.md B9 /
# BRIEF-CRM-CONFIG §6). This Dockerfile previously declared none at all, so
# the production bundle could silently ship `undefined` for
# VITE_SUPABASE_URL/ANON_KEY unless Coolify injected them out-of-band —
# confirm with ops how these are actually supplied before assuming this
# alone is sufficient in prod (Blocker B9).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_RESIDALE_SSO_COOKIE_ENABLED=true
ARG VITE_RESIDALE_APP_CRM_URL=https://crm.residale.com
ARG VITE_RESIDALE_APP_WEBMAIL_URL=https://webmail.residale.com
ARG VITE_RESIDALE_APP_FILES_URL=https://files.residale.com
ARG VITE_RESIDALE_APP_CONFIG_URL=https://config.residale.com

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_RESIDALE_SSO_COOKIE_ENABLED=$VITE_RESIDALE_SSO_COOKIE_ENABLED
ENV VITE_RESIDALE_APP_CRM_URL=$VITE_RESIDALE_APP_CRM_URL
ENV VITE_RESIDALE_APP_WEBMAIL_URL=$VITE_RESIDALE_APP_WEBMAIL_URL
ENV VITE_RESIDALE_APP_FILES_URL=$VITE_RESIDALE_APP_FILES_URL
ENV VITE_RESIDALE_APP_CONFIG_URL=$VITE_RESIDALE_APP_CONFIG_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN test -n "$VITE_SUPABASE_URL" && test -n "$VITE_SUPABASE_ANON_KEY"
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN apk add --no-cache curl
COPY --from=builder /app/.output ./.output
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", ".output/server/index.mjs"]
