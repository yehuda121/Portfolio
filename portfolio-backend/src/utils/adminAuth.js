const crypto = require("crypto");

const DEFAULT_TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

/** @type {Map<string, { count: number, resetAt: number }>} */
const loginAttempts = new Map();

function getAdminPassword() {
  return process.env.QUIZ_ADMIN_PASSWORD || "";
}

function getTokenSecret() {
  return process.env.QUIZ_ADMIN_TOKEN_SECRET || getAdminPassword();
}

function getTokenTtlMs() {
  const raw = Number(process.env.QUIZ_ADMIN_TOKEN_TTL_MS);
  if (Number.isFinite(raw) && raw >= 60_000) return raw;
  return DEFAULT_TOKEN_TTL_MS;
}

function safeEqualString(a, b) {
  const bufA = Buffer.from(String(a ?? ""), "utf8");
  const bufB = Buffer.from(String(b ?? ""), "utf8");
  if (bufA.length !== bufB.length) {
    // Constant-time-ish reject when lengths differ
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function createAdminToken() {
  const secret = getTokenSecret();
  if (!secret) return null;

  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      exp: Date.now() + getTokenTtlMs(),
    }),
    "utf8"
  ).toString("base64url");

  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== "string") return false;
  const secret = getTokenSecret();
  if (!secret) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [payload, sig] = parts;
  if (!payload || !sig) return false;

  const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data || data.v !== 1 || typeof data.exp !== "number") return false;
    if (Date.now() > data.exp) return false;
    return true;
  } catch {
    return false;
  }
}

function getClientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function checkLoginRateLimit(req) {
  const key = getClientKey(req);
  const now = Date.now();
  const entry = loginAttempts.get(key);

  if (!entry || now >= entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return { allowed: true, remaining: LOGIN_MAX_ATTEMPTS - 1 };
  }

  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { allowed: true, remaining: LOGIN_MAX_ATTEMPTS - entry.count };
}

function clearLoginRateLimit(req) {
  loginAttempts.delete(getClientKey(req));
}

function requireAdmin(req, res, next) {
  const token = req.header("x-quiz-admin-token");
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  return next();
}

module.exports = {
  createAdminToken,
  verifyAdminToken,
  requireAdmin,
  getAdminPassword,
  safeEqualString,
  checkLoginRateLimit,
  clearLoginRateLimit,
  getTokenTtlMs,
};
