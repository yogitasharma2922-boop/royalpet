const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, requireRole } = require("../middleware/auth");
const { listPets, getPet, createPet, updatePet, deletePet, searchPets } = require("../controllers/petController");

const router = express.Router();

router.get("/", authenticate, requireRole(["admin", "doctor", "receptionist", "owner"]), asyncHandler(listPets));
router.post("/", authenticate, requireRole(["admin", "receptionist", "owner"]), asyncHandler(createPet));
router.get("/search", authenticate, requireRole(["admin", "doctor", "receptionist", "owner"]), asyncHandler(searchPets));
router.get("/:id", authenticate, requireRole(["admin", "doctor", "receptionist", "owner"]), asyncHandler(getPet));
router.put("/:id", authenticate, requireRole(["admin", "receptionist", "owner"]), asyncHandler(updatePet));
router.delete("/:id", authenticate, requireRole(["admin"]), asyncHandler(deletePet));

module.exports = router;
