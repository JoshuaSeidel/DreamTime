# Build stage
FROM node:20-alpine AS builder

# Install bash for setup script
RUN apk add --no-cache bash

WORKDIR /app

# Copy all package files for full workspace resolution
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/
COPY packages/client/package*.json ./packages/client/

# Copy prisma files and setup script
COPY prisma ./prisma
COPY scripts ./scripts

# Install ALL dependencies (needed for proper hoisting)
RUN npm ci

# Copy server source and config
COPY packages/server ./packages/server
COPY tsconfig.base.json ./

# Generate Prisma schema for PostgreSQL and generate client
RUN chmod +x scripts/setup-prisma.sh && ./scripts/setup-prisma.sh postgresql

# Build server
RUN npm run build -w @dreamtime/server

# Production stage
FROM node:20-alpine

# Install OpenSSL for Prisma and wget for healthcheck
RUN apk add --no-cache openssl wget

WORKDIR /app

# Copy package.json for ESM support ("type": "module")
COPY --from=builder /app/packages/server/package.json ./package.json

# Copy built files
COPY --from=builder /app/packages/server/dist ./dist

# Copy node_modules from both root (hoisted) and server workspace
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/server/node_modules ./node_modules

# Copy prisma schema and generated client
COPY --from=builder /app/prisma ./prisma

# Set environment
ENV NODE_ENV=production

EXPOSE 3000

# Health check - start-period allows time for migrations to run
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
