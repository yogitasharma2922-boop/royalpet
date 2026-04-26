const express = require("express");
const asyncHandler = require("../utils/asyncHandler");

const { authenticate, requireRole } = require("../middleware/auth");
const { getBootstrap, getDbDump } = require("../controllers/adminController");

const router = express.Router();

router.get("/bootstrap", authenticate, asyncHandler(getBootstrap));
router.get("/db", authenticate, requireRole(["admin"]), asyncHandler(getDbDump));

module.exports = router;
