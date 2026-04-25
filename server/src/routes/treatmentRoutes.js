const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const { listTreatments, getTreatment, createTreatment } = require("../controllers/treatmentController");

const router = express.Router();

router.get("/", authenticate, requireRole(["admin", "doctor", "receptionist", "owner"]), listTreatments);
router.get("/:id", authenticate, requireRole(["admin", "doctor", "receptionist", "owner"]), getTreatment);
router.post("/", authenticate, requireRole(["admin", "doctor", "receptionist"]), createTreatment);

module.exports = router;
