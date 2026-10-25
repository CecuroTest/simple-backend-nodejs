const { test } = require("node:test");
const assert = require("node:assert/strict");

const { HttpError } = require("../src/errors");
const { createRateLimiter } = require("../src/middleware/rateLimit");

const fakeClock = (start = 0) => {
  let time = start;
  const now = () => time;
  now.advance = (ms) => {
    time += ms;
  };
  return now;
};

// Runs the middleware once and returns what it passed to next().
const hit = (limiter, ip = "1.1.1.1") => {
  let result = "not-called";
  limiter({ ip }, {}, (err) => {
    result = err;
  });
  return result;
};

test("allows up to the limit then rejects with 429 and Retry-After", () => {
  const now = fakeClock();
  const limiter = createRateLimiter({ limit: 2, windowMs: 10000, now });

  assert.equal(hit(limiter), undefined);
  assert.equal(hit(limiter), undefined);

  now.advance(2500);
  const err = hit(limiter);
  assert.ok(err instanceof HttpError);
  assert.equal(err.status, 429);
  assert.equal(err.headers["Retry-After"], "8");
});

test("tracks clients independently", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: fakeClock() });
  assert.equal(hit(limiter, "a"), undefined);
  assert.equal(hit(limiter, "b"), undefined);
  assert.equal(hit(limiter, "a").status, 429);
});

test("resets after the window", () => {
  const now = fakeClock();
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now });
  assert.equal(hit(limiter), undefined);
  assert.equal(hit(limiter).status, 429);
  now.advance(1000);
  assert.equal(hit(limiter), undefined);
});

test("sweeps expired entries so memory stays bounded", () => {
  const now = fakeClock();
  const limiter = createRateLimiter({ limit: 5, windowMs: 1000, now });
  for (let i = 0; i < 100; i++) hit(limiter, `ip-${i}`);
  assert.equal(limiter.size(), 100);

  now.advance(1000);
  hit(limiter, "fresh");
  assert.equal(limiter.size(), 1);
});

test("does not sweep active entries", () => {
  const now = fakeClock();
  const limiter = createRateLimiter({ limit: 5, windowMs: 1000, now });
  hit(limiter, "old");
  now.advance(600);
  hit(limiter, "young");
  now.advance(500);
  hit(limiter, "trigger");
  // "old" expired; "young" still active.
  assert.equal(limiter.size(), 2);
});
