const db = require("../db/knex");
const ApiError = require("../utils/ApiError");
const { parseInventoryCsv, insertInventoryRows } = require("../services/inventoryService");
const { sendSuccess } = require("../utils/apiResponse");
const { insertWithId } = require("../services/tableService");

const listInventory = async (req, res) => {
  const { category, lowStock } = req.query;
  let query = db("inventory");
  
  if (category) query.where("category", category);
  if (lowStock === "true") query.whereRaw("stock <= minStock");
  
  const results = await query.orderBy("category");
  return sendSuccess(res, results);
};

const getInventory = async (req, res) => {
  const item = await db("inventory").where({ id: req.params.id }).first();
  if (!item) throw new ApiError(404, "Inventory item not found");
  return sendSuccess(res, item);
};

const createInventory = async (req, res) => {
  const { name, category, stock, unit, minStock, batch, expiry, price, vendor } = req.body;
  if (!name || !category) throw new ApiError(400, "Name and category required");
  
  const id = await insertWithId("inventory", {
    name,
    category,
    stock: stock || 0,
    unit: unit || "pcs",
    minStock: minStock || 10,
    batch: batch || "",
    expiry: expiry || null,
    price: price || 0,
    vendor: vendor || "",
  });
  
  const item = await db("inventory").where({ id }).first();
  return sendSuccess(res, item, "Inventory item created", 201);
};

const updateInventory = async (req, res) => {
  const { name, category, stock, unit, minStock, batch, expiry, price, vendor } = req.body;
  const existing = await db("inventory").where({ id: req.params.id }).first();
  if (!existing) throw new ApiError(404, "Inventory item not found");
  
  await db("inventory").where({ id: req.params.id }).update({
    name: name !== undefined ? name : existing.name,
    category: category !== undefined ? category : existing.category,
    stock: stock !== undefined ? stock : existing.stock,
    unit: unit !== undefined ? unit : existing.unit,
    minStock: minStock !== undefined ? minStock : existing.minStock,
    batch: batch !== undefined ? batch : existing.batch,
    expiry: expiry !== undefined ? expiry : existing.expiry,
    price: price !== undefined ? price : existing.price,
    vendor: vendor !== undefined ? vendor : existing.vendor,
    updatedAt: new Date(),
  });
  
  const item = await db("inventory").where({ id: req.params.id }).first();
  return sendSuccess(res, item, "Inventory item updated");
};

const deleteInventory = async (req, res) => {
  const existing = await db("inventory").where({ id: req.params.id }).first();
  if (!existing) throw new ApiError(404, "Inventory item not found");
  
  await db("inventory").where({ id: req.params.id }).delete();
  return sendSuccess(res, { id: req.params.id }, "Inventory item deleted");
};

const uploadInventoryCsv = async (req, res) => {
  const csvText = typeof req.body === "string" ? req.body : (req.body && typeof req.body.csv === "string" ? req.body.csv : "");
  
  // Validate CSV content before parsing
  if (!csvText || !csvText.trim()) throw new ApiError(400, "CSV content is required");
  if (csvText.length > 5 * 1024 * 1024) throw new ApiError(413, "CSV file too large (max 5MB)");
  
  const rows = parseInventoryCsv(csvText);
  const inserted = await insertInventoryRows(rows);
  return sendSuccess(res, { inserted }, undefined, 201);
};

module.exports = { listInventory, getInventory, createInventory, updateInventory, deleteInventory, uploadInventoryCsv };
