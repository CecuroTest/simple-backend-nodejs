const crypto = require("crypto");
const { HttpError } = require("../errors");

const BEARER_PREFIX = "Bearer ";

// Hash both sides so timingSafeEqual always compares equal-length buffers.
const tokensMatch = (provided, expected) => {
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
};

const requireWriteToken = (writeToken) => (req, res, next) => {
  if (!writeToken) {
    return next(new HttpError(503, "Writes are disabled on this server"));
  }

  const header = req.get("authorization");
  if (typeof header !== "string" || !header.startsWith(BEARER_PREFIX)) {
    return next(
      new HttpError(401, "Missing bearer token", {
        "WWW-Authenticate": "Bearer",
      })
    );
  }

  const provided = header.slice(BEARER_PREFIX.length).trim();
  if (!tokensMatch(provided, writeToken)) {
    return next(
      new HttpError(401, "Invalid bearer token", {
        "WWW-Authenticate": 'Bearer error="invalid_token"',
      })
    );
  }

  return next();
};

module.exports = { requireWriteToken };
