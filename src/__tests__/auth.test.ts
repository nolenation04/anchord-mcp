import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractBearerToken } from "../auth.js";

describe("extractBearerToken", () => {
  it("extracts token from valid Bearer header", () => {
    assert.equal(extractBearerToken("Bearer abc123"), "abc123");
  });

  it("is case-insensitive for the Bearer prefix", () => {
    assert.equal(extractBearerToken("bearer abc123"), "abc123");
    assert.equal(extractBearerToken("BEARER abc123"), "abc123");
    assert.equal(extractBearerToken("BeArEr abc123"), "abc123");
  });

  it("returns null for null input", () => {
    assert.equal(extractBearerToken(null), null);
  });

  it("returns null for undefined input", () => {
    assert.equal(extractBearerToken(undefined), null);
  });

  it("returns null for empty string", () => {
    assert.equal(extractBearerToken(""), null);
  });

  it("returns null for Basic auth scheme", () => {
    assert.equal(extractBearerToken("Basic abc123"), null);
  });

  it("returns null for Bearer with no token (whitespace only)", () => {
    assert.equal(extractBearerToken("Bearer "), null);
  });

  it("returns null for Bearer with space in token", () => {
    assert.equal(extractBearerToken("Bearer abc def"), null);
  });

  it("returns null for just the word Bearer", () => {
    assert.equal(extractBearerToken("Bearer"), null);
  });

  it("handles long realistic API keys", () => {
    const key = "sk_live_51abc123def456ghi789jkl012mno345pqr678stu901vwx234yz";
    assert.equal(extractBearerToken(`Bearer ${key}`), key);
  });
});
