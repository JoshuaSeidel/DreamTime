#!/bin/bash
# Script to generate Prisma schema for the target database provider
# Usage: ./scripts/setup-prisma.sh [sqlite|postgresql]
# Default: postgresql (for production/Docker)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PRISMA_DIR="$PROJECT_ROOT/prisma"

# Determine provider from argument or DATABASE_URL
PROVIDER="${1:-}"

if [ -z "$PROVIDER" ]; then
  # Try to detect from DATABASE_URL
  if [ -n "$DATABASE_URL" ]; then
    if [[ "$DATABASE_URL" == file:* ]]; then
      PROVIDER="sqlite"
    elif [[ "$DATABASE_URL" == postgresql://* ]] || [[ "$DATABASE_URL" == postgres://* ]]; then
      PROVIDER="postgresql"
    fi
  fi
fi

# Default to postgresql if still not set
PROVIDER="${PROVIDER:-postgresql}"

echo "Setting up Prisma for provider: $PROVIDER"

# Generate schema.prisma from base
sed "s/__DB_PROVIDER__/$PROVIDER/g" "$PRISMA_DIR/schema.base.prisma" > "$PRISMA_DIR/schema.prisma"

echo "Generated prisma/schema.prisma with provider: $PROVIDER"

# Generate Prisma client
npx prisma generate

echo "Prisma client generated successfully"
