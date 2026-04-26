require("dotenv").config();
const path = require("path");

const { DATABASE_URL, SQLITE_FILE, NODE_ENV } = process.env;
const defaultSqlite = path.resolve(__dirname, "data", "royalpet.db");

function pgConnection(url) {
  return {
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  };
}

function sqliteConnection() {
  return { filename: SQLITE_FILE || defaultSqlite };
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

  test: {
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