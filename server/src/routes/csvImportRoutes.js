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
const frontDesk = ["admin", "doctor", "receptionist"];
const clinical = ["admin", "doctor"];
const TEMPLATE_ROLES = { "pets-owners": frontDesk, appointments: frontDesk, inventory: clinical, vaccinations: clinical };
const templateGuard = (req, res, next) => {
  const roles = TEMPLATE_ROLES[req.params.type] || clinical;
  return roles.includes(req.user.role) ? next() : res.status(403).json({ success: false, error: { message: "Forbidden" } });
};

// Download blank CSV templates
router.get("/template/:type", authenticate, requireRole(frontDesk), templateGuard, asyncHandler(getTemplate));

// Bulk import endpoints
router.post("/pets-owners",   authenticate, requireRole(frontDesk), asyncHandler(importPetsOwnersHandler));
router.post("/inventory",     authenticate, requireRole(clinical), asyncHandler(importInventoryHandler));
router.post("/vaccinations",  authenticate, requireRole(clinical), asyncHandler(importVaccinationsHandler));
router.post("/appointments",  authenticate, requireRole(frontDesk), asyncHandler(importAppointmentsHandler));

module.exports = router;
