# Cloud Run 用: Node.js + Chromium + Next.js standalone
FROM node:20-bookworm-slim AS base

# baseステージはNext.jsのビルドのみに使用するため、Chromiumは不要

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# 依存関係（ビルドに TypeScript 等が必要なため dev も入れる）
COPY package.json package-lock.json* ./
RUN npm ci

# ソースをコピーしてビルド
COPY . .
RUN npm run build

# 本番用イメージ
FROM node:20-bookworm-slim AS runner

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=8080
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static

EXPOSE 8080

CMD ["node", "server.js"]
