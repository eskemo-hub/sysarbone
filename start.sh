#!/bin/sh
set -e

echo "Starting deployment script..."

# Set default DATABASE_URL if not provided
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set."
fi

# Wait for database connection with retry logic
echo "Checking database connection..."
MAX_RETRIES=30
RETRY_COUNT=0

until npx prisma migrate deploy; do
  RETRY_COUNT=$((RETRY_COUNT+1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "Error: Could not connect to database after $MAX_RETRIES attempts."
    exit 1
  fi
  echo "Migration/Connection failed, retrying in 5 seconds... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 5
done

echo "Database migrations applied successfully."

# Check if we should seed
if [ "$SEED_DATABASE" = "true" ]; then
  echo "Running database seed..."
  node prisma/seed.js
else
  echo "Skipping database seed (SEED_DATABASE not set to 'true')."
fi

echo "Starting Next.js server..."
exec node server.js
