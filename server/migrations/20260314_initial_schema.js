/**
 * Initial schema for Royal Pet Clinic
 * Run with: npx knex migrate:latest --knexfile knexfile.js
 */

exports.up = async function(knex) {
  await knex.schema
    .createTable("users", (table) => {
      table.increments("id").primary();
      table.string("name").notNullable();
      table.string("email").notNullable().unique();
      table.string("password").notNullable();
      table.string("role").notNullable();
      table.string("mobile");
      table.string("avatar");
      table.boolean("active").defaultTo(true);
      table.timestamp("lastLogin").defaultTo(knex.fn.now());
      table.timestamp("createdAt").defaultTo(knex.fn.now());
      table.timestamp("updatedAt").defaultTo(knex.fn.now());
    })
    .createTable("owners", (table) => {
      table.increments("id").primary();
      table.string("name").notNullable();
      table.string("mobile");
      table.string("email");
      table.string("address");
      table.timestamp("createdAt").defaultTo(knex.fn.now());
      table.timestamp("updatedAt").defaultTo(knex.fn.now());
    })
    .createTable("pets", (table) => {
      table.increments("id").primary();
      table.string("name").notNullable();
      table.string("type");
      table.string("breed");
      table.date("dob");
      table.string("sex");
      table.float("weight");
      table.integer("ownerId").unsigned().references("id").inTable("owners").onDelete("SET NULL");
      table.string("photo");
      table.json("alerts");
      table.string("color");
      table.timestamp("createdAt").defaultTo(knex.fn.now());
      table.timestamp("updatedAt").defaultTo(knex.fn.now());
    })
    .createTable("visits", (table) => {
      table.increments("id").primary();
      table.integer("petId").unsigned().references("id").inTable("pets").onDelete("SET NULL");
      table.string("caseNum");
      table.date("date");
      table.string("status");
      table.string("reason");
      table.string("temp");
      table.string("hr");
      table.string("rr");
      table.float("weight");
      table.string("diagnosis");
      table.text("notes");
      table.integer("doctorId").unsigned().references("id").inTable("users").onDelete("SET NULL");
      table.boolean("emergency").defaultTo(false);
      table.timestamp("createdAt").defaultTo(knex.fn.now());
      table.timestamp("updatedAt").defaultTo(knex.fn.now());
    })
    .createTable("prescriptions", (table) => {
      table.increments("id").primary();
      table.integer("visitId").unsigned().references("id").inTable("visits").onDelete("CASCADE");
      table.json("medicines");
      table.timestamp("createdAt").defaultTo(knex.fn.now());
      table.timestamp("updatedAt").defaultTo(knex.fn.now());
    })
    .createTable("appointments", (table) => {
      table.increments("id").primary();
      table.integer("petId").unsigned().references("id").inTable("pets").onDelete("SET NULL");
      table.integer("ownerId").unsigned().references("id").inTable("owners").onDelete("SET NULL");
      table.date("date");
      table.string("time");
      table.string("type");
      table.string("status");
      table.text("notes");
      table.timestamp("createdAt").defaultTo(knex.fn.now());
      table.timestamp("updatedAt").defaultTo(knex.fn.now());
    })
    .createTable("vaccinations", (table) => {
      table.increments("id").primary();
      table.integer("petId").unsigned().references("id").inTable("pets").onDelete("SET NULL");
      table.string("vaccine");
      table.date("given");
      table.date("next");
      table.string("batch");
      table.string("status");
      table.timestamp("createdAt").defaultTo(knex.fn.now());
      table.timestamp("updatedAt").defaultTo(knex.fn.now());
    })
    .createTable("inventory", (table) => {
      table.increments("id").primary();
      table.string("name");
      table.string("category");
      table.integer("stock");
      table.string("unit");
      table.integer("minStock");
      table.string("batch");
      table.date("expiry");
      table.float("price");
      table.string("vendor");
      table.timestamp("createdAt").defaultTo(knex.fn.now());
      table.timestamp("updatedAt").defaultTo(knex.fn.now());
    })
    .createTable("invoices", (table) => {
      table.increments("id").primary();
      table.integer("visitId").unsigned().references("id").inTable("visits").onDelete("SET NULL");
      table.integer("petId").unsigned().references("id").inTable("pets").onDelete("SET NULL");
      table.integer("ownerId").unsigned().references("id").inTable("owners").onDelete("SET NULL");
      table.date("date");
      table.json("items");
      table.float("total");
      table.string("status");
      table.string("method");
      table.timestamp("createdAt").defaultTo(knex.fn.now());
      table.timestamp("updatedAt").defaultTo(knex.fn.now());
    })
    .createTable("activity_log", (table) => {
      table.increments("id").primary();
      table.timestamp("time").defaultTo(knex.fn.now());
      table.string("user");
      table.string("action");
      table.text("details");
      table.string("type");
    })
    .createTable("clinic_settings", (table) => {
      table.increments("id").primary();
      table.string("name");
      table.string("doctor");
      table.string("phone");
      table.string("email");
      table.string("address");
      table.string("regNum");
      table.float("consultFee");
      table.string("currency");
      table.timestamp("createdAt").defaultTo(knex.fn.now());
      table.timestamp("updatedAt").defaultTo(knex.fn.now());
    });
};

exports.down = async function(knex) {
  await knex.schema
    .dropTableIfExists("clinic_settings")
    .dropTableIfExists("activity_log")
    .dropTableIfExists("invoices")
    .dropTableIfExists("inventory")
    .dropTableIfExists("vaccinations")
    .dropTableIfExists("appointments")
    .dropTableIfExists("prescriptions")
    .dropTableIfExists("visits")
    .dropTableIfExists("pets")
    .dropTableIfExists("owners")
    .dropTableIfExists("users");
};
