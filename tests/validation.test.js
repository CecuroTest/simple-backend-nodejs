const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { HttpError } = require("../src/errors");
const {
  validateKittenInput,
  parsePagination,
  parseId,
  NAME_MAX_LENGTH,
  AGE_MIN,
  AGE_MAX,
} = require("../src/validation");

const assertBadRequest = (fn, pattern) => {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof HttpError);
    assert.equal(err.status, 400);
    if (pattern) assert.match(err.message, pattern);
    return true;
  });
};

describe("validateKittenInput", () => {
  test("accepts valid input and trims name", () => {
    assert.deepEqual(validateKittenInput({ name: "  Tom ", age: 3 }), {
      name: "Tom",
      age: 3,
    });
  });

  test("drops unknown fields", () => {
    assert.deepEqual(validateKittenInput({ name: "Tom", age: 3, id: 99 }), {
      name: "Tom",
      age: 3,
    });
  });

  test("accepts boundary values", () => {
    const longName = "x".repeat(NAME_MAX_LENGTH);
    assert.equal(validateKittenInput({ name: longName, age: AGE_MIN }).age, AGE_MIN);
    assert.equal(validateKittenInput({ name: "a", age: AGE_MAX }).age, AGE_MAX);
  });

  for (const body of [null, undefined, [], "str", 5]) {
    test(`rejects non-object body ${JSON.stringify(body)}`, () => {
      assertBadRequest(() => validateKittenInput(body), /JSON object/);
    });
  }

  for (const name of [undefined, null, 5, {}, ["a"]]) {
    test(`rejects non-string name ${JSON.stringify(name)}`, () => {
      assertBadRequest(() => validateKittenInput({ name, age: 1 }), /name/);
    });
  }

  for (const name of ["", "   ", "x".repeat(NAME_MAX_LENGTH + 1)]) {
    test(`rejects name of length ${name.length}`, () => {
      assertBadRequest(() => validateKittenInput({ name, age: 1 }), /name/);
    });
  }

  for (const age of [undefined, null, "3", 1.5, -1, AGE_MAX + 1, NaN, Infinity]) {
    test(`rejects age ${String(age)}`, () => {
      assertBadRequest(() => validateKittenInput({ name: "a", age }), /age/);
    });
  }
});

describe("parsePagination", () => {
  const limits = { defaultPageSize: 20, maxPageSize: 100 };

  test("uses defaults", () => {
    assert.deepEqual(parsePagination({}, limits), { limit: 20, offset: 0 });
  });

  test("parses explicit values", () => {
    assert.deepEqual(parsePagination({ limit: "100", offset: "40" }, limits), {
      limit: 100,
      offset: 40,
    });
  });

  for (const limit of ["0", "101", "-1", "abc", "1.5", "", " 5"]) {
    test(`rejects limit=${JSON.stringify(limit)}`, () => {
      assertBadRequest(() => parsePagination({ limit }, limits), /limit/);
    });
  }

  test("rejects repeated limit param (array)", () => {
    assertBadRequest(() => parsePagination({ limit: ["1", "2"] }, limits), /limit/);
  });

  for (const offset of ["-1", "x", "1.5"]) {
    test(`rejects offset=${offset}`, () => {
      assertBadRequest(() => parsePagination({ offset }, limits), /offset/);
    });
  }

  test("rejects unsafe integer offset", () => {
    assertBadRequest(
      () => parsePagination({ offset: "99999999999999999999" }, limits),
      /too large/
    );
  });
});

describe("parseId", () => {
  test("parses positive ids", () => {
    assert.equal(parseId("42"), 42);
  });

  for (const id of ["0", "-1", "abc", "1.0", ""]) {
    test(`rejects id=${JSON.stringify(id)}`, () => {
      assertBadRequest(() => parseId(id), /id/);
    });
  }
});
