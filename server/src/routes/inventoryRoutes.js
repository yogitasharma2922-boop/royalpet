const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, requireRole } = require("../middleware/auth");
const { listInventory, getInventory, createInventory, updateInventory, deleteInventory, uploadInventoryCsv } = require("../controllers/inventoryController");

const router = express.Router();

router.get("/", authenticate, requireRole(["admin", "doctor", "receptionist"]), asyncHandler(listInventory));
router.post("/", authenticate, requireRole(["admin", "doctor"]), asyncHandler(createInventory));
router.get("/:id", authenticate, requireRole(["admin", "doctor", "receptionist"]), asyncHandler(getInventory));
router.put("/:id", authenticate, requireRole(["admin", "doctor"]), asyncHandler(updateInventory));
router.delete("/:id", authenticate, requireRole(["admin"]), asyncHandler(deleteInventory));
router.post("/csv-upload", authenticate, requireRole(["admin", "doctor", "receptionist"]), asyncHandler(uploadInventoryCsv));

module.exports = router;
