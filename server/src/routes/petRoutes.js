const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const { searchPets } = require("../controllers/petController");

const router = express.Router();

router.get("/search", authenticate, requireRole(["admin", "doctor", "receptionist", "owner"]), searchPets);

module.exports = router;
