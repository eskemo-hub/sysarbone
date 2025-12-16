const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
try {
  const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
  console.log("Success");
} catch (e) {
  console.log("Error:", e.message);
}
