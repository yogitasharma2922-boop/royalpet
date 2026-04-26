const env = require("./config/env");
const app = require("./app");
const logger = require("./config/logger");

const server = app.listen(env.PORT, () => {
  logger.info(`Royal Pet server running on http://localhost:${env.PORT}`);
});

// Prevents EADDRINUSE crash loop with nodemon —
// exits cleanly so nodemon waits instead of retrying immediately
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    logger.error(`Port ${env.PORT} is already in use. Kill the existing process and restart.`);
    process.exit(1);
  } else {
    throw err;
  }
});

// Graceful shutdown on Render stop signal (SIGTERM) and local Ctrl+C (SIGINT)
// Allows in-flight requests to complete before the process exits
const shutdown = (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));