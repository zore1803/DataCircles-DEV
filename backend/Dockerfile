FROM node:20-slim

# Puppeteer needs Chromium + its system libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libgbm1 \
    libnss3 \
    libpangocairo-1.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Point Puppeteer at the system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Built with the repo root as build context (not just backend/) so that
# ../../shared/documentTemplates.js (imported by backend/utils/htmlDocumentPdf.js)
# resolves inside the image. WORKDIR mirrors the repo layout so those
# relative paths still work at runtime.
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/. .
COPY shared /app/shared

EXPOSE 5000

CMD ["node", "server.js"]
