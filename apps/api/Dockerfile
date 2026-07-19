FROM node:24-alpine AS builder

WORKDIR /repo
RUN corepack enable

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
