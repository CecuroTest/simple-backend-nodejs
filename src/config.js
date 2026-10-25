require("dotenv").config();

const { buildConfig } = require("./buildConfig");

module.exports = buildConfig(process.env);
