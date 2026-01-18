# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy all package files for full workspace resolution
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/
COPY packages/client/package*.json ./packages/client/

# Copy prisma schema
COPY prisma ./prisma

# Install ALL dependencies (needed for proper hoisting)
RUN npm ci

# Copy server source and config
COPY packages/server ./packages/server
COPY tsconfig.base.json ./

# Generate Prisma client
RUN npx prisma generate

# Build server
RUN npm run build -w @dreamtime/server

# Production stage
FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

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

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
