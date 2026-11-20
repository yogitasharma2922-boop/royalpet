const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, requireRole } = require("../middleware/auth");
const {
  getBackups,
  createBackup,
  restoreBackup,
  downloadBackup,
  downloadSavedBackup,
  restoreFromUpload,
} = require("../controllers/backupController");

const router = express.Router();

// All backup endpoints are admin-only
router.get(  "/backups",                authenticate, requireRole(["admin"]), asyncHandler(getBackups));
router.post( "/backups",                authenticate, requireRole(["admin"]), asyncHandler(createBackup));
router.get(  "/backups/download",       authenticate, requireRole(["admin"]), asyncHandler(downloadBackup));
router.get(  "/backups/:id/download",  authenticate, requireRole(["admin"]), asyncHandler(downloadSavedBackup));
router.post( "/backups/restore-upload", authenticate, requireRole(["admin"]), asyncHandler(restoreFromUpload));
router.post( "/backups/:id/restore",    authenticate, requireRole(["admin"]), asyncHandler(restoreBackup));

module.exports = router;
