const { parseInventoryCsv, insertInventoryRows } = require("../services/inventoryService");
const { sendSuccess } = require("../utils/apiResponse");

const uploadInventoryCsv = async (req, res) => {
  const csvText = typeof req.body === "string" ? req.body : (req.body && typeof req.body.csv === "string" ? req.body.csv : "");
  const rows = parseInventoryCsv(csvText);
  const inserted = await insertInventoryRows(rows);
  return sendSuccess(res, { inserted }, undefined, 201);
};

module.exports = { uploadInventoryCsv };
