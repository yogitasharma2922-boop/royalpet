const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, requireRole } = require("../middleware/auth");
const {
  importPetsOwnersHandler,
  importInventoryHandler,
  importVaccinationsHandler,
  importAppointmentsHandler,
  getTemplate,
} = require("../controllers/csvImportController");

const router = express.Router();
const staffRoles = ["admin", "doctor", "receptionist"];

// Download blank CSV templates
router.get("/template/:type", authenticate, requireRole(staffRoles), asyncHandler(getTemplate));

// Bulk import endpoints
router.post("/pets-owners",   authenticate, requireRole(staffRoles), asyncHandler(importPetsOwnersHandler));
router.post("/inventory",     authenticate, requireRole(staffRoles), asyncHandler(importInventoryHandler));
router.post("/vaccinations",  authenticate, requireRole(staffRoles), asyncHandler(importVaccinationsHandler));
router.post("/appointments",  authenticate, requireRole(staffRoles), asyncHandler(importAppointmentsHandler));

module.exports = router;
