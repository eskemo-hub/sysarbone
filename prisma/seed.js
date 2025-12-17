/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { randomBytes } = require("crypto");

const prisma = new PrismaClient();

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
      id: "seed-admin-user-1",
      email: adminEmail,
      password: passwordHash,
      role: "ADMIN",
      organizationId: organization.id,
    },
  });

  // Check if API key exists before creating to make it idempotent
  const existingApiKey = await prisma.apiKey.findFirst({
    where: { organizationId: organization.id }
  });

  let apiKey;
  if (existingApiKey) {
    console.log("Seed: API key already exists.");
    apiKey = existingApiKey;
  } else {
    const apiKeyValue = randomBytes(32).toString("hex");
    console.log("Seed: Creating API key...");
    apiKey = await prisma.apiKey.create({
      data: {
        key: apiKeyValue,
        organizationId: organization.id,
        isActive: true,
        rateLimitPerMin: 60,
      },
    });
  }

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
