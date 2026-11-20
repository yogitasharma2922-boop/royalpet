const { createLogger, format, transports } = require("winston");
const env = require("./env");

const logger = createLogger({
  level: env.LOG_LEVEL,
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  silent: env.NODE_ENV === "test" && process.env.LOG_IN_TESTS !== "true",
  transports: [new transports.Console()],
});

module.exports = logger;
