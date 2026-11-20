const knex = require("knex");
const config = require("../../knexfile");

// Return Postgres DATE columns as plain "YYYY-MM-DD" strings. The default
// parser builds a JS Date in the server timezone, which shifts the day once
// it is serialised to JSON and breaks the string date comparisons in the UI.
try {
  const pg = require("pg");
  pg.types.setTypeParser(1082, (value) => value);
} catch {
  // pg is optional in sqlite-only setups
}

const env = process.env.NODE_ENV || "development";
const db = knex(config[env]);

module.exports = db;
