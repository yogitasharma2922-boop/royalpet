const db = require("../db/knex");
const env = require("../config/env");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const health = async (_req, res) => {
  try {
    await db.raw("select 1");
    return sendSuccess(res, { ok: true, env: env.NODE_ENV, db: "up" });
  } catch (err) {
    return sendError(res, 503, "Database unavailable");
  }
};

module.exports = { health };
