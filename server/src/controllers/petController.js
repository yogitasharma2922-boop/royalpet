const db = require("../db/knex");
const { sendSuccess } = require("../utils/apiResponse");
const { loadOwnerContext } = require("../services/ownerContextService");

const searchPets = async (req, res) => {
  const q = String(req.query.q || "").trim();
  const petId = String(req.query.petId || "").trim();
  const name = String(req.query.name || "").trim();
  const owner = String(req.query.owner || "").trim();
  const phone = String(req.query.phone || "").trim();

  const query = db("pets")
    .leftJoin("owners", "pets.ownerId", "owners.id")
    .select("pets.*", "owners.name as ownerName", "owners.mobile as ownerMobile", "owners.email as ownerEmail");

  if (req.user.role === "owner") {
    const ctx = await loadOwnerContext(req);
    if (!ctx || !ctx.ownerId) return sendSuccess(res, []);
    query.where("pets.ownerId", ctx.ownerId);
  }

  if (petId) query.where("pets.id", petId);
  if (name) query.where("pets.name", "like", `%${name}%`);
  if (owner) query.where("owners.name", "like", `%${owner}%`);
  if (phone) query.where("owners.mobile", "like", `%${phone}%`);
  if (q) {
    query.where((builder) => {
      builder
        .where("pets.id", q)
        .orWhere("pets.name", "like", `%${q}%`)
        .orWhere("owners.name", "like", `%${q}%`)
        .orWhere("owners.mobile", "like", `%${q}%`);
    });
  }

  const results = await query;
  return sendSuccess(res, results);
};

module.exports = { searchPets };
