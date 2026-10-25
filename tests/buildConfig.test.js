const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  buildConfig,
  DEFAULTS,
  MIN_WRITE_TOKEN_LENGTH,
} = require("../src/buildConfig");

test("uses safe defaults when env is empty", () => {
  const config = buildConfig({});
  assert.equal(config.writeToken, null);
  assert.equal(config.maxKittens, DEFAULTS.maxKittens);
  assert.equal(config.writeRateLimit, DEFAULTS.writeRateLimit);
  assert.equal(config.writeRateWindowMs, DEFAULTS.writeRateWindowMs);
  assert.equal(config.defaultPageSize, DEFAULTS.defaultPageSize);
  assert.equal(config.maxPageSize, DEFAULTS.maxPageSize);
});

test("keeps db settings from env", () => {
  const config = buildConfig({
    DB_NAME: "n",
    DB_USERNAME: "u",
    DB_PASSWORD: "p",
    DB_HOST: "h",
  });
  assert.deepEqual(config.db, {
    name: "n",
    username: "u",
    password: "p",
    host: "h",
  });
});

test("treats blank write token as disabled", () => {
  assert.equal(buildConfig({ API_WRITE_TOKEN: "" }).writeToken, null);
  assert.equal(buildConfig({ API_WRITE_TOKEN: "   " }).writeToken, null);
});

test("trims the write token (e.g. trailing newline from secret file)", () => {
  const token = "a".repeat(MIN_WRITE_TOKEN_LENGTH);
  assert.equal(buildConfig({ API_WRITE_TOKEN: `${token}\n` }).writeToken, token);
});

test("rejects a too-short write token", () => {
  assert.throws(
    () => buildConfig({ API_WRITE_TOKEN: "a".repeat(MIN_WRITE_TOKEN_LENGTH - 1) }),
    /at least/
  );
});

test("parses numeric overrides", () => {
  const config = buildConfig({
    MAX_KITTENS: "5",
    WRITE_RATE_LIMIT: "2",
    WRITE_RATE_WINDOW_MS: "1000",
    DEFAULT_PAGE_SIZE: "3",
    MAX_PAGE_SIZE: "4",
  });
  assert.equal(config.maxKittens, 5);
  assert.equal(config.writeRateLimit, 2);
  assert.equal(config.writeRateWindowMs, 1000);
  assert.equal(config.defaultPageSize, 3);
  assert.equal(config.maxPageSize, 4);
});

for (const bad of ["0", "-1", "1.5", "abc", "1e3", "99999999999999999999"]) {
  test(`rejects invalid MAX_KITTENS=${bad}`, () => {
    assert.throws(() => buildConfig({ MAX_KITTENS: bad }), /positive integer/);
  });
}

test("rejects default page size above max page size", () => {
  assert.throws(
    () => buildConfig({ DEFAULT_PAGE_SIZE: "50", MAX_PAGE_SIZE: "10" }),
    /must not exceed/
  );
});
