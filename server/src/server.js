const env = require("./config/env");
const app = require("./app");
const logger = require("./config/logger");

app.listen(env.PORT, () => {
  logger.info(`Royal Pet server running on http://localhost:${env.PORT}`);
});
