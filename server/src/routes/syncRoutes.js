const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, requireRole } = require("../middleware/auth");
const { sendSuccess } = require("../utils/apiResponse");
const { applyChanges } = require("../services/syncService");

const router = express.Router();

// Delta sync used by the staff UI: { changes: { table: { upsert: [...], remove: [ids] } } }
router.put(
  "/",
  authenticate,
  requireRole(["admin", "doctor", "receptionist"]),
  asyncHandler(async (req, res) => {
    const result = await applyChanges(req.user, req.body && req.body.changes);
    return sendSuccess(res, result);
  })
);

module.exports = router;
