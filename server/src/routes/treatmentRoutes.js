const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, requireRole } = require("../middleware/auth");
const { listTreatments, getTreatment, createTreatment } = require("../controllers/treatmentController");

const router = express.Router();

router.get("/", authenticate, requireRole(["admin", "doctor", "receptionist", "owner"]), asyncHandler(listTreatments));
router.get("/:id", authenticate, requireRole(["admin", "doctor", "receptionist", "owner"]), asyncHandler(getTreatment));
router.post("/", authenticate, requireRole(["admin", "doctor", "receptionist"]), asyncHandler(createTreatment));

module.exports = router;
