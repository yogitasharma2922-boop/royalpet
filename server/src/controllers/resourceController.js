const db = require("../db/knex");
const ApiError = require("../utils/ApiError");
const { sendSuccess } = require("../utils/apiResponse");
const { loadOwnerContext } = require("../services/ownerContextService");
const policy = require("../config/rolePolicy");
const env = require("../config/env");
const { sanitizePayload, insertWithId, buildListQuery, paginate, getTableColumns, serializeRow, deserializeRow, deserializeRows } = require("../services/tableService");

const OWNER_SCOPES = {
  owners: (query, ctx) => query.where("owners.id", ctx.ownerId),
  pets: (query, ctx) => query.where("pets.ownerId", ctx.ownerId),
  appointments: (query, ctx) => query.where("appointments.ownerId", ctx.ownerId),
  visits: (query, ctx) => query.whereIn("visits.petId", ctx.petIds),
  prescriptions: (query, ctx) => query.whereIn("prescriptions.visitId", db("visits").select("id").whereIn("petId", ctx.petIds)),
  vaccinations: (query, ctx) => query.whereIn("vaccinations.petId", ctx.petIds),
  invoices: (query, ctx) => query.whereIn("invoices.petId", ctx.petIds),
};

const REQUIRED_FIELDS = {
  owners: ["name"],
  pets: ["name"],
  visits: ["petId", "date", "status"],
  appointments: ["petId", "ownerId", "date", "time"],
  inventory: ["name", "category"],
  prescriptions: ["visitId", "medicines"],
  invoices: ["visitId", "petId", "ownerId", "date", "items", "total"],
  vaccinations: ["petId", "vaccine", "given"],
};

const requireFields = (payload, fields) => {
  const missing = [];
  for (const field of fields) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === "") missing.push(field);
  }
  return missing;
};

// Owners are scoped by record (OWNER_SCOPES), so they get full rows of their own data.
const columnsFor = (req, table) => (req.user.role === "owner" ? null : policy.readColumns(req.user.role, table));

const visibleColumns = (req, table, cols) => {
  const allowed = columnsFor(req, table);
  return allowed ? cols.filter((c) => allowed.includes(c)) : cols;
};

const shapeRow = (req, table, row) => policy.pick(deserializeRow(table, row), columnsFor(req, table));

// Staff only write the columns their role owns (front desk cannot touch clinical visit fields).
const restrictToWritable = (req, table, payload) => {
  if (req.user.role === "owner") return payload;
  const allowed = policy.writeColumns(req.user.role, table);
  return allowed ? policy.pick(payload, allowed) : payload;
};

const applyOwnerPayloadScope = async (table, req, payload) => {
  if (req.user.role !== "owner") return payload;
  const ctx = await loadOwnerContext(req);
  if (!ctx || !ctx.ownerId) throw new ApiError(403, "Owner context not found");

  if (table === "appointments") {
    const scopedPayload = { ...payload, ownerId: ctx.ownerId };
    if (!ctx.petIds.includes(Number(scopedPayload.petId))) throw new ApiError(403, "Forbidden pet");
    return scopedPayload;
  }

  if (table === "visits") {
    // Owner walk-in request: only for their own pet, always starts as "waiting"
    if (!ctx.petIds.includes(Number(payload.petId))) throw new ApiError(403, "Forbidden pet");
    return {
      petId: Number(payload.petId),
      reason: String(payload.reason || "").slice(0, 500),
      date: new Date().toISOString().split("T")[0],
      status: "waiting",
      emergency: false,
      source: "owner-portal",
    };
  }

  throw new ApiError(403, "Forbidden");
};

// Next case number for today: RPC-YYYYMMDD-NNN
const nextCaseNum = async () => {
  const day = new Date().toISOString().split("T")[0];
  const prefix = `RPC-${day.replace(/-/g, "")}-`;
  const rows = await db("visits").where("caseNum", "like", `${prefix}%`).select("caseNum");
  const max = rows.reduce((m, r) => Math.max(m, parseInt(String(r.caseNum).slice(prefix.length), 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
};

const listResources = (table) => async (req, res) => {
  const cols = visibleColumns(req, table, await getTableColumns(table));
  let query = buildListQuery(table, cols, req.query);
  if (req.user.role === "owner" && OWNER_SCOPES[table]) {
    const ctx = await loadOwnerContext(req);
    if (!ctx || (!ctx.ownerId && !ctx.petIds.length)) return sendSuccess(res, [], { page: 1, limit: 20, total: 0, totalPages: 1 });
    query = OWNER_SCOPES[table](query, ctx);
  }

  const { data, meta } = await paginate(query, req.query.page, req.query.limit);
  return sendSuccess(res, data.map((r) => shapeRow(req, table, r)), meta);
};

const getResource = (table) => async (req, res) => {
  let query = db(table).where({ id: req.params.id });
  if (req.user.role === "owner" && OWNER_SCOPES[table]) {
    const ctx = await loadOwnerContext(req);
    if (!ctx || (!ctx.ownerId && !ctx.petIds.length)) throw new ApiError(404, "Not found");
    query = OWNER_SCOPES[table](query, ctx);
  }
  const row = await query.first();
  if (!row) throw new ApiError(404, "Not found");
  return sendSuccess(res, shapeRow(req, table, row));
};

const createResource = (table) => async (req, res) => {
  let payload = await sanitizePayload(table, req.body);
  if (!payload || typeof payload !== "object") throw new ApiError(400, "Invalid payload");
  payload = restrictToWritable(req, table, payload);
  payload = await applyOwnerPayloadScope(table, req, payload);
  const required = REQUIRED_FIELDS[table] || [];
  if (required.length) {
    const missing = requireFields(payload, required);
    if (missing.length) throw new ApiError(400, "Missing fields", missing);
  }
  if (table === "visits" && req.user.role === "owner") payload.caseNum = await nextCaseNum();
  const insertedId = await insertWithId(table, await serializeRow(table, payload));
  return sendSuccess(res, { id: insertedId, ...(payload.caseNum ? { caseNum: payload.caseNum } : {}) }, undefined, 201);
};

const replaceResources = (table) => async (req, res) => {
  if (!env.ALLOW_BULK_SYNC) throw new ApiError(403, "Bulk sync disabled");
  const rows = req.body;
  if (!Array.isArray(rows)) throw new ApiError(400, "Expected array");
  const cleaned = [];
  for (const row of rows) cleaned.push(await serializeRow(table, row));
  await db.transaction(async (trx) => {
    await trx(table).del();
    if (cleaned.length) await trx(table).insert(cleaned);
  });
  return sendSuccess(res, { ok: true });
};

const updateResource = (table) => async (req, res) => {
  let changes = await sanitizePayload(table, req.body);
  if (!changes || typeof changes !== "object") throw new ApiError(400, "Invalid payload");
  changes = restrictToWritable(req, table, changes);
  if (!Object.keys(changes).length) throw new ApiError(400, "Empty update payload");
  changes = await applyOwnerPayloadScope(table, req, changes);
  changes = await serializeRow(table, changes);
  const cols = await getTableColumns(table);
  const updatePayload = cols.includes("updatedAt") ? { ...changes, updatedAt: new Date() } : changes;
  let query = db(table).where({ id: req.params.id });
  if (req.user.role === "owner" && OWNER_SCOPES[table]) {
    const ctx = await loadOwnerContext(req);
    if (!ctx || (!ctx.ownerId && !ctx.petIds.length)) throw new ApiError(404, "Not found");
    query = OWNER_SCOPES[table](query, ctx);
  }
  const count = await query.update(updatePayload);
  if (!count) throw new ApiError(404, "Not found");
  let updatedQuery = db(table).where({ id: req.params.id });
  if (req.user.role === "owner" && OWNER_SCOPES[table]) {
    const ctx = await loadOwnerContext(req);
    updatedQuery = OWNER_SCOPES[table](updatedQuery, ctx);
  }
  const updated = await updatedQuery.first();
  return sendSuccess(res, shapeRow(req, table, updated));
};

const deleteResource = (table) => async (req, res) => {
  let query = db(table).where({ id: req.params.id });
  if (req.user.role === "owner" && OWNER_SCOPES[table]) {
    const ctx = await loadOwnerContext(req);
    if (!ctx || (!ctx.ownerId && !ctx.petIds.length)) throw new ApiError(404, "Not found");
    query = OWNER_SCOPES[table](query, ctx);
  }
  const count = await query.del();
  if (!count) throw new ApiError(404, "Not found");
  return sendSuccess(res, { ok: true });
};

module.exports = {
  listResources,
  getResource,
  createResource,
  replaceResources,
  updateResource,
  deleteResource,
};
