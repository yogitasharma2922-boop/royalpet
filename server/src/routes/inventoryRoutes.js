const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const { uploadInventoryCsv } = require("../controllers/inventoryController");

const router = express.Router();

router.post("/csv-upload", authenticate, requireRole(["admin", "doctor", "receptionist"]), uploadInventoryCsv);

module.exports = router;
