const express = require("express");
const crypto = require("crypto");
const { UpdateCommand, GetCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("../../config/dynamo");
const { getAnonId, calcExpiresAtDays } = require("../../utils/quizHelpers");
const { requireAdmin } = require("../../utils/adminAuth");
const logger = require("../../utils/logger");

const router = express.Router();
const TABLE = process.env.QUIZ_USER_STATS_TABLE;

function getOrCreateAnonId(req) {
  const fromHeader = getAnonId(req);
  if (fromHeader) return fromHeader;
  return crypto.randomUUID();
}

router.post("/upsert", async (req, res) => {
  try {
    if (!TABLE || !process.env.AWS_REGION_DB) {
      return res.status(500).json({ ok: false, error: "server_misconfigured" });
    }

    const anonId = getOrCreateAnonId(req);
    const nowIso = new Date().toISOString();
    const expiresAt = calcExpiresAtDays(30);

    const out = await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { anonId },
        UpdateExpression:
          "SET createdAt = if_not_exists(createdAt, :createdAt), " +
          "lastSeenAt = :lastSeenAt, " +
          "expiresAt = :expiresAt, " +
          "stats = if_not_exists(stats, :emptyMap), " +
          "wrongQuestions = if_not_exists(wrongQuestions, :emptyMap)",
        ExpressionAttributeValues: {
          ":createdAt": nowIso,
          ":lastSeenAt": nowIso,
          ":expiresAt": expiresAt,
          ":emptyMap": {},
        },
        ReturnValues: "ALL_NEW",
      })
    );

    return res.json({ ok: true, anonId, item: out.Attributes });
  } catch (err) {
    logger.error("quiz_stats_upsert_failed", { message: err.message });
    return res.status(500).json({ ok: false, error: "stats_upsert_failed" });
  }
});

router.get("/", async (req, res) => {
  try {
    if (!TABLE || !process.env.AWS_REGION_DB) {
      return res.status(500).json({ ok: false, error: "server_misconfigured" });
    }

    const anonId = getAnonId(req);
    if (!anonId) return res.status(400).json({ ok: false, error: "missing_x_anon_id" });

    const out = await ddb.send(
      new GetCommand({ TableName: TABLE, Key: { anonId } })
    );

    return res.json({ ok: true, anonId, item: out.Item || null });
  } catch (err) {
    logger.error("quiz_stats_get_failed", { message: err.message });
    return res.status(500).json({ ok: false, error: "stats_get_failed" });
  }
});

// Destructive — admin only (previously any client with an anon id could wipe user rows)
router.delete("/", requireAdmin, async (req, res) => {
  try {
    if (!TABLE || !process.env.AWS_REGION_DB) {
      return res.status(500).json({ ok: false, error: "server_misconfigured" });
    }

    const anonId = getAnonId(req);
    if (!anonId) return res.status(400).json({ ok: false, error: "missing_x_anon_id" });

    await ddb.send(
      new DeleteCommand({ TableName: TABLE, Key: { anonId } })
    );

    return res.json({ ok: true });
  } catch (err) {
    logger.error("quiz_stats_delete_failed", { message: err.message });
    return res.status(500).json({ ok: false, error: "stats_delete_failed" });
  }
});

module.exports = router;
