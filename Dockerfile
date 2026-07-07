# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM node:20-slim AS build
WORKDIR /app

# Prisma's query engine needs OpenSSL present even at build/generate time.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first (better layer caching). Copy every workspace
# manifest + the lockfile so `npm ci` can resolve the whole workspace tree.
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci

# Copy the rest of the source (dev.db, .env, node_modules excluded via .dockerignore).
COPY . .

# Generate the Prisma client, then build the client SPA and compile the server.
RUN npx prisma generate --schema server/prisma/schema.prisma
RUN npm run build

# ---------- Runtime stage ----------
FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
# SQLite lives on the mounted volume so data survives redeploys.
ENV DATABASE_URL="file:/data/pacemaker.db"

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Carry the fully-installed node_modules from the build stage. This intentionally
# keeps the `prisma` CLI and the generated client (with its matching query-engine
# binary) available so `prisma migrate deploy` runs offline at container start —
# no second `npm install` and no network dependency at boot.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/client/package.json ./client/package.json

# Build outputs + Prisma schema/migrations. The server resolves the SPA at
# ../../client/dist relative to server/dist, so the monorepo layout is preserved.
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/prisma ./server/prisma
COPY --from=build /app/client/dist ./client/dist

VOLUME /data
EXPOSE 3001

# Apply migrations (creates the DB on first boot), then start the single service.
# index.js seeds demo data itself when SEED_DEMO=true and the DB is empty.
CMD ["sh", "-c", "npx prisma migrate deploy --schema server/prisma/schema.prisma && node server/dist/index.js"]
