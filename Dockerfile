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

# Install Java for the build process (needed because next build might evaluate modules that import java)
RUN apt-get update && apt-get install -y openjdk-17-jdk \
    && rm -rf /var/lib/apt/lists/*
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV LD_LIBRARY_PATH=$JAVA_HOME/lib/server

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
# Set database URL for build time
ENV DATABASE_URL="file:/app/data/db.sqlite" 
RUN npx prisma generate

# Build Next.js 
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
ENV LD_LIBRARY_PATH=$JAVA_HOME/lib/server

# Set HOME to a writable directory to avoid permission errors
ENV HOME=/app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install Prisma globally so it's available for migrations
RUN npm install -g prisma

# Install Prisma and tsx locally to ensure prisma.config.ts can be loaded and executed
RUN npm install prisma@7.1.0 tsx @prisma/adapter-better-sqlite3 @prisma/client bcryptjs better-sqlite3

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy Prisma schema and migrations if needed for runtime tasks
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Generate Prisma Client in the runner stage to ensure it matches the environment and schema
ENV DATABASE_URL="file:/app/data/db.sqlite"
RUN npx prisma generate

# Copy public directory
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy startup script
COPY --chown=nextjs:nodejs start.sh ./start.sh
RUN chmod +x ./start.sh

# Copy Prisma config
COPY --chown=nextjs:nodejs prisma.config.ts ./prisma.config.ts

# Create licenses directory
RUN mkdir -p /app/licenses && chown nextjs:nodejs /app/licenses

# Copy lib directory (JARs)
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib

# Ensure uploads directory exists
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./start.sh"]
