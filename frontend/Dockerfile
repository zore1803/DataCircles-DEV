# --- Build stage ---
FROM node:20-slim AS build

# Built with the repo root as build context (not just frontend/) so that
# ../../../../shared/documentTemplates.js (imported by
# src/components/invoice/TemplateDrawer.jsx) resolves inside the image.
# WORKDIR mirrors the repo layout so that relative path still works.
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install
COPY frontend/. .
COPY shared /app/shared

# Build-time env vars (VITE_*) must be passed via --build-arg / compose `args`
ARG VITE_APP_API_URL
ARG VITE_APP_AUTH0_DOMAIN
ARG VITE_APP_AUTH0_AUDIENCE
ARG VITE_APP_AUTH0_CLIENT_ID
ARG VITE_INTERCOM_APP_ID
ENV VITE_APP_API_URL=$VITE_APP_API_URL
ENV VITE_APP_AUTH0_DOMAIN=$VITE_APP_AUTH0_DOMAIN
ENV VITE_APP_AUTH0_AUDIENCE=$VITE_APP_AUTH0_AUDIENCE
ENV VITE_APP_AUTH0_CLIENT_ID=$VITE_APP_AUTH0_CLIENT_ID
# Without this the Messenger never boots in the image: APP_ID is read at
# build time by Vite, so an unset arg bakes in `undefined`.
ENV VITE_INTERCOM_APP_ID=$VITE_INTERCOM_APP_ID
# Node's default V8 old-space heap limit doesn't scale with the extra memory
# swap provides, so a Vite/Rollup build can still OOM-crash (exit 134) on a
# small instance even with swap enabled. Raise the cap explicitly.
ENV NODE_OPTIONS=--max-old-space-size=3072
RUN npm run build

# --- Serve stage ---
FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
