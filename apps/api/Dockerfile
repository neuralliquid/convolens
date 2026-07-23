FROM node:24-alpine AS builder

WORKDIR /repo
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm install -g pnpm@8.15.4

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY tools ./tools

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @convolens/api build

FROM node:24-alpine AS runtime

WORKDIR /repo
ENV NODE_ENV=production

COPY --from=builder /repo ./

RUN mkdir -p apps/api/data apps/api/logs apps/api/uploads

WORKDIR /repo/apps/api
EXPOSE 3001

CMD ["node", "dist/index.js"]
