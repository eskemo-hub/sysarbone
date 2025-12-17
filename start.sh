#!/bin/sh
set -e

echo "Starting deployment script..."

# Set default DATABASE_URL if not provided
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set."
fi

# Run db push to sync schema (using push instead of migrate since we switched DBs and can't generate migrations locally without connection)
echo "Syncing database schema..."
npx prisma db push --accept-data-loss

# Check if we should seed
# We can check if the user table is empty, or just run the seed script which uses upsert (idempotent)
echo "Running database seed..."
node prisma/seed.js

echo "Starting Next.js server..."
exec node server.js
