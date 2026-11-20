const db = require("../db/knex");
const { deserializeRow, deserializeRows } = require("./tableService");

const fetchTreatments = async (filters = {}) => {
  let query = db("visits").select("visits.*");
  if (filters.petId) query = query.where("visits.petId", filters.petId);
  if (filters.visitId) query = query.where("visits.id", filters.visitId);
  if (filters.petIds && Array.isArray(filters.petIds) && filters.petIds.length) {
    query = query.whereIn("visits.petId", filters.petIds);
  }
  const visits = deserializeRows("visits", await query);
  const visitIds = visits.map((v) => v.id);
  const prescriptions = visitIds.length
    ? await db("prescriptions").whereIn("visitId", visitIds)
    : [];
  const rxByVisit = prescriptions.reduce((acc, rx) => {
    acc[rx.visitId] = deserializeRow("prescriptions", rx);
    return acc;
  }, {});
  return visits.map((v) => ({ ...v, prescription: rxByVisit[v.id] || null }));
};

module.exports = { fetchTreatments };
