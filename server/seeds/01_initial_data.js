const bcrypt = require("bcrypt");

exports.seed = async function (knex) {

  // ── IDEMPOTENCY GUARD ────────────────────────────────────────────────────
  // Only seed if the database is completely empty.
  // This prevents wiping real clinic data on every restart/redeploy.
  const existing = await knex("users").count("id as count").first();
  if (parseInt(existing.count) > 0) {
    console.log("[seed] Data already exists — skipping to protect live data.");
    return;
  }
  // ────────────────────────────────────────────────────────────────────────

  const isPostgres = knex.client.config.client === "pg";

  // ── 1. CLINIC SETTINGS ───────────────────────────────────────────────────
  await knex("clinic_settings").insert([
    {
      id: 1,
      name: "Royal Pet Clinic",
      doctor: "Dr. Admin",
      phone: "+91-9000000000",
      email: "admin@royalpet.com",
      address: "123 Vet Street, Mumbai, India",
      regNum: "VET-2024-001",
      consultFee: 500,
      currency: "INR",
    },
  ]);

  // ── 2. USERS ─────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash("Admin@123", 10);
  const doctorHash = await bcrypt.hash("Doctor@123", 10);
  const staffHash = await bcrypt.hash("Staff@123", 10);

  await knex("users").insert([
    {
      id: 1,
      name: "Super Admin",
      email: "admin@royalpet.com",
      password: adminHash,
      role: "admin",
      mobile: "+91-9000000001",
      active: true,
    },
    {
      id: 2,
      name: "Dr. Priya Sharma",
      email: "doctor@royalpet.com",
      password: doctorHash,
      role: "doctor",
      mobile: "+91-9000000002",
      active: true,
    },
    {
      id: 3,
      name: "Rahul Staff",
      email: "staff@royalpet.com",
      password: staffHash,
      role: "staff",
      mobile: "+91-9000000003",
      active: true,
    },
  ]);

  // ── 3. RESET SEQUENCES (PostgreSQL only) ─────────────────────────────────
  // After inserting rows with explicit IDs, the sequence counter must be
  // moved past the highest ID so future inserts don't collide.
  if (isPostgres) {
    const tables = [
      "users",
      "owners",
      "pets",
      "visits",
      "prescriptions",
      "appointments",
      "vaccinations",
      "inventory",
      "invoices",
      "activity_log",
      "clinic_settings",
    ];

    for (const table of tables) {
      await knex.raw(`
        SELECT setval(
          pg_get_serial_sequence('${table}', 'id'),
          COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1,
          false
        )
      `);
    }

    console.log("[seed] PostgreSQL sequences reset successfully.");
  }

  console.log("[seed] Initial data seeded successfully.");
  console.log("[seed] Admin login:  admin@royalpet.com  /  Admin@123");
  console.log("[seed] Doctor login: doctor@royalpet.com /  Doctor@123");
  console.log("[seed] Staff login:  staff@royalpet.com  /  Staff@123");
};