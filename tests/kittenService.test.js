const { test } = require("node:test");
const assert = require("node:assert/strict");

const { QuotaExceededError } = require("../src/errors");
const {
  createKittenService,
  KITTEN_QUOTA_LOCK_KEY,
} = require("../src/kittenService");

const TX = { id: "tx" };

// Mocks of sequelize + Kitten that log every interaction in order.
const setup = ({ count = 0, destroyed = 1, rows = [] } = {}) => {
  const log = [];
  const sequelize = {
    async transaction(fn) {
      log.push(["transaction"]);
      return fn(TX);
    },
    async query(sql, options) {
      log.push(["query", sql, options]);
    },
  };
  const Kitten = {
    async findAndCountAll(options) {
      log.push(["findAndCountAll", options]);
      return { rows, count: rows.length + 100 };
    },
    async count(options) {
      log.push(["count", options]);
      return count;
    },
    async create(values, options) {
      log.push(["create", values, options]);
      return { id: 7, ...values };
    },
    async destroy(options) {
      log.push(["destroy", options]);
      return destroyed;
    },
  };
  const service = createKittenService({ sequelize, Kitten, maxKittens: 3 });
  return { service, log };
};

test("list pages in stable id order and returns total", async () => {
  const rows = [{ id: 1 }];
  const { service, log } = setup({ rows });
  const result = await service.list({ limit: 10, offset: 20 });
  assert.deepEqual(result, { kittens: rows, total: 101 });
  assert.deepEqual(log, [
    ["findAndCountAll", { order: [["id", "ASC"]], limit: 10, offset: 20 }],
  ]);
});

test("create locks, counts and inserts in one transaction", async () => {
  const { service, log } = setup({ count: 2 });
  const kitten = await service.create({ name: "Tom", age: 3 });
  assert.deepEqual(kitten, { id: 7, name: "Tom", age: 3 });
  assert.deepEqual(log, [
    ["transaction"],
    [
      "query",
      "SELECT pg_advisory_xact_lock(:key)",
      { replacements: { key: KITTEN_QUOTA_LOCK_KEY }, transaction: TX },
    ],
    ["count", { transaction: TX }],
    ["create", { name: "Tom", age: 3 }, { transaction: TX }],
  ]);
});

for (const count of [3, 4]) {
  test(`create rejects when ${count} rows exist (quota 3)`, async () => {
    const { service, log } = setup({ count });
    await assert.rejects(
      service.create({ name: "Tom", age: 3 }),
      (err) => err instanceof QuotaExceededError && err.limit === 3
    );
    assert.ok(!log.some(([op]) => op === "create"));
  });
}

test("remove returns true when a row was deleted", async () => {
  const { service, log } = setup({ destroyed: 1 });
  assert.equal(await service.remove(5), true);
  assert.deepEqual(log, [["destroy", { where: { id: 5 } }]]);
});

test("remove returns false when nothing matched", async () => {
  const { service } = setup({ destroyed: 0 });
  assert.equal(await service.remove(5), false);
});
