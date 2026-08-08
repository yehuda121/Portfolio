const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

process.env.QUIZ_ADMIN_PASSWORD = "test-admin-password-xyz";
process.env.QUIZ_ADMIN_TOKEN_SECRET = "test-token-secret-xyz";
process.env.QUIZ_ADMIN_TOKEN_TTL_MS = "3600000";

const {
  createAdminToken,
  verifyAdminToken,
  safeEqualString,
} = require("../src/utils/adminAuth");

describe("adminAuth", () => {
  it("creates and verifies a valid token", () => {
    const token = createAdminToken();
    assert.ok(token);
    assert.equal(verifyAdminToken(token), true);
  });

  it("rejects invalid tokens", () => {
    assert.equal(verifyAdminToken(""), false);
    assert.equal(verifyAdminToken("not.a.token"), false);
    assert.equal(verifyAdminToken("aaaa.bbbb"), false);
  });

  it("rejects expired tokens", () => {
    const prev = process.env.QUIZ_ADMIN_TOKEN_TTL_MS;
    process.env.QUIZ_ADMIN_TOKEN_TTL_MS = "60000";
    // Force expiry by crafting payload with past exp
    const crypto = require("crypto");
    const secret = process.env.QUIZ_ADMIN_TOKEN_SECRET;
    const payload = Buffer.from(JSON.stringify({ v: 1, exp: Date.now() - 1000 }), "utf8").toString(
      "base64url"
    );
    const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
    assert.equal(verifyAdminToken(`${payload}.${sig}`), false);
    process.env.QUIZ_ADMIN_TOKEN_TTL_MS = prev;
  });

  it("compares passwords in a length-safe way", () => {
    assert.equal(safeEqualString("abc", "abc"), true);
    assert.equal(safeEqualString("abc", "abd"), false);
    assert.equal(safeEqualString("abc", "ab"), false);
  });
});
