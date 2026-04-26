require("dotenv").config();
const path = require("path");

const { DATABASE_URL, SQLITE_FILE, NODE_ENV } = process.env;
const defaultSqlite = path.resolve(__dirname, "data", "royalpet.db");

// ── helpers ──────────────────────────────────────────────────────────────────

function pgConnection(url) {
  // Wrapping as an object (not a raw string) is required so we can attach SSL.
  // Render Postgres mandates TLS but uses a self-signed cert — rejectUnauthorized
  // must be false or every connection attempt throws an SSL handshake error.
  return {
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  };
}

function sqliteConnection() {
  return { filename: SQLITE_FILE || defaultSqlite };
}

// ── environments ─────────────────────────────────────────────────────────────

module.exports = {

  development: {
    client: DATABASE_URL ? "pg" : "sqlite3",
    connection: DATABASE_URL ? pgConnection(DATABASE_URL) : sqliteConnection(),
    // useNullAsDefault is a SQLite-only workaround; only include it for sqlite3
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
    // Hard-fail at startup if DATABASE_URL is missing.
    // This surfaces the misconfiguration immediately instead of silently
    // falling back to an ephemeral SQLite file that gets wiped on every redeploy.
    client: "pg",
    connection: (() => {
      if (!DATABASE_URL) {
        throw new Error(
          "[knexfile] DATABASE_URL is not set.\n" +
          "Go to Render → your web service → Environment and add the " +
          "Internal Database URL from your Render PostgreSQL service."
        );
      }
      return pgConnection(DATABASE_URL);
    })(),
    pool: { min: 2, max: 10 },
    migrations: { directory: "./migrations" },
    seeds:      { directory: "./seeds" },
  },

};