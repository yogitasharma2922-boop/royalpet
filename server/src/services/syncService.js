const db = require("../db/knex");
const ApiError = require("../utils/ApiError");
const policy = require("../config/rolePolicy");
const { serializeRow, getColumnTypes } = require("./tableService");

// Parents first. Deletes run in the reverse order, children first.
const TABLE_ORDER = [
  "owners", "pets", "visits", "prescriptions", "appointments", "vaccinations",
  "inventory", "invoices", "supplier_payments", "planner_tasks",
  "clinic_settings", "activity_log",
];

// column -> parent table. Missing parents are nulled so one stale reference
// can never roll back a whole save.
const FOREIGN_KEYS = {
  pets: { ownerId: "owners" },
  visits: { petId: "pets", doctorId: "users" },
  prescriptions: { visitId: "visits" },
  appointments: { petId: "pets", ownerId: "owners" },
  vaccinations: { petId: "pets" },
  invoices: { visitId: "visits", petId: "pets", ownerId: "owners" },
};
const REQUIRED_PARENT = { prescriptions: ["visitId"] };

const SETTINGS_COLUMNS = ["id", "name", "doctor", "phone", "email", "address", "regNum", "consultFee", "currency"];
const MAX_ROWS_PER_TABLE = 20000;

const parseTime = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

const resetSequence = async (trx, table) => {
  if (db.client.config.client !== "pg") return;
  await trx.raw(
    `SELECT setval(pg_get_serial_sequence(?, 'id'), COALESCE((SELECT MAX(id) FROM ??), 0) + 1, false)`,
    [table, table]
  );
};

const prepareRow = async (table, row, role, extraAllowed) => {
  let input = { ...row };
  if (table === "clinic_settings") {
    const extra = {};
    Object.keys(input).forEach((k) => {
      if (!SETTINGS_COLUMNS.includes(k) && !["createdAt", "updatedAt", "extra"].includes(k)) extra[k] = input[k];
    });
    input = Object.fromEntries(SETTINGS_COLUMNS.filter((c) => c in input).map((c) => [c, input[c]]));
    input.id = 1;
    if (role === "admin") input.extra = JSON.stringify(extra);
  }
  if (table === "activity_log" && "time" in input) input.time = parseTime(input.time);

  const allowed = policy.writeColumns(role, table);
  if (allowed) {
    const keep = {};
    allowed.forEach((c) => { if (c in input) keep[c] = input[c]; });
    input = keep;
  }
  delete input.createdAt;
  delete input.updatedAt;
  if (extraAllowed && extraAllowed.length) { /* reserved */ }
  return serializeRow(table, input);
};

const idSet = async (trx, table, ids) => {
  const clean = [...new Set(ids.filter((v) => v !== null && v !== undefined).map(Number).filter(Number.isFinite))];
  if (!clean.length) return new Set();
  const rows = await trx(table).whereIn("id", clean).select("id");
  return new Set(rows.map((r) => Number(r.id)));
};

/**
 * changes = { table: { upsert: [row], remove: [id] } }
 * Only rows that changed are sent, nothing is ever deleted unless its id is
 * listed in `remove`, so a stale browser cannot wipe other users' records.
 */
const applyChanges = async (user, changes) => {
  if (!changes || typeof changes !== "object") throw new ApiError(400, "Invalid sync payload");
  const role = user.role;
  const tables = Object.keys(changes);

  for (const table of tables) {
    if (!TABLE_ORDER.includes(table)) throw new ApiError(400, `Unknown table: ${table}`);
    const c = changes[table] || {};
    const hasUpserts = Array.isArray(c.upsert) && c.upsert.length;
    const hasRemovals = Array.isArray(c.remove) && c.remove.length;
    if (hasUpserts && !policy.canWrite(role, table)) throw new ApiError(403, `Role ${role} cannot modify ${table}`);
    if (hasRemovals && !policy.canRemove(role, table)) throw new ApiError(403, `Role ${role} cannot delete from ${table}`);
    if ((c.upsert || []).length > MAX_ROWS_PER_TABLE) throw new ApiError(413, "Too many rows");
  }

  // Load column metadata BEFORE opening the transaction (a single-connection pool would deadlock otherwise)
  for (const table of tables) await getColumnTypes(table);

  const touched = new Set();
  await db.transaction(async (trx) => {
    for (const table of [...TABLE_ORDER].reverse()) {
      const ids = ((changes[table] || {}).remove || []).map(Number).filter(Number.isFinite);
      if (ids.length) {
        await trx(table).whereIn("id", ids).del();
        touched.add(table);
      }
    }

    for (const table of TABLE_ORDER) {
      const rows = (changes[table] || {}).upsert;
      if (!Array.isArray(rows) || !rows.length) continue;
      const types = await getColumnTypes(table);
      const hasUpdatedAt = "updatedAt" in types;

      const fks = FOREIGN_KEYS[table] || {};
      const parents = {};
      for (const [col, parentTable] of Object.entries(fks)) {
        parents[col] = await idSet(trx, parentTable, rows.map((r) => r && r[col]));
      }

      for (const raw of rows) {
        if (!raw || typeof raw !== "object") continue;
        const row = await prepareRow(table, raw, role);

        let skip = false;
        for (const [col, set] of Object.entries(parents)) {
          if (row[col] === null || row[col] === undefined) continue;
          if (!set.has(Number(row[col]))) {
            if ((REQUIRED_PARENT[table] || []).includes(col)) skip = true;
            else row[col] = null;
          }
        }
        if (skip) continue;

        const id = Number(table === "clinic_settings" ? 1 : raw.id);
        if (!Number.isFinite(id) || id <= 0) {
          if (table !== "activity_log") continue;
          delete row.id;
          if (Object.keys(row).length) await trx(table).insert(row);
          touched.add(table);
          continue;
        }

        delete row.id;
        const exists = await trx(table).where({ id }).first("id");
        if (exists) {
          if (Object.keys(row).length) {
            await trx(table).where({ id }).update(hasUpdatedAt ? { ...row, updatedAt: new Date() } : row);
          }
        } else {
          await trx(table).insert({ ...row, id });
        }
        touched.add(table);
      }
    }

    for (const table of touched) await resetSequence(trx, table);
  });

  return { ok: true, tables: [...touched] };
};

module.exports = { applyChanges, TABLE_ORDER };
