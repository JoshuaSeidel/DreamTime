# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspace resolution
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/

# Copy prisma schema
COPY prisma ./prisma

# Install dependencies
RUN npm ci --workspace=@dreamtime/server

# Copy server source
COPY packages/server ./packages/server
COPY tsconfig.base.json ./

# Generate Prisma client
RUN npx prisma generate

# Build
RUN npm run build -w @dreamtime/server

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package.json for ESM support and module resolution
COPY --from=builder /app/packages/server/package.json ./package.json

# Copy built files
COPY --from=builder /app/packages/server/dist ./dist

# Copy all node_modules (dependencies are hoisted to root in npm workspaces)
COPY --from=builder /app/node_modules ./node_modules

# Copy prisma files
COPY --from=builder /app/prisma ./prisma

# Set environment
ENV NODE_ENV=production

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
