const db = require("../db/knex");
const ApiError = require("../utils/ApiError");
const policy = require("../config/rolePolicy");
const { loadOwnerContext } = require("../services/ownerContextService");
const { deserializeRows, deserializeRow } = require("../services/tableService");
const { sendSuccess } = require("../utils/apiResponse");
const { getActivityLog, getActivityStats } = require("../services/activityService");

const FULL_USER_COLUMNS = ["id", "name", "email", "role", "mobile", "active", "avatar", "lastLogin", "ownerId"];
const NAME_ONLY_USER_COLUMNS = ["id", "name", "role", "avatar"];

const readTable = async (role, table) => {
  if (!policy.canRead(role, table)) return [];
  const rows = deserializeRows(table, await db(table).select());
  return policy.pickRows(rows, policy.readColumns(role, table));
};

const readSettings = async (role) => {
  if (!policy.canRead(role, "clinic_settings")) return null;
  const row = await db("clinic_settings").select().first();
  return row ? policy.pick(deserializeRow("clinic_settings", row), policy.readColumns(role, "clinic_settings")) : null;
};

const buildScopedDump = async (user) => {
  if (user.role === "owner") {
    const ctx = await loadOwnerContext({ user });
    const petIds = ctx?.petIds || [];
    const ownerId = ctx?.ownerId;
    const visitIdsQuery = db("visits").select("id").whereIn("petId", petIds.length ? petIds : [0]);

    const [users, owners, pets, visits, prescriptions, appointments, vaccinations, invoices, settings] = await Promise.all([
      db("users").select(FULL_USER_COLUMNS).where({ id: user.id }),
      ownerId ? db("owners").select().where({ id: ownerId }) : [],
      petIds.length ? db("pets").select().whereIn("id", petIds) : [],
      petIds.length ? db("visits").select().whereIn("petId", petIds) : [],
      petIds.length ? db("prescriptions").select().whereIn("visitId", visitIdsQuery) : [],
      ownerId ? db("appointments").select().where({ ownerId }) : [],
      petIds.length ? db("vaccinations").select().whereIn("petId", petIds) : [],
      petIds.length ? db("invoices").select().whereIn("petId", petIds) : [],
      db("clinic_settings").select().first(),
    ]);

    return {
      users,
      owners,
      pets: deserializeRows("pets", pets),
      visits: deserializeRows("visits", visits),
      prescriptions: deserializeRows("prescriptions", prescriptions),
      appointments,
      vaccinations,
      inventory: [],
      invoices: deserializeRows("invoices", invoices),
      activityLog: [],
      supplierPayments: [],
      tasks: [],
      clinicSettings: settings ? policy.pick(deserializeRow("clinic_settings", settings), policy.readColumns("receptionist", "clinic_settings")) : null,
    };
  }

  if (!policy.STAFF_ROLES.includes(user.role)) throw new ApiError(403, "Forbidden");

  const users = await db("users").select(user.role === "admin" ? FULL_USER_COLUMNS : NAME_ONLY_USER_COLUMNS);
  const [owners, pets, visits, prescriptions, appointments, vaccinations, inventory, invoices, activityLog, supplierPayments, tasks, clinicSettings] = await Promise.all([
    readTable(user.role, "owners"),
    readTable(user.role, "pets"),
    readTable(user.role, "visits"),
    readTable(user.role, "prescriptions"),
    readTable(user.role, "appointments"),
    readTable(user.role, "vaccinations"),
    readTable(user.role, "inventory"),
    readTable(user.role, "invoices"),
    readTable(user.role, "activity_log"),
    readTable(user.role, "supplier_payments"),
    readTable(user.role, "planner_tasks"),
    readSettings(user.role),
  ]);

  return { users, owners, pets, visits, prescriptions, appointments, vaccinations, inventory, invoices, activityLog, supplierPayments, tasks, clinicSettings };
};

const getBootstrap = async (req, res) => {
  const data = await buildScopedDump(req.user);
  return sendSuccess(res, data);
};

const getDbDump = async (req, res) => {
  const data = await buildScopedDump(req.user);
  return sendSuccess(res, data);
};

const getActivityLogs = async (req, res) => {
  if (req.user.role !== "admin") throw new ApiError(403, "Only admins can view activity logs");

  const { action, type, days, limit } = req.query;
  const startDate = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

  const filters = {};
  if (action) filters.action = action;
  if (type) filters.type = type;
  if (startDate) filters.startDate = startDate;
  if (limit) filters.limit = parseInt(limit);

  const logs = await getActivityLog(filters);
  const statsData = await getActivityStats(parseInt(days) || 7);

  return sendSuccess(res, { logs, stats: statsData });
};

const getActivityStatsEndpoint = async (req, res) => {
  if (req.user.role !== "admin") throw new ApiError(403, "Only admins can view activity stats");

  const { days } = req.query;
  const stats = await getActivityStats(parseInt(days) || 7);

  return sendSuccess(res, stats);
};

module.exports = { getBootstrap, getDbDump, getActivityLogs, getActivityStatsEndpoint };
