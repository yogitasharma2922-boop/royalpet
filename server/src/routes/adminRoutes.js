const express = require("express");
const asyncHandler = require("../utils/asyncHandler");

const { authenticate, requireRole } = require("../middleware/auth");
const { getBootstrap, getDbDump, getActivityLogs, getActivityStatsEndpoint } = require("../controllers/adminController");

const router = express.Router();

router.get("/bootstrap", authenticate, asyncHandler(getBootstrap));
router.get("/db", authenticate, requireRole(["admin"]), asyncHandler(getDbDump));
router.get("/activity-logs", authenticate, requireRole(["admin"]), asyncHandler(getActivityLogs));
router.get("/activity-stats", authenticate, requireRole(["admin"]), asyncHandler(getActivityStatsEndpoint));

module.exports = router;
