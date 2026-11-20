const bcrypt = require("bcrypt");
const crypto = require("crypto");

const TABLES_WITH_SEQUENCE = [
  "users", "owners", "pets", "visits", "prescriptions", "appointments", "vaccinations",
  "inventory", "invoices", "activity_log", "clinic_settings", "supplier_payments", "planner_tasks",
];

/**
 * Idempotent: only seeds an empty database, so redeploys never touch live data.
 *
 * Demo accounts (README credentials, same as the login screen buttons) are created
 * when SEED_DEMO_USERS=true, or automatically outside production.
 * In production without SEED_DEMO_USERS only ONE admin is created, from
 * ADMIN_EMAIL / ADMIN_PASSWORD (a random password is generated and printed once
 * if ADMIN_PASSWORD is not set).
 */
exports.seed = async function (knex) {
  const existing = await knex("users").count("id as count").first();
  if (parseInt(existing.count, 10) > 0) {
    console.log("[seed] Data already exists, skipping to protect live data.");
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const demo = process.env.SEED_DEMO_USERS
    ? process.env.SEED_DEMO_USERS === "true"
    : !isProduction;
  const isPostgres = knex.client.config.client === "pg";
  const hash = (pw) => bcrypt.hash(pw, 10);

  await knex("clinic_settings").insert([{
    id: 1,
    name: "Royal Pet Clinic",
    doctor: "Dr. Rajan Mehta",
    phone: "+91 80 1234 5678",
    email: "info@royalpetclinic.in",
    address: "123, MG Road, Bangalore - 560001",
    regNum: "VET/2020/BLR/0042",
    consultFee: 500,
    currency: "₹",
  }]);

  if (demo) {
    await knex("users").insert([
      { id: 1, name: "Dr. Rajan Mehta", email: "doctor@royalpet.in", password: await hash("doctor123"), role: "doctor", mobile: "9876500001", avatar: "DR", active: true },
      { id: 2, name: "Rajesh Kumar", email: "owner@royalpet.in", password: await hash("owner123"), role: "owner", mobile: "9876543210", avatar: "RK", active: true },
      { id: 3, name: "Front Desk", email: "reception@royalpet.in", password: await hash("recep123"), role: "receptionist", mobile: "9876500002", avatar: "FD", active: true },
      { id: 4, name: "Clinic Admin", email: "admin@royalpet.in", password: await hash("admin123"), role: "admin", mobile: "9876500003", avatar: "CA", active: true },
    ]);

    await knex("owners").insert([
      { id: 1, name: "Rajesh Kumar", mobile: "9876543210", email: "owner@royalpet.in", address: "12, MG Road, Bangalore" },
      { id: 2, name: "Priya Sharma", mobile: "9823456789", email: "priya@example.com", address: "45, Koramangala, Bangalore" },
    ]);
    await knex("users").where({ id: 2 }).update({ ownerId: 1 });

    await knex("pets").insert([
      { id: 1, name: "Bruno", type: "Dog", breed: "Labrador Retriever", dob: "2023-01-15", sex: "Male", weight: 28.5, ownerId: 1, photo: "🐕", alerts: JSON.stringify(["Allergic to Amoxicillin"]), color: "#f5ede0" },
      { id: 2, name: "Whiskers", type: "Cat", breed: "Persian", dob: "2021-06-10", sex: "Female", weight: 4.2, ownerId: 2, photo: "🐱", alerts: JSON.stringify([]), color: "#e5e8f5" },
    ]);

    await knex("inventory").insert([
      { id: 1, name: "Amoxicillin 250mg", category: "Antibiotic", stock: 45, unit: "tablets", minStock: 20, batch: "AMX2025B", expiry: "2027-09-15", price: 8, vendor: "Pharma India" },
      { id: 2, name: "Rabies Vaccine", category: "Vaccine", stock: 28, unit: "doses", minStock: 10, batch: "RBV2026A", expiry: "2027-12-01", price: 350, vendor: "BioVet" },
    ]);

    console.log("[seed] Demo accounts: doctor@royalpet.in / doctor123, reception@royalpet.in / recep123, admin@royalpet.in / admin123, owner@royalpet.in / owner123");
    console.log("[seed] These are public demo credentials. Set SEED_DEMO_USERS=false and change passwords before real clinic use.");
  } else {
    const email = (process.env.ADMIN_EMAIL || "admin@royalpet.in").toLowerCase();
    let password = process.env.ADMIN_PASSWORD;
    let generated = false;
    if (!password) {
      password = crypto.randomBytes(9).toString("base64url");
      generated = true;
    }
    await knex("users").insert([
      { id: 1, name: "Clinic Admin", email, password: await hash(password), role: "admin", mobile: "", avatar: "CA", active: true },
    ]);
    console.log(`[seed] Admin account created: ${email}`);
    if (generated) console.log(`[seed] Generated one-time admin password: ${password}  (change it after first login)`);
  }

  if (isPostgres) {
    for (const table of TABLES_WITH_SEQUENCE) {
      await knex.raw(
        `SELECT setval(pg_get_serial_sequence(?, 'id'), COALESCE((SELECT MAX(id) FROM ??), 0) + 1, false)`,
        [table, table]
      );
    }
    console.log("[seed] PostgreSQL sequences reset.");
  }
  console.log("[seed] Initial data seeded.");
};
