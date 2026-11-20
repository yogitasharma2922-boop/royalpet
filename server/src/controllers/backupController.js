const db = require("../db/knex");
const ApiError = require("../utils/ApiError");
const { sendSuccess } = require("../utils/apiResponse");
const {
  saveBackup,
  restoreSnapshot,
  importSnapshot,
  listBackups,
  exportSnapshot,
} = require("../services/backupService");

const who = (req) => req.user?.email || req.user?.name || "admin";
const today = () => new Date().toISOString().split("T")[0];

// GET /api/admin/backups - list all saved backups
const getBackups = async (req, res) => {
  const backups = await listBackups();
  return sendSuccess(res, backups);
};

// POST /api/admin/backups - trigger a manual backup
const createBackup = async (req, res) => {
  const label = String(req.body?.label || `manual-${today()}`).slice(0, 120);
  const result = await saveBackup({ label, trigger: "manual", createdBy: who(req) });
  return sendSuccess(res, result, "Backup created", 201);
};

// POST /api/admin/backups/:id/restore - restore from a saved backup
const restoreBackup = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) throw new ApiError(400, "Invalid backup ID");
  try {
    const result = await restoreSnapshot(id, { createdBy: who(req) });
    return sendSuccess(res, result, "Database restored successfully");
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(/not found/i.test(err.message) ? 404 : 400, err.message);
  }
};

// GET /api/admin/backups/download - download the current data as a JSON file
const downloadBackup = async (req, res) => {
  const { snapshot, totalRows } = await exportSnapshot();
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="royalpet-backup-${today()}.json"`);
  res.send(JSON.stringify({ exportedAt: new Date().toISOString(), totalRows, snapshot }));
};

// GET /api/admin/backups/:id/download - download one saved backup as a JSON file
const downloadSavedBackup = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) throw new ApiError(400, "Invalid backup ID");
  const record = await db("backup_logs").where({ id }).first();
  if (!record) throw new ApiError(404, `Backup #${id} not found`);
  const snapshot = typeof record.snapshot === "string" ? JSON.parse(record.snapshot) : record.snapshot;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="royalpet-backup-${id}-${today()}.json"`);
  res.send(JSON.stringify({ exportedAt: record.createdAt, totalRows: record.rowCount, snapshot }));
};

// POST /api/admin/backups/restore-upload - restore from an uploaded JSON file ({ snapshot } or the downloaded file itself)
const restoreFromUpload = async (req, res) => {
  const snapshot = req.body?.snapshot;
  if (!snapshot || typeof snapshot !== "object") {
    throw new ApiError(400, "Invalid backup file: expected { snapshot: {...} }");
  }
  try {
    const id = await importSnapshot(snapshot, { createdBy: who(req) });
    const result = await restoreSnapshot(id, { createdBy: who(req) });
    return sendSuccess(res, result, "Database restored from uploaded file");
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(400, err.message);
  }
};

module.exports = { getBackups, createBackup, restoreBackup, downloadBackup, downloadSavedBackup, restoreFromUpload };
