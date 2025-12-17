#!/bin/sh
set -e

echo "Starting deployment script..."

# Set default DATABASE_URL if not provided
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set."
fi

# Run migrations (or push schema for SQLite if migrations are tricky in container)
# Since we have migrations folder, we should use migrate deploy
echo "Running database migrations..."
prisma migrate deploy

# Check if we should seed
# We can check if the user table is empty, or just run the seed script which uses upsert (idempotent)
echo "Running database seed..."
node prisma/seed.js

echo "Starting Next.js server..."
exec node server.js
