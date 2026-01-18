# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspace resolution
COPY package*.json ./
COPY packages/client/package*.json ./packages/client/

# Install dependencies
RUN npm ci --workspace=@dreamtime/client

# Copy client source
COPY packages/client ./packages/client
COPY tsconfig.base.json ./

# Build
RUN npm run build -w @dreamtime/client

# Production stage - Nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html

# Copy nginx config
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
