// Usage: npm run backup:restore -- file.json --yes
// Replaces ALL data in the database in DATABASE_URL with the contents of the file.
// Run `npm run migrate` first when the database is new.
const fs = require("fs");
const path = require("path");
const db = require("../src/db/knex");
const { importSnapshot, restoreSnapshot } = require("../src/services/backupService");

(async () => {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) throw new Error("Give the backup file: npm run backup:restore -- file.json --yes");
  if (!args.includes("--yes")) throw new Error("This replaces all data in the database. Add --yes to confirm.");
  const parsed = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  const id = await importSnapshot(parsed.snapshot || parsed, { createdBy: "cli" });
  const result = await restoreSnapshot(id, { createdBy: "cli" });
  console.log(`Restored "${result.restored}" (${result.rowCount} rows). Previous data was saved as backup #${result.safetyBackupId}.`);
})()
  .catch((err) => { console.error(`Restore failed: ${err.message}`); process.exitCode = 1; })
  .finally(() => db.destroy());
