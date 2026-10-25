const config = require("./config");
const { sequelize, Kitten } = require("./db");
const { createApp } = require("./app");
const { createKittenService } = require("./kittenService");

const startServer = async () => {
  const kittenService = createKittenService({
    sequelize,
    Kitten,
    maxKittens: config.maxKittens,
  });
  const app = createApp({ kittenService, config });

  if (!config.writeToken) {
    console.warn("API_WRITE_TOKEN is not set; write endpoints are disabled.");
  }

  await sequelize.authenticate();

  console.log("Database connected.");

  app.listen(config.port, () =>
    console.log(`Simple backend listening at http://localhost:${config.port}`)
  );
};

startServer();
