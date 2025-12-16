/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { randomBytes } = require("crypto");

const connectionString = process.env.DATABASE_URL || "file:./dev.db";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: connectionString,
    },
  },
});

async function main() {
  const organizationId = "seed-org-1";
  const organizationName = "Seed Organization";
  const adminEmail = "admin@example.com";
  const adminPassword = "Admin123!";

  const organization = await prisma.organization.upsert({
    where: { id: organizationId },
    update: {},
    create: {
      id: organizationId,
      name: organizationName,
    },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);

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
    console.error("Seed error", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

