/**
 * Schema hardening so every field the app saves is really stored.
 *  - free-text fields become TEXT (varchar(255) overflow made Postgres reject whole saves)
 *  - columns the UI already writes but the schema never had (source, notes, extra settings)
 *  - tables for supplier payments and planner tasks (were browser-only before)
 */
const addColumnIfMissing = async (knex, table, column, builder) => {
  if (!(await knex.schema.hasColumn(table, column))) {
    await knex.schema.alterTable(table, builder);
  }
};

exports.up = async function (knex) {
  const isPg = knex.client.config.client === "pg";

  if (isPg) {
    await knex.raw('ALTER TABLE "visits" ALTER COLUMN "reason" TYPE text');
    await knex.raw('ALTER TABLE "visits" ALTER COLUMN "diagnosis" TYPE text');
    await knex.raw('ALTER TABLE "owners" ALTER COLUMN "address" TYPE text');
    await knex.raw('ALTER TABLE "pets" ALTER COLUMN "photo" TYPE text');
    await knex.raw('ALTER TABLE "clinic_settings" ALTER COLUMN "address" TYPE text');
    await knex.raw('ALTER TABLE "activity_log" ALTER COLUMN "user" TYPE text');
    await knex.raw('ALTER TABLE "activity_log" ALTER COLUMN "action" TYPE text');
  }

  await addColumnIfMissing(knex, "visits", "source", (t) => t.string("source"));
  await addColumnIfMissing(knex, "appointments", "source", (t) => t.string("source"));
  await addColumnIfMissing(knex, "vaccinations", "notes", (t) => t.text("notes"));
  await addColumnIfMissing(knex, "invoices", "notes", (t) => t.text("notes"));
  await addColumnIfMissing(knex, "clinic_settings", "extra", (t) => t.text("extra"));

  if (!(await knex.schema.hasTable("supplier_payments"))) {
    await knex.schema.createTable("supplier_payments", (t) => {
      t.increments("id").primary();
      t.string("vendor");
      t.text("item");
      t.integer("qty");
      t.float("unitPrice");
      t.float("total");
      t.date("date");
      t.string("status");
      t.text("notes");
      t.timestamp("createdAt").defaultTo(knex.fn.now());
      t.timestamp("updatedAt").defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasTable("planner_tasks"))) {
    await knex.schema.createTable("planner_tasks", (t) => {
      t.increments("id").primary();
      t.string("time");
      t.text("title");
      t.text("notes");
      t.date("date");
      t.boolean("done").defaultTo(false);
      t.timestamp("createdAt").defaultTo(knex.fn.now());
      t.timestamp("updatedAt").defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("planner_tasks");
  await knex.schema.dropTableIfExists("supplier_payments");
  for (const [table, column] of [
    ["clinic_settings", "extra"], ["invoices", "notes"], ["vaccinations", "notes"],
    ["appointments", "source"], ["visits", "source"],
  ]) {
    if (await knex.schema.hasColumn(table, column)) {
      await knex.schema.alterTable(table, (t) => t.dropColumn(column));
    }
  }
};
