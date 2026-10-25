const { test, describe, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const { QuotaExceededError } = require("../src/errors");
const {
  TEST_TOKEN,
  testConfig,
  mockKittenService,
  startApp,
} = require("./helpers");

let app;
const start = async (options) => {
  app = await startApp(options);
  return app;
};
afterEach(async () => {
  if (app) await app.close();
  app = null;
});

const VALID = { name: "Tom", age: 3 };

// Both write routes share the same authorization chain.
const WRITE_ROUTES = [
  { method: "POST", path: "/", body: VALID },
  { method: "DELETE", path: "/1" },
];

describe("GET /", () => {
  test("returns a default page with pagination metadata", async () => {
    const kittens = [{ id: 1, name: "a", age: 1 }];
    const { request, service } = await start({
      service: mockKittenService({ list: async () => ({ kittens, total: 42 }) }),
    });
    const res = await request("GET", "/");
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, {
      kittens,
      pagination: { limit: 20, offset: 0, total: 42 },
    });
    assert.deepEqual(service.calls.list, [{ limit: 20, offset: 0 }]);
  });

  test("passes explicit limit and offset", async () => {
    const { request, service } = await start();
    const res = await request("GET", "/?limit=100&offset=5");
    assert.equal(res.status, 200);
    assert.deepEqual(service.calls.list, [{ limit: 100, offset: 5 }]);
  });

  for (const query of ["limit=101", "limit=0", "limit=x", "offset=-1", "limit=1&limit=2"]) {
    test(`rejects ?${query} without querying the db`, async () => {
      const { request, service } = await start();
      const res = await request("GET", `/?${query}`);
      assert.equal(res.status, 400);
      assert.equal(service.calls.list.length, 0);
    });
  }

  test("is public and not rate limited by write limits", async () => {
    const { request } = await start({ config: testConfig({ writeRateLimit: 1 }) });
    for (let i = 0; i < 3; i++) {
      assert.equal((await request("GET", "/")).status, 200);
    }
  });
});

describe("write authorization", () => {
  for (const route of WRITE_ROUTES) {
    const label = `${route.method} ${route.path}`;

    test(`${label} returns 503 when writes are disabled`, async () => {
      const { request, service } = await start({
        config: testConfig({ writeToken: null }),
      });
      const res = await request(route.method, route.path, {
        body: route.body,
        token: TEST_TOKEN,
      });
      assert.equal(res.status, 503);
      assert.equal(service.calls.create.length + service.calls.remove.length, 0);
    });

    test(`${label} returns 401 without a token`, async () => {
      const { request, service } = await start();
      const res = await request(route.method, route.path, { body: route.body });
      assert.equal(res.status, 401);
      assert.equal(res.headers.get("www-authenticate"), "Bearer");
      assert.equal(service.calls.create.length + service.calls.remove.length, 0);
    });

    test(`${label} returns 401 with a non-bearer scheme`, async () => {
      const { request } = await start();
      const res = await request(route.method, route.path, {
        body: route.body,
        headers: { authorization: `Basic ${TEST_TOKEN}` },
      });
      assert.equal(res.status, 401);
    });

    for (const token of ["wrong-token", "", TEST_TOKEN.slice(0, -1), `${TEST_TOKEN}x`]) {
      test(`${label} returns 401 for token ${JSON.stringify(token)}`, async () => {
        const { request, service } = await start();
        const res = await request(route.method, route.path, {
          body: route.body,
          token,
        });
        assert.equal(res.status, 401);
        assert.equal(service.calls.create.length + service.calls.remove.length, 0);
      });
    }

    test(`${label} is rate limited per client, even with a valid token`, async () => {
      const { request } = await start({
        config: testConfig({ writeRateLimit: 2, writeRateWindowMs: 60000 }),
      });
      const send = () =>
        request(route.method, route.path, { body: route.body, token: TEST_TOKEN });
      assert.ok((await send()).status < 400);
      assert.ok((await send()).status < 400);
      const limited = await send();
      assert.equal(limited.status, 429);
      assert.equal(limited.headers.get("retry-after"), "60");
    });

    test(`${label} counts failed auth attempts toward the rate limit`, async () => {
      const { request } = await start({ config: testConfig({ writeRateLimit: 1 }) });
      assert.equal((await request(route.method, route.path, { token: "bad" })).status, 401);
      const res = await request(route.method, route.path, {
        body: route.body,
        token: TEST_TOKEN,
      });
      assert.equal(res.status, 429);
    });
  }
});

describe("POST /", () => {
  test("creates a kitten with validated input", async () => {
    const { request, service } = await start();
    const res = await request("POST", "/", {
      body: { name: "  Tom  ", age: 3, id: 999 },
      token: TEST_TOKEN,
    });
    assert.equal(res.status, 201);
    assert.deepEqual(res.json, { kitten: { id: 1, name: "Tom", age: 3 } });
    assert.deepEqual(service.calls.create, [{ name: "Tom", age: 3 }]);
  });

  test("rejects invalid input with 400", async () => {
    const { request, service } = await start();
    const res = await request("POST", "/", {
      body: { name: "", age: 3 },
      token: TEST_TOKEN,
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /name/);
    assert.equal(service.calls.create.length, 0);
  });

  test("rejects malformed JSON with 400", async () => {
    const { request } = await start();
    const res = await request("POST", "/", { rawBody: "{nope", token: TEST_TOKEN });
    assert.equal(res.status, 400);
  });

  test("rejects oversized bodies with 413", async () => {
    const { request, service } = await start();
    const res = await request("POST", "/", {
      body: { name: "a", age: 1, pad: "x".repeat(20 * 1024) },
      token: TEST_TOKEN,
    });
    assert.equal(res.status, 413);
    assert.equal(service.calls.create.length, 0);
  });

  test("returns 409 when the storage quota is reached", async () => {
    const { request } = await start({
      service: mockKittenService({
        create: async () => {
          throw new QuotaExceededError(10);
        },
      }),
    });
    const res = await request("POST", "/", { body: VALID, token: TEST_TOKEN });
    assert.equal(res.status, 409);
    assert.match(res.json.error, /quota of 10/);
  });

  test("returns 500 on unexpected service errors", async () => {
    const { request } = await start({
      service: mockKittenService({
        create: async () => {
          throw new Error("db down");
        },
      }),
    });
    const res = await request("POST", "/", { body: VALID, token: TEST_TOKEN });
    assert.equal(res.status, 500);
  });
});

describe("DELETE /:id", () => {
  test("deletes an existing kitten", async () => {
    const { request, service } = await start();
    const res = await request("DELETE", "/12", { token: TEST_TOKEN });
    assert.equal(res.status, 204);
    assert.deepEqual(service.calls.remove, [12]);
  });

  test("returns 404 when the kitten does not exist", async () => {
    const { request } = await start({
      service: mockKittenService({ remove: async () => false }),
    });
    const res = await request("DELETE", "/12", { token: TEST_TOKEN });
    assert.equal(res.status, 404);
  });

  for (const id of ["0", "abc", "1.5"]) {
    test(`rejects id ${id} with 400`, async () => {
      const { request, service } = await start();
      const res = await request("DELETE", `/${id}`, { token: TEST_TOKEN });
      assert.equal(res.status, 400);
      assert.equal(service.calls.remove.length, 0);
    });
  }
});

test("unknown routes return 404", async () => {
  const { request } = await start();
  assert.equal((await request("GET", "/nope/deeper")).status, 404);
});
