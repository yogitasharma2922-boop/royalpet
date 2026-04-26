exports.up = async function (knex) {
  const exists = await knex.schema.hasTable("backup_logs");
  if (!exists) {
    await knex.schema.createTable("backup_logs", (table) => {
      table.increments("id").primary();
      table.string("label").notNullable();          // "nightly-2026-04-26" or "manual"
      table.string("trigger").defaultTo("manual");  // "manual" | "scheduled"
      table.string("createdBy");                    // user email who triggered it
      table.integer("rowCount");                    // total rows backed up
      table.text("snapshot");                       // full JSON snapshot of all tables
      table.timestamp("createdAt").defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("backup_logs");
};
