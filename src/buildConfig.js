const MIN_WRITE_TOKEN_LENGTH = 16;

const DEFAULTS = {
  maxKittens: 10000,
  writeRateLimit: 30,
  writeRateWindowMs: 60 * 1000,
  defaultPageSize: 20,
  maxPageSize: 100,
};

const readPositiveInt = (env, name, fallback) => {
  const raw = env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${name} must be a positive integer, got "${raw}"`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer, got "${raw}"`);
  }
  return value;
};

// Writes stay disabled when no token is configured (fail closed).
const readWriteToken = (env) => {
  const token = (env.API_WRITE_TOKEN || "").trim();
  if (token === "") {
    return null;
  }
  if (token.length < MIN_WRITE_TOKEN_LENGTH) {
    throw new Error(
      `API_WRITE_TOKEN must be at least ${MIN_WRITE_TOKEN_LENGTH} characters`
    );
  }
  return token;
};

const buildConfig = (env) => {
  const defaultPageSize = readPositiveInt(
    env,
    "DEFAULT_PAGE_SIZE",
    DEFAULTS.defaultPageSize
  );
  const maxPageSize = readPositiveInt(
    env,
    "MAX_PAGE_SIZE",
    DEFAULTS.maxPageSize
  );
  if (defaultPageSize > maxPageSize) {
    throw new Error("DEFAULT_PAGE_SIZE must not exceed MAX_PAGE_SIZE");
  }

  return {
    port: 3000,
    db: {
      name: env.DB_NAME,
      username: env.DB_USERNAME,
      password: env.DB_PASSWORD,
      host: env.DB_HOST,
    },
    writeToken: readWriteToken(env),
    maxKittens: readPositiveInt(env, "MAX_KITTENS", DEFAULTS.maxKittens),
    writeRateLimit: readPositiveInt(
      env,
      "WRITE_RATE_LIMIT",
      DEFAULTS.writeRateLimit
    ),
    writeRateWindowMs: readPositiveInt(
      env,
      "WRITE_RATE_WINDOW_MS",
      DEFAULTS.writeRateWindowMs
    ),
    defaultPageSize,
    maxPageSize,
  };
};

module.exports = { buildConfig, DEFAULTS, MIN_WRITE_TOKEN_LENGTH };
