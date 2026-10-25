const { HttpError } = require("./errors");

const NAME_MAX_LENGTH = 100;
const AGE_MIN = 0;
const AGE_MAX = 50;

const badRequest = (message) => new HttpError(400, message);

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const validateKittenInput = (body) => {
  if (!isPlainObject(body)) {
    throw badRequest("Request body must be a JSON object");
  }

  const { name, age } = body;

  if (typeof name !== "string") {
    throw badRequest("name must be a string");
  }
  const trimmedName = name.trim();
  if (trimmedName.length === 0 || trimmedName.length > NAME_MAX_LENGTH) {
    throw badRequest(`name must be 1-${NAME_MAX_LENGTH} characters`);
  }

  if (!Number.isInteger(age) || age < AGE_MIN || age > AGE_MAX) {
    throw badRequest(`age must be an integer between ${AGE_MIN} and ${AGE_MAX}`);
  }

  return { name: trimmedName, age };
};

// Parses an optional non-negative integer from a query/path string.
const parseNonNegativeInt = (raw, field) => {
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
    throw badRequest(`${field} must be a non-negative integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw badRequest(`${field} is too large`);
  }
  return value;
};

const parsePagination = (query, { defaultPageSize, maxPageSize }) => {
  const limit =
    query.limit === undefined
      ? defaultPageSize
      : parseNonNegativeInt(query.limit, "limit");
  const offset =
    query.offset === undefined ? 0 : parseNonNegativeInt(query.offset, "offset");

  if (limit < 1 || limit > maxPageSize) {
    throw badRequest(`limit must be between 1 and ${maxPageSize}`);
  }

  return { limit, offset };
};

const parseId = (raw) => {
  const id = parseNonNegativeInt(raw, "id");
  if (id < 1) {
    throw badRequest("id must be a positive integer");
  }
  return id;
};

module.exports = {
  validateKittenInput,
  parsePagination,
  parseId,
  NAME_MAX_LENGTH,
  AGE_MIN,
  AGE_MAX,
};
