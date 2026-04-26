const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, requireRole } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { userCreateSchema, userUpdateSchema } = require("../schemas/userSchemas");
const { listUsers, createUser, updateUser, deleteUser } = require("../controllers/userController");

const router = express.Router();

router.get("/", authenticate, requireRole(["admin"]), asyncHandler(listUsers));
router.post("/", authenticate, requireRole(["admin"]), validate(userCreateSchema), asyncHandler(createUser));
router.put("/:id", authenticate, requireRole(["admin"]), validate(userUpdateSchema), asyncHandler(updateUser));
router.delete("/:id", authenticate, requireRole(["admin"]), asyncHandler(deleteUser));

module.exports = router;
