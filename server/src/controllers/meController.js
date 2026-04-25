const db = require("../db/knex");
const ApiError = require("../utils/ApiError");
const { sendSuccess } = require("../utils/apiResponse");

const getMe = async (req, res) => {
  const user = await db("users").where({ id: req.user.id }).first();
  if (!user) throw new ApiError(404, "User not found");
  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mobile: user.mobile,
    avatar: user.avatar,
    ownerId: user.ownerId,
  };
  return sendSuccess(res, safeUser);
};

module.exports = { getMe };
