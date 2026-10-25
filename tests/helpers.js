const { createApp } = require("../src/app");
const { buildConfig } = require("../src/buildConfig");

const TEST_TOKEN = "test-write-token-0123456789";

const testConfig = (overrides = {}) => ({
  ...buildConfig({ API_WRITE_TOKEN: TEST_TOKEN }),
  ...overrides,
});

// Mock service that records calls; each method can be overridden.
const mockKittenService = (overrides = {}) => {
  const calls = { list: [], create: [], remove: [] };
  const service = {
    calls,
    async list(args) {
      calls.list.push(args);
      return { kittens: [], total: 0 };
    },
    async create(input) {
      calls.create.push(input);
      return { id: 1, ...input };
    },
    async remove(id) {
      calls.remove.push(id);
      return true;
    },
  };
  Object.keys(overrides).forEach((key) => {
    const impl = overrides[key];
    service[key] = async (...args) => {
      calls[key].push(...args);
      return impl(...args);
    };
  });
  return service;
};

// Starts the app on a random port; returns a fetch helper and close().
const startApp = async ({ service, config, now } = {}) => {
  const kittenService = service || mockKittenService();
  const app = createApp({
    kittenService,
    config: config || testConfig(),
    now,
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const request = async (method, path, { body, token, rawBody, headers } = {}) => {
    const allHeaders = { ...headers };
    if (body !== undefined || rawBody !== undefined) {
      allHeaders["content-type"] = "application/json";
    }
    if (token !== undefined) {
      allHeaders.authorization = `Bearer ${token}`;
    }
    const res = await fetch(baseUrl + path, {
      method,
      headers: allHeaders,
      body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      json = null;
    }
    return { status: res.status, headers: res.headers, json, text };
  };

  const close = () => new Promise((resolve) => server.close(resolve));

  return { request, close, service: kittenService };
};

module.exports = { TEST_TOKEN, testConfig, mockKittenService, startApp };
