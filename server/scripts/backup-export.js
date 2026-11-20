// Usage: npm run backup:export -- [file.json]
// Writes all clinic data from the database in DATABASE_URL to a JSON file.
const fs = require("fs");
const path = require("path");
const db = require("../src/db/knex");
const { exportSnapshot } = require("../src/services/backupService");

(async () => {
  const file = path.resolve(process.argv[2] || `royalpet-backup-${new Date().toISOString().split("T")[0]}.json`);
  const { snapshot, totalRows } = await exportSnapshot();
  fs.writeFileSync(file, JSON.stringify({ exportedAt: new Date().toISOString(), totalRows, snapshot }));
  console.log(`Saved ${totalRows} rows to ${file}`);
})()
  .catch((err) => { console.error(`Backup failed: ${err.message}`); process.exitCode = 1; })
  .finally(() => db.destroy());
