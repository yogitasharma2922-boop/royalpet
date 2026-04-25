const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { userCreateSchema, userUpdateSchema } = require("../schemas/userSchemas");
const { listUsers, createUser, updateUser, deleteUser } = require("../controllers/userController");

const router = express.Router();

router.get("/", authenticate, requireRole(["admin"]), listUsers);
router.post("/", authenticate, requireRole(["admin"]), validate(userCreateSchema), createUser);
router.put("/:id", authenticate, requireRole(["admin"]), validate(userUpdateSchema), updateUser);
router.delete("/:id", authenticate, requireRole(["admin"]), deleteUser);

module.exports = router;
