const jwt = require("jsonwebtoken");
const env = require("../config/env");
const db = require("../db/knex");
const ApiError = require("../utils/ApiError");

const authenticate = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return next(new ApiError(401, "Missing authorization"));
  const token = auth.split(" ")[1];
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    return next(new ApiError(401, "Invalid token"));
  }
  try {
    // Role and active flag come from the database, not the token, so a
    // role change or a deactivated account takes effect immediately.
    const user = await db("users").where({ id: payload.id }).first();
    if (!user || user.active === false || user.active === 0) return next(new ApiError(401, "Account disabled or not found"));
    req.user = { id: user.id, role: user.role, email: user.email, name: user.name, ownerId: user.ownerId };
    return next();
  } catch (err) {
    return next(err);
  }
};

const requireRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new ApiError(403, "Forbidden"));
  return next();
};

module.exports = { authenticate, requireRole };
