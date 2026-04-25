exports.up = async function(knex) {
  const hasColumn = await knex.schema.hasColumn("visits", "inventoryDeducted");
  if (!hasColumn) {
    await knex.schema.table("visits", (table) => {
      table.boolean("inventoryDeducted").defaultTo(false);
    });
  }
};

exports.down = async function(knex) {
  const hasColumn = await knex.schema.hasColumn("visits", "inventoryDeducted");
  if (hasColumn) {
    await knex.schema.table("visits", (table) => {
      table.dropColumn("inventoryDeducted");
    });
  }
};
