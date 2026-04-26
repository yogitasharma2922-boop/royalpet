const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, requireRole } = require("../middleware/auth");
const { searchPets } = require("../controllers/petController");

const router = express.Router();

router.get("/search", authenticate, requireRole(["admin", "doctor", "receptionist", "owner"]), asyncHandler(searchPets));

module.exports = router;
