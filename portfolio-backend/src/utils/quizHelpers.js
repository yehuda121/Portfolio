function getAnonId(req) {
  const value = req.header("x-anon-id");
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length < 10 || trimmed.length > 64) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}

function pickLang(obj, lang) {
  if (!obj || typeof obj !== "object") return null;
  return obj[lang] ?? obj.en ?? null;
}

function calcExpiresAtDays(days) {
  return Math.floor((Date.now() + days * 24 * 60 * 60 * 1000) / 1000);
}

module.exports = {
  getAnonId,
  pickLang,
  calcExpiresAtDays,
};
