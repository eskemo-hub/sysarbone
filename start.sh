#!/bin/sh
set -e

echo "Starting deployment script..."

# Ensure database directory exists
mkdir -p /app/data

# Run migrations (or push schema for SQLite if migrations are tricky in container)
# Since we have migrations folder, we should use migrate deploy
echo "Running database migrations..."
npx prisma migrate deploy

# Check if we should seed
# We can check if the user table is empty, or just run the seed script which uses upsert (idempotent)
echo "Running database seed..."
node prisma/seed.js

echo "Starting Next.js server..."
exec node server.js
