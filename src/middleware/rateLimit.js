const { HttpError } = require("../errors");

// Fixed-window, in-memory rate limiter keyed by client IP.
// Suitable for a single API instance; use a shared store if scaled out.
const createRateLimiter = ({ limit, windowMs, now = Date.now }) => {
  const hits = new Map();
  let lastSweep = now();

  // Drop expired windows at most once per window so memory stays bounded.
  const sweep = (time) => {
    if (time - lastSweep < windowMs) {
      return;
    }
    hits.forEach((entry, key) => {
      if (entry.resetAt <= time) {
        hits.delete(key);
      }
    });
    lastSweep = time;
  };

  const middleware = (req, res, next) => {
    const time = now();
    sweep(time);

    const key = req.ip;
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= time) {
      entry = { count: 0, resetAt: time + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > limit) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - time) / 1000);
      return next(
        new HttpError(429, "Too many requests", {
          "Retry-After": String(retryAfterSeconds),
        })
      );
    }

    return next();
  };

  middleware.size = () => hits.size;

  return middleware;
};

module.exports = { createRateLimiter };
