const { parse } = require("csv-parse/sync");
const db = require("../db/knex");
const ApiError = require("../utils/ApiError");

const parseInventoryCsv = (csvText) => {
  if (!csvText || !csvText.trim()) throw new ApiError(400, "CSV content is required");
  let records;
  try {
    records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
  } catch {
    throw new ApiError(400, "Invalid CSV format");
  }

  const normalizeKey = (key) => String(key || "").trim().toLowerCase().replace(/\s+/g, "");
  const mapRow = (row) => {
    const normalized = {};
    Object.keys(row || {}).forEach((k) => {
      normalized[normalizeKey(k)] = row[k];
    });
    return {
      name: normalized.name || normalized.medicine || normalized.medicinename,
      category: normalized.category,
      stock: Number(normalized.stock || 0),
      unit: normalized.unit,
      minStock: Number(normalized.minstock || normalized.minimumstock || 0),
      batch: normalized.batch,
      expiry: normalized.expiry || normalized.expirydate,
      price: Number(normalized.price || 0),
      vendor: normalized.vendor,
    };
  };

  const rows = records.map(mapRow).filter((r) => r.name);
  if (!rows.length) throw new ApiError(400, "No valid rows found");
  return rows;
};

const insertInventoryRows = async (rows) => {
  const existing = await db("inventory").select("id", "name", "batch");
  const existingKeys = new Set(existing.map((i) => `${i.name}__${i.batch || ""}`.toLowerCase()));

  const insertRows = rows.filter((r) => !existingKeys.has(`${r.name}__${r.batch || ""}`.toLowerCase()));
  if (!insertRows.length) throw new ApiError(409, "All rows already exist");

  await db("inventory").insert(insertRows);
  return insertRows.length;
};

module.exports = { parseInventoryCsv, insertInventoryRows };
