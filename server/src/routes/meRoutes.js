const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate } = require("../middleware/auth");
const { getMe } = require("../controllers/meController");

const router = express.Router();

router.get("/", authenticate, asyncHandler(getMe));

module.exports = router;
