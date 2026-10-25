// An error that maps directly to an HTTP response.
class HttpError extends Error {
  constructor(status, message, headers) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.headers = headers || {};
  }
}

class QuotaExceededError extends Error {
  constructor(limit) {
    super(`Storage quota of ${limit} kittens reached`);
    this.name = "QuotaExceededError";
    this.limit = limit;
  }
}

module.exports = { HttpError, QuotaExceededError };
