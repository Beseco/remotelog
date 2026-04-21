FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat curl

# ─── Install dependencies ──────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev

# ─── Build ────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (no DB connection needed at build time)
RUN npx prisma generate

# Run migrations + seed (DATABASE_URL injected as build ARG by Coolify)
ARG DATABASE_URL
RUN if [ -n "$DATABASE_URL" ]; then \
      echo "Running migrations..." && \
      npx prisma migrate deploy && \
      echo "Migrations done." && \
      echo "Running seed..." && \
      npx prisma db seed && \
      echo "Seed done."; \
    else \
      echo "Skipping migrations and seed (no DATABASE_URL at build time)."; \
    fi

# Build Next.js (standalone output)
RUN npm run build

# ─── Production image ─────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next.js standalone output (includes server.js, .next/, and traced node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# @prisma/adapter-pg and its deps are not traced by Next.js standalone,
# but are needed at runtime by src/lib/prisma.ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/adapter-pg ./node_modules/@prisma/adapter-pg
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/driver-adapter-utils ./node_modules/@prisma/driver-adapter-utils
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/debug ./node_modules/@prisma/debug

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
