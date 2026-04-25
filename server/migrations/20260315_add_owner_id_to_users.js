exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("users", "ownerId");
  if (!hasColumn) {
    await knex.schema.table("users", (table) => {
      table.integer("ownerId").unsigned().references("id").inTable("owners").onDelete("SET NULL");
    });
  }
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("users", "ownerId");
  if (hasColumn) {
    await knex.schema.table("users", (table) => {
      table.dropColumn("ownerId");
    });
  }
};
