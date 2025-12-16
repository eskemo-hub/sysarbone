FROM node:20-bookworm-slim AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies for building native modules
RUN apt-get update && apt-get install -y python3 make g++ openjdk-17-jdk \
    && rm -rf /var/lib/apt/lists/*
    
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

COPY package.json package-lock.json ./
# Install dependencies
RUN npm install

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js
# Set database URL for build time (needed if any static generation touches DB, though usually skipped)
ENV DATABASE_URL="file:/app/data/dev.db" 
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED=1

# Install runtime dependencies for Aspose and Fonts
# Aspose often requires fonts and graphics libraries
RUN apt-get update && apt-get install -y \
    libfontconfig1 \
    libfreetype6 \
    fonts-liberation \
    fonts-dejavu \
    ca-certificates \
    openjdk-17-jre-headless \
    && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV LD_LIBRARY_PATH=$JAVA_HOME/lib/server:$LD_LIBRARY_PATH

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy Prisma schema and migrations if needed for runtime tasks
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# Copy public directory
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy startup script
COPY --chown=nextjs:nodejs start.sh ./start.sh
RUN chmod +x ./start.sh

# Create licenses directory
RUN mkdir -p /app/licenses && chown nextjs:nodejs /app/licenses

# Copy lib directory (JARs)
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib

# Create data directory for SQLite
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# Ensure uploads directory exists
RUN mkdir -p /app/public/uploads && chown nextjs:nodejs /app/public/uploads

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Set database URL to use the volume mounted data directory
ENV DATABASE_URL="file:/app/data/dev.db"

CMD ["./start.sh"]
