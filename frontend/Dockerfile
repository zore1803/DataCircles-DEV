# --- Build stage ---
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Build-time env vars (VITE_*) must be passed via --build-arg / compose `args`
ARG VITE_APP_API_URL
ARG VITE_APP_AUTH0_DOMAIN
ARG VITE_APP_AUTH0_AUDIENCE
ARG VITE_APP_AUTH0_CLIENT_ID
ENV VITE_APP_API_URL=$VITE_APP_API_URL
ENV VITE_APP_AUTH0_DOMAIN=$VITE_APP_AUTH0_DOMAIN
ENV VITE_APP_AUTH0_AUDIENCE=$VITE_APP_AUTH0_AUDIENCE
ENV VITE_APP_AUTH0_CLIENT_ID=$VITE_APP_AUTH0_CLIENT_ID
RUN npm run build

# --- Serve stage ---
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
