const express = require("express");
const {
  ScanCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("../../config/dynamo");
const { createAdminToken, verifyAdminToken, requireAdmin, getAdminPassword, safeEqualString, checkLoginRateLimit, clearLoginRateLimit } = require("../../utils/adminAuth");
const { validateQuestion } = require("../../utils/validateQuestion");
const { VALID_CATEGORIES, VALID_DIFFICULTIES } = require("../../utils/quizConstants");
const logger = require("../../utils/logger");
const { mapDynamoError } = require("../../utils/mapDynamoError");
const characterChatHandler = require("./characterChat");

const router = express.Router();
const QUESTIONS_TABLE = process.env.QUIZ_QUESTIONS_TABLE;

function matchesFilters(item, { category, difficulty, active, search }) {
  if (category && item.category !== category) return false;
  if (difficulty && item.difficulty !== difficulty) return false;
  if (active === "true" && item.isActive !== true) return false;
  if (active === "false" && item.isActive !== false) return false;
  if (search) {
    const q = search.toLowerCase();
    const en = (item.questionText?.en || "").toLowerCase();
    const he = (item.questionText?.he || "").toLowerCase();
    if (!en.includes(q) && !he.includes(q)) return false;
  }
  return true;
}

async function scanAllQuestions() {
  const items = [];
  let lastKey;
  do {
    const out = await ddb.send(
      new ScanCommand({
        TableName: QUESTIONS_TABLE,
        ExclusiveStartKey: lastKey,
      })
    );
    items.push(...(out.Items || []));
    lastKey = out.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

router.post("/login", (req, res) => {
  const password = getAdminPassword();
  if (!password) {
    return res.status(503).json({ ok: false, error: "admin_not_configured" });
  }

  const rate = checkLoginRateLimit(req);
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(Math.ceil((rate.retryAfterMs || 0) / 1000) || 60));
    return res.status(429).json({ ok: false, error: "too_many_attempts" });
  }

  const { password: submitted } = req.body || {};
  if (!submitted || !safeEqualString(submitted, password)) {
    return res.status(401).json({ ok: false, error: "invalid_password" });
  }

  clearLoginRateLimit(req);
  const token = createAdminToken();
  if (!token) {
    return res.status(503).json({ ok: false, error: "admin_not_configured" });
  }
  return res.json({ ok: true, token });
});

router.post("/logout", requireAdmin, (req, res) => {
  return res.json({ ok: true });
});

router.get("/me", (req, res) => {
  const token = req.header("x-quiz-admin-token");
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ ok: false, authenticated: false });
  }
  return res.json({ ok: true, authenticated: true });
});

router.get("/questions", requireAdmin, async (req, res) => {
  try {
    if (!QUESTIONS_TABLE) {
      return res.status(500).json({ ok: false, error: "server_misconfigured" });
    }

    const { category, difficulty, active, search } = req.query;
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ ok: false, error: "invalid_category" });
    }
    if (difficulty && !VALID_DIFFICULTIES.includes(difficulty)) {
      return res.status(400).json({ ok: false, error: "invalid_difficulty" });
    }

    const all = await scanAllQuestions();
    const filtered = all
      .filter((item) => matchesFilters(item, { category, difficulty, active, search }))
      .sort((a, b) => (a.questionId || "").localeCompare(b.questionId || ""));

    return res.json({ ok: true, questions: filtered, total: filtered.length });
  } catch (err) {
    const error = mapDynamoError(err);
    logger.error("quiz_admin_list_failed", { message: err.message, error });
    const status = error === "aws_not_configured" ? 503 : 500;
    return res.status(status).json({ ok: false, error });
  }
});

router.post("/questions", requireAdmin, async (req, res) => {
  try {
    if (!QUESTIONS_TABLE) {
      return res.status(500).json({ ok: false, error: "server_misconfigured" });
    }

    const body = req.body || {};
    const errors = validateQuestion(body);
    if (errors.length) {
      return res.status(400).json({ ok: false, error: "validation_failed", details: errors });
    }

    const existing = await ddb.send(
      new GetCommand({ TableName: QUESTIONS_TABLE, Key: { questionId: body.questionId } })
    );
    if (existing.Item) {
      return res.status(409).json({ ok: false, error: "question_already_exists" });
    }

    const nowIso = new Date().toISOString();
    const item = {
      ...body,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await ddb.send(new PutCommand({ TableName: QUESTIONS_TABLE, Item: item }));
    return res.status(201).json({ ok: true, question: item });
  } catch (err) {
    const error = mapDynamoError(err);
    logger.error("quiz_admin_create_failed", { message: err.message, error });
    const status = error === "aws_not_configured" ? 503 : 500;
    return res.status(status).json({ ok: false, error });
  }
});

router.put("/questions/:questionId", requireAdmin, async (req, res) => {
  try {
    if (!QUESTIONS_TABLE) {
      return res.status(500).json({ ok: false, error: "server_misconfigured" });
    }

    const { questionId } = req.params;
    const body = { ...req.body, questionId };
    const errors = validateQuestion(body);
    if (errors.length) {
      return res.status(400).json({ ok: false, error: "validation_failed", details: errors });
    }

    const existing = await ddb.send(
      new GetCommand({ TableName: QUESTIONS_TABLE, Key: { questionId } })
    );
    if (!existing.Item) {
      return res.status(404).json({ ok: false, error: "question_not_found" });
    }

    const item = {
      ...body,
      createdAt: existing.Item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await ddb.send(new PutCommand({ TableName: QUESTIONS_TABLE, Item: item }));
    return res.json({ ok: true, question: item });
  } catch (err) {
    const error = mapDynamoError(err);
    logger.error("quiz_admin_update_failed", { message: err.message, error });
    const status = error === "aws_not_configured" ? 503 : 500;
    return res.status(status).json({ ok: false, error });
  }
});

router.delete("/questions/:questionId", requireAdmin, async (req, res) => {
  try {
    if (!QUESTIONS_TABLE) {
      return res.status(500).json({ ok: false, error: "server_misconfigured" });
    }

    const { questionId } = req.params;
    const existing = await ddb.send(
      new GetCommand({ TableName: QUESTIONS_TABLE, Key: { questionId } })
    );
    if (!existing.Item) {
      return res.status(404).json({ ok: false, error: "question_not_found" });
    }

    await ddb.send(new DeleteCommand({ TableName: QUESTIONS_TABLE, Key: { questionId } }));
    return res.json({ ok: true });
  } catch (err) {
    const error = mapDynamoError(err);
    logger.error("quiz_admin_delete_failed", { message: err.message, error });
    const status = error === "aws_not_configured" ? 503 : 500;
    return res.status(status).json({ ok: false, error });
  }
});

router.patch("/questions/:questionId/toggle-active", requireAdmin, async (req, res) => {
  try {
    if (!QUESTIONS_TABLE) {
      return res.status(500).json({ ok: false, error: "server_misconfigured" });
    }

    const { questionId } = req.params;
    const existing = await ddb.send(
      new GetCommand({ TableName: QUESTIONS_TABLE, Key: { questionId } })
    );
    if (!existing.Item) {
      return res.status(404).json({ ok: false, error: "question_not_found" });
    }

    const nextActive = !existing.Item.isActive;
    const out = await ddb.send(
      new UpdateCommand({
        TableName: QUESTIONS_TABLE,
        Key: { questionId },
        UpdateExpression: "SET isActive = :active, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":active": nextActive,
          ":updatedAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
    );

    return res.json({ ok: true, question: out.Attributes });
  } catch (err) {
    const error = mapDynamoError(err);
    logger.error("quiz_admin_toggle_failed", { message: err.message, error });
    const status = error === "aws_not_configured" ? 503 : 500;
    return res.status(status).json({ ok: false, error });
  }
});

router.post("/character-chat", requireAdmin, characterChatHandler);

module.exports = router;
