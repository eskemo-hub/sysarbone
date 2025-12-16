const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

async function main() {
  console.log("Initializing adapter with object...");
  const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
  console.log("Initializing client...");
  const prisma = new PrismaClient({ adapter });
  try {
    console.log("Connecting...");
    await prisma.$connect();
    console.log("Connected");
  } catch (e) {
    console.error("Connect failed:", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
