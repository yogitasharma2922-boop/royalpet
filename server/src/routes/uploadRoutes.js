const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, requireRole } = require("../middleware/auth");
const { upload, uploadSingle } = require("../controllers/uploadController");

const router = express.Router();

router.post("/", authenticate, requireRole(["admin", "doctor", "receptionist", "owner"]), upload.single("file"), asyncHandler(uploadSingle));

module.exports = router;
