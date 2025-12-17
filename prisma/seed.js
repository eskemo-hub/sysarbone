/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const { randomBytes } = require("crypto");

const connectionString = process.env.DATABASE_URL || "file:./dev.db";
console.log("Seed: Using connection string:", connectionString);

// Remove 'file:' prefix if present
const dbPath = connectionString.replace(/^file:/, "");
console.log("Seed: Database path:", dbPath);

const db = new Database(dbPath);
const adapter = new PrismaBetterSqlite3(db);
const prisma = new PrismaClient({ adapter });

async function main() {
  const organizationId = "seed-org-1";
  const organizationName = "Seed Organization";
  const adminEmail = "admin@example.com";
  const adminPassword = "Admin123!";

  console.log("Seed: Upserting organization...");
  const organization = await prisma.organization.upsert({
    where: { id: organizationId },
    update: {},
    create: {
      id: organizationId,
      name: organizationName,
    },
  });

  console.log("Seed: Hashing password...");
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  console.log("Seed: Upserting admin user...");
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: passwordHash,
      role: "ADMIN",
      organizationId: organization.id,
    },
  });

  const apiKeyValue = randomBytes(32).toString("hex");

  console.log("Seed: Creating API key...");
  const apiKey = await prisma.apiKey.create({
    data: {
      key: apiKeyValue,
      organizationId: organization.id,
      isActive: true,
      rateLimitPerMin: 60,
    },
  });

  console.log("Seed completed.");
  console.log("Organization:", organization.name);
  console.log("Admin user email:", adminUser.email);
  console.log("Admin user password:", adminPassword);
  console.log("API key:", apiKey.key);
}

main()
  .catch((error) => {
    console.error("Seed error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
