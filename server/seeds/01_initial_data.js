const bcrypt = require("bcrypt");

exports.seed = async function (knex) {

  // ── IDEMPOTENCY GUARD ─────────────────────────────────────────────────────
  // Only seed if the database is empty. This prevents wiping real user data
  // on every Render restart/redeploy.
  const existing = await knex("users").count("id as count").first();
  if (parseInt(existing.count) > 0) {
    console.log("[seed] Data already exists — skipping seed to protect live data.");
    return;
  }
  // ─────────────────────────────────────────────────────────────────────────

  const client = knex.client && knex.client.config && knex.client.config.client;
  const tables = [
    "activity_log",
    "invoices",
    "inventory",
    "vaccinations",
    "appointments",
    "prescriptions",
    "visits",
    "pets",
    "owners",
    "users",
    "clinic_settings",
  ];}

  // ... rest of your seed file stays exactly the same