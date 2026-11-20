require("dotenv").config();
const path = require("path");
const fs = require("fs");

const { DATABASE_URL, SQLITE_FILE, NODE_ENV } = process.env;
const defaultSqlite = path.resolve(__dirname, "data", "royalpet.db");

function pgConnection(url) {
  // Render's managed Postgres needs SSL; set DATABASE_SSL=false for a local/plain Postgres.
  const useSsl = process.env.DATABASE_SSL !== "false";
  return {
    connectionString: url,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

function sqliteConnection() {
  const filename = SQLITE_FILE || defaultSqlite;
  fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  return { filename };
}

// Only used in production — safe to call lazily
function productionConnection() {
  if (!DATABASE_URL) {
    throw new Error(
      "[knexfile] DATABASE_URL is not set.\n" +
      "Go to Render → your web service → Environment and add the " +
      "Internal Database URL from your Render PostgreSQL service."
    );
  }
  return pgConnection(DATABASE_URL);
}

module.exports = {

  development: {
    client: DATABASE_URL ? "pg" : "sqlite3",
    connection: DATABASE_URL ? pgConnection(DATABASE_URL) : sqliteConnection(),
    ...(DATABASE_URL ? {} : { useNullAsDefault: true }),
    migrations: { directory: "./migrations" },
    seeds:      { directory: "./seeds" },
  },

  // Tests run on in-memory sqlite by default. Set TEST_DATABASE_URL to run the same
  // suite against a real Postgres (what production uses).
  test: process.env.TEST_DATABASE_URL ? {
    client: "pg",
    connection: { connectionString: process.env.TEST_DATABASE_URL },
    migrations: { directory: "./migrations" },
    seeds:      { directory: "./seeds" },
  } : {
    client: "sqlite3",
    connection: { filename: ":memory:" },
    useNullAsDefault: true,
    migrations: { directory: "./migrations" },
    seeds:      { directory: "./seeds" },
  },

  production: {
    client: "pg",
    // Using a getter means the function only runs when knex actually
    // reads the connection property — not when the file is first loaded.
    // This prevents the throw from firing during local development.
    get connection() {
      return productionConnection();
    },
    pool: { min: 2, max: 10 },
    migrations: { directory: "./migrations" },
    seeds:      { directory: "./seeds" },
  },

};