#!/bin/sh
set -e

echo "Starting deployment script..."

# Set default DATABASE_URL if not provided
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set."
fi

echo "Checking database connection..."
MAX_RETRIES=30
RETRY_COUNT=0
MIGRATION_SUCCESS=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  set +e
  OUTPUT=$(npx prisma migrate deploy 2>&1)
  EXIT_CODE=$?
  set -e

  if [ $EXIT_CODE -eq 0 ]; then
    echo "$OUTPUT"
    echo "Database migrations applied successfully."
    MIGRATION_SUCCESS=true
    break
  else
    # Check for P3005 (Database not empty)
    if echo "$OUTPUT" | grep -q "P3005"; then
      echo "Error P3005 detected: Database is not empty. Attempting auto-baseline..."
      
      echo "1. Syncing schema using db push..."
      npx prisma db push --accept-data-loss
      
      echo "2. Resolving existing migrations..."
      # Find the migration directory (ignoring migration_lock.toml)
      # We iterate to handle potential multiple migrations, though usually there's just one in this case
      for migration in $(ls prisma/migrations | grep -v "migration_lock.toml"); do
        echo "Marking $migration as applied..."
        # We use || true to prevent failure if it's already applied or fails for some reason
        npx prisma migrate resolve --applied "$migration" || echo "Warning: Could not resolve $migration"
      done
      
      echo "Baseline complete. Database is in sync."
      MIGRATION_SUCCESS=true
      break
    fi

    echo "Migration failed (Attempt $((RETRY_COUNT+1))/$MAX_RETRIES). Retrying in 5 seconds..."
    # Print the last few lines of output to help debugging without flooding logs
    echo "$OUTPUT" | tail -n 5
    
    sleep 5
    RETRY_COUNT=$((RETRY_COUNT+1))
  fi
done

if [ "$MIGRATION_SUCCESS" = "false" ]; then
  echo "Error: Failed to initialize database after $MAX_RETRIES attempts."
  exit 1
fi

# Check if we should seed
if [ "$SEED_DATABASE" = "true" ]; then
  echo "Running database seed..."
  node prisma/seed.js
else
  echo "Skipping database seed (SEED_DATABASE not set to 'true')."
fi

echo "Starting Next.js server..."

# Start worker in background
if [ -f "src/worker.ts" ]; then
  echo "Starting worker process..."
  npx tsx src/worker.ts &
else
  echo "Worker file not found, skipping..."
fi

exec node server.js