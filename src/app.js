const express = require("express");
const cors = require("cors");

const { HttpError, QuotaExceededError } = require("./errors");
const { requireWriteToken } = require("./middleware/requireWriteToken");
const { createRateLimiter } = require("./middleware/rateLimit");
const {
  validateKittenInput,
  parsePagination,
  parseId,
} = require("./validation");

const JSON_BODY_LIMIT = "10kb";

const toErrorResponse = (err) => {
  if (err instanceof HttpError) {
    return { status: err.status, headers: err.headers, message: err.message };
  }
  if (err instanceof QuotaExceededError) {
    return { status: 409, headers: {}, message: err.message };
  }
  // body-parser errors (malformed JSON, oversized body) carry a 4xx status.
  if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    return { status: err.status, headers: {}, message: err.message };
  }
  return { status: 500, headers: {}, message: err.message };
};

const createApp = ({ kittenService, config, now }) => {
  const app = express();

  const authorizeWrite = [
    createRateLimiter({
      limit: config.writeRateLimit,
      windowMs: config.writeRateWindowMs,
      now,
    }),
    requireWriteToken(config.writeToken),
  ];

  app.use(cors());
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.get("/", async (req, res, next) => {
    try {
      const { limit, offset } = parsePagination(req.query, config);
      const { kittens, total } = await kittenService.list({ limit, offset });
      res.json({ kittens, pagination: { limit, offset, total } });
    } catch (e) {
      next(e);
    }
  });

  app.post("/", authorizeWrite, async (req, res, next) => {
    try {
      const input = validateKittenInput(req.body);
      const kitten = await kittenService.create(input);
      res.status(201).json({ kitten });
    } catch (e) {
      next(e);
    }
  });

  app.delete("/:id", authorizeWrite, async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const deleted = await kittenService.remove(id);
      if (!deleted) {
        throw new HttpError(404, "Kitten not found");
      }
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  app.use((req, res, next) => {
    res.status(404).send("Not found");
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const { status, headers, message } = toErrorResponse(err);
    res.set(headers).status(status).json({ error: message });
  });

  return app;
};

module.exports = { createApp };
