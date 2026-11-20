const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, requireRole } = require("../middleware/auth");
const policy = require("../config/rolePolicy");
const {
  listResources,
  getResource,
  createResource,
  replaceResources,
  updateResource,
  deleteResource,
} = require("../controllers/resourceController");

const router = express.Router();

// Owners may read only the tables that have an owner scope in resourceController.
const OWNER_READABLE = ["owners", "pets", "visits", "prescriptions", "appointments", "vaccinations", "invoices"];

const registerResource = (name, { allowCreate = true } = {}) => {
  const viewRoles = [...policy.rolesThatRead(name)];
  if (OWNER_READABLE.includes(name)) viewRoles.push("owner");
  const writeRoles = policy.rolesThatWrite(name);
  const removeRoles = policy.rolesThatRemove(name);
  // Owners may only create their own appointment requests
  const createRoles = name === "appointments" || name === "visits" ? [...writeRoles, "owner"] : writeRoles;
  const updateRoles = name === "appointments" ? [...writeRoles, "owner"] : writeRoles;
  const deleteRoles = name === "appointments" ? [...removeRoles, "owner"] : removeRoles;

  router.get(`/${name}`, authenticate, requireRole(viewRoles), asyncHandler(listResources(name)));
  router.get(`/${name}/:id`, authenticate, requireRole(viewRoles), asyncHandler(getResource(name)));

  if (allowCreate && createRoles.length) {
    router.post(`/${name}`, authenticate, requireRole(createRoles), asyncHandler(createResource(name)));
  }

  // Whole-table replace is destructive: admin only, and off unless ALLOW_BULK_SYNC=true.
  // The app itself uses PUT /api/sync (delta) instead.
  router.put(`/${name}`, authenticate, requireRole(["admin"]), asyncHandler(replaceResources(name)));
  if (updateRoles.length) router.put(`/${name}/:id`, authenticate, requireRole(updateRoles), asyncHandler(updateResource(name)));
  if (deleteRoles.length) router.delete(`/${name}/:id`, authenticate, requireRole(deleteRoles), asyncHandler(deleteResource(name)));
};

registerResource("owners");
registerResource("pets");
registerResource("visits");
registerResource("appointments");
registerResource("inventory");
registerResource("prescriptions");
registerResource("invoices");
registerResource("vaccinations");
registerResource("supplier_payments");
registerResource("planner_tasks");
registerResource("activity_log", { allowCreate: false });
registerResource("clinic_settings", { allowCreate: false });

module.exports = router;
