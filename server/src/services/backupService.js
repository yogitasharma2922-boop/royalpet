const db = require("../db/knex");
const logger = require("../config/logger");
const { serializeRow, getColumnTypes } = require("./tableService");

// How many automatic nightly snapshots to keep (each one is a full copy of the data)
const KEEP_SCHEDULED = Number(process.env.BACKUP_KEEP_SCHEDULED) || 14;
const KEEP_PRE_RESTORE = 5;

// All tables to include in every backup snapshot (order matters for restore)
const BACKUP_TABLES = [
  "clinic_settings",
  "users",
  "owners",
  "pets",
  "visits",
  "prescriptions",
  "appointments",
  "vaccinations",
  "inventory",
  "invoices",
  "supplier_payments",
  "planner_tasks",
  "activity_log",
];

// ── Export ─────────────────────────────────────────────────────────────────

const exportSnapshot = async () => {
  const snapshot = {};
  let totalRows = 0;

  for (const table of BACKUP_TABLES) {
    // A failed read must stop the backup: a snapshot with a silently empty table would wipe that table on restore
    const rows = await db(table).select("*");
    snapshot[table] = rows;
    totalRows += rows.length;
  }

  return { snapshot, totalRows };
};

// Keep the backup_logs table from growing forever: scheduled and pre-restore copies are rotated
const pruneBackups = async (trigger) => {
  const keep = trigger === "scheduled" ? KEEP_SCHEDULED : trigger === "pre-restore" ? KEEP_PRE_RESTORE : 0;
  if (!keep) return;
  const old = await db("backup_logs").where("trigger", trigger).orderBy("id", "asc").select("id");
  if (old.length >= keep) {
    const toDelete = old.slice(0, old.length - (keep - 1)).map((r) => r.id);
    await db("backup_logs").whereIn("id", toDelete).delete();
  }
};

// ── Save to backup_logs table ─────────────────────────────────────────────

const saveBackup = async ({ label, trigger = "manual", createdBy = "system" }) => {
  const { snapshot, totalRows } = await exportSnapshot();

  await pruneBackups(trigger);

  const [row] = await db("backup_logs")
    .insert({
      label,
      trigger,
      createdBy,
      rowCount: totalRows,
      snapshot: JSON.stringify(snapshot),
    })
    .returning("id");

  const id = row?.id ?? row;
  logger.info(`[backup] Saved backup #${id} "${label}" (${totalRows} rows, trigger: ${trigger})`);
  return { id, label, totalRows };
};

// ── Restore from a snapshot ───────────────────────────────────────────────

/** Check an uploaded or stored snapshot before anything is deleted. Returns the cleaned snapshot. */
const validateSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error("Invalid backup file: expected an object with one list of rows per table");
  }
  const clean = {};
  let known = 0;
  for (const table of BACKUP_TABLES) {
    const rows = snapshot[table];
    if (rows === undefined) { clean[table] = []; continue; }
    if (!Array.isArray(rows)) throw new Error(`Invalid backup file: "${table}" must be a list of rows`);
    if (rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))) {
      throw new Error(`Invalid backup file: "${table}" contains a row that is not an object`);
    }
    clean[table] = rows;
    known += 1;
  }
  if (!known) throw new Error("Invalid backup file: none of the clinic tables were found");
  const users = clean.users || [];
  if (!users.some((u) => u && u.role === "admin" && u.active !== false && u.active !== 0)) {
    throw new Error("This backup has no active admin user, so nobody could log in after restoring. Restore cancelled.");
  }
  return clean;
};

const restoreSnapshot = async (backupId, { createdBy = "system" } = {}) => {
  const record = await db("backup_logs").where({ id: backupId }).first();
  if (!record) throw new Error(`Backup #${backupId} not found`);

  let parsed;
  try {
    parsed = typeof record.snapshot === "string" ? JSON.parse(record.snapshot) : record.snapshot;
  } catch {
    throw new Error("Backup snapshot is corrupted");
  }
  const snapshot = validateSnapshot(parsed);

  // Safety net: keep a copy of the current data so a wrong restore can itself be undone
  const safety = await saveBackup({
    label: `before-restore-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    trigger: "pre-restore",
    createdBy,
  });

  const isPostgres = db.client.config.client === "pg";

  // Column info must be loaded before the transaction (single-connection sqlite would deadlock otherwise)
  await Promise.all(BACKUP_TABLES.map((t) => getColumnTypes(t)));
  const prepared = {};
  for (const table of BACKUP_TABLES) {
    prepared[table] = [];
    for (const row of snapshot[table]) prepared[table].push(await serializeRow(table, row));
  }

  await db.transaction(async (trx) => {
    // Disable FK checks for the duration of the restore
    if (isPostgres) await trx.raw("SET LOCAL session_replication_role = replica");

    // Clear tables in reverse order (children before parents)
    for (const table of [...BACKUP_TABLES].reverse()) {
      await trx(table).del();
    }

    // Re-insert in dependency order
    for (const table of BACKUP_TABLES) {
      const rows = prepared[table];
      if (!rows.length) continue;
      const cols = Math.max(1, ...rows.slice(0, 50).map((r) => Object.keys(r).length));
      const chunk = Math.max(1, Math.min(100, Math.floor(900 / cols)));
      try {
        for (let i = 0; i < rows.length; i += chunk) {
          await trx(table).insert(rows.slice(i, i + chunk));
        }
      } catch (err) {
        logger.error(`[restore] Failed to restore ${table}: ${err.message}`);
        throw new Error(`Restore failed on table "${table}": ${err.message}. Nothing was changed.`);
      }
    }

    if (isPostgres) {
      for (const table of BACKUP_TABLES) {
        await trx.raw(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`
        ).catch(() => {});
      }
    }
  });

  logger.info(`[restore] Restored backup #${backupId} "${record.label}" (safety copy #${safety.id})`);
  return { restored: record.label, rowCount: record.rowCount, safetyBackupId: safety.id };
};

/** Store an uploaded JSON snapshot as a backup entry (does not restore it). */
const importSnapshot = async (snapshot, { createdBy = "admin", label } = {}) => {
  const clean = validateSnapshot(snapshot);
  const rowCount = BACKUP_TABLES.reduce((n, t) => n + clean[t].length, 0);
  const [row] = await db("backup_logs")
    .insert({
      label: label || `uploaded-${new Date().toISOString().split("T")[0]}`,
      trigger: "upload",
      createdBy,
      rowCount,
      snapshot: JSON.stringify(clean),
    })
    .returning("id");
  return row?.id ?? row;
};

// ── List backups ──────────────────────────────────────────────────────────

const listBackups = async () => {
  return db("backup_logs")
    .select("id", "label", "trigger", "createdBy", "rowCount", "createdAt")
    .orderBy("createdAt", "desc")
    .limit(50);
};

// ── Nightly scheduler (call once at server startup) ───────────────────────

let cronStarted = false;

const startScheduler = () => {
  if (cronStarted) return;
  cronStarted = true;

  // Try to load node-cron — if not installed, log a warning and skip
  let cron;
  try {
    cron = require("node-cron");
  } catch {
    logger.warn("[backup] node-cron not installed — nightly backups disabled. Run: npm install node-cron");
    return;
  }

  // Runs every night at 02:00 AM server time
  cron.schedule("0 2 * * *", async () => {
    const label = `nightly-${new Date().toISOString().split("T")[0]}`;
    try {
      const result = await saveBackup({ label, trigger: "scheduled", createdBy: "system" });
      logger.info(`[backup] Nightly backup complete: ${JSON.stringify(result)}`);
    } catch (err) {
      logger.error(`[backup] Nightly backup FAILED: ${err.message}`);
    }
  });

  logger.info("[backup] Nightly backup scheduler started (runs at 02:00 AM daily)");
};

module.exports = { BACKUP_TABLES, exportSnapshot, saveBackup, restoreSnapshot, importSnapshot, validateSnapshot, listBackups, startScheduler };
