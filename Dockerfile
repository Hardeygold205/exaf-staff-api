# syntax=docker/dockerfile:1

# ---- Stage 1: install all dependencies ----
FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- Stage 2: generate Prisma client, compile, then strip dev deps ----
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/placeholder"
ENV DIRECT_URL="postgresql://user:pass@localhost:5432/placeholder"
RUN pnpm prisma:generate
RUN pnpm build
RUN pnpm prune --prod

# ---- Stage 3: final runtime image ----
FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY prisma.config.ts ./
COPY package.json ./

EXPOSE 5002
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema && node dist/main"]