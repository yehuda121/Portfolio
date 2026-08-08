const express = require("express");
const { GetCommand, QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("../../config/dynamo");
const { getAnonId } = require("../../utils/quizHelpers");
const { formatQuestionForClient } = require("../../utils/quizQuestionFormat");
const { INTERVIEW_QUESTION_COUNT } = require("../../utils/quizConstants");
const logger = require("../../utils/logger");
const { mapDynamoError } = require("../../utils/mapDynamoError");

const router = express.Router();
const USERS_TABLE = process.env.QUIZ_USER_STATS_TABLE;
const QUESTIONS_TABLE = process.env.QUIZ_QUESTIONS_TABLE;

async function fetchQuestionPool(category, difficulty) {
  const qOut = await ddb.send(
    new QueryCommand({
      TableName: QUESTIONS_TABLE,
      IndexName: "categoryDifficultyIndex",
      KeyConditionExpression: "#cat = :cat AND #diff = :diff",
      FilterExpression: "#active = :trueVal",
      ExpressionAttributeNames: {
        "#cat": "category",
        "#diff": "difficulty",
        "#active": "isActive",
      },
      ExpressionAttributeValues: {
        ":cat": category,
        ":diff": difficulty,
        ":trueVal": true,
      },
      // explanation is used only to compute hasExplanation; never returned to client
      ProjectionExpression: "questionId, category, difficulty, questionText, answers, explanation, isActive",
    })
  );
  return qOut.Items || [];
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

const QUESTION_PROJECTION =
  "questionId, category, difficulty, questionText, answers, explanation, isActive";

function buildNextResponse(session, formatted, askedLength, reshuffled) {
  return {
    ok: true,
    ...formatted,
    questionNumber: session.mode === "interview" ? askedLength + 1 : session.questionIndex,
    totalQuestions: session.mode === "interview" ? INTERVIEW_QUESTION_COUNT : null,
    timePerQuestion: session.mode === "interview" ? session.timePerQuestion : null,
    reshuffled: !!reshuffled,
  };
}

router.get("/next", async (req, res) => {
  try {
    if (!process.env.AWS_REGION_DB || !USERS_TABLE || !QUESTIONS_TABLE) {
      return res.status(500).json({ ok: false, error: "server_misconfigured" });
    }

    const anonId = getAnonId(req);
    if (!anonId) return res.status(400).json({ ok: false, error: "missing_x_anon_id" });

    const lang = (req.query.lang || "en").toString();
    if (!["en", "he"].includes(lang)) {
      return res.status(400).json({ ok: false, error: "invalid_lang" });
    }

    const userOut = await ddb.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { anonId },
        ProjectionExpression: "sessionCurrent",
      })
    );

    const session = userOut.Item?.sessionCurrent;
    if (!session) return res.status(400).json({ ok: false, error: "no_active_session" });

    const asked = Array.isArray(session.askedQuestionIds) ? [...session.askedQuestionIds] : [];
    const wrongQueue = Array.isArray(session.wrongQueue) ? [...session.wrongQueue] : [];

    // Resume unanswered current question (refresh / parallel /next)
    if (session.lastQuestionId) {
      const currentOut = await ddb.send(
        new GetCommand({
          TableName: QUESTIONS_TABLE,
          Key: { questionId: session.lastQuestionId },
          ProjectionExpression: QUESTION_PROJECTION,
        })
      );
      if (currentOut.Item && currentOut.Item.isActive !== false) {
        const formattedCurrent = formatQuestionForClient(currentOut.Item, lang);
        if (formattedCurrent) {
          return res.json(buildNextResponse(session, formattedCurrent, asked.length, false));
        }
      }
    }

    let reshuffled = false;
    let chosen = null;
    let nextWrongQueue = wrongQueue;

    if (session.mode === "practice" && wrongQueue.length > 0) {
      const idx = Math.floor(Math.random() * wrongQueue.length);
      const questionId = wrongQueue[idx];
      nextWrongQueue = wrongQueue.filter((_, i) => i !== idx);
      const qOut = await ddb.send(
        new GetCommand({
          TableName: QUESTIONS_TABLE,
          Key: { questionId },
          ProjectionExpression: QUESTION_PROJECTION,
        })
      );
      if (qOut.Item && qOut.Item.isActive !== false) {
        chosen = qOut.Item;
      }
    }

    if (!chosen) {
      const pool = await fetchQuestionPool(session.category, session.difficulty);
      let available = pool.filter((it) => !asked.includes(it.questionId));

      if (available.length === 0) {
        if (session.mode === "practice") {
          asked.length = 0;
          available = pool;
          reshuffled = true;
        } else {
          return res.status(404).json({ ok: false, error: "no_more_questions_for_session" });
        }
      }

      if (session.mode === "interview" && asked.length >= INTERVIEW_QUESTION_COUNT) {
        return res.status(400).json({ ok: false, error: "interview_session_complete" });
      }

      chosen = pickRandom(available);
    }

    const formatted = formatQuestionForClient(chosen, lang);
    if (!formatted) {
      return res.status(500).json({ ok: false, error: "invalid_question_data" });
    }

    const updateValues = {
      ":qid": chosen.questionId,
      ":wrongQueue": nextWrongQueue,
      ":sid": session.sessionId,
    };
    let updateExpression = "SET sessionCurrent.lastQuestionId = :qid, sessionCurrent.wrongQueue = :wrongQueue";
    // Only claim a new current question when none is pending (or same id / cleared stale)
    let conditionExpression =
      "attribute_exists(sessionCurrent) AND sessionCurrent.sessionId = :sid AND attribute_not_exists(sessionCurrent.lastQuestionId)";

    if (session.lastQuestionId) {
      // Stale/invalid lastQuestionId from earlier — allow replace of that id only
      conditionExpression =
        "attribute_exists(sessionCurrent) AND sessionCurrent.sessionId = :sid AND (attribute_not_exists(sessionCurrent.lastQuestionId) OR sessionCurrent.lastQuestionId = :staleQid)";
      updateValues[":staleQid"] = session.lastQuestionId;
    }

    if (reshuffled) {
      updateExpression += ", sessionCurrent.askedQuestionIds = :asked";
      updateValues[":asked"] = [];
    }

    try {
      await ddb.send(
        new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { anonId },
          UpdateExpression: updateExpression,
          ConditionExpression: conditionExpression,
          ExpressionAttributeValues: updateValues,
        })
      );
    } catch (err) {
      if (err.name === "ConditionalCheckFailedException") {
        // Another /next won the race — return whatever is now current
        const again = await ddb.send(
          new GetCommand({
            TableName: USERS_TABLE,
            Key: { anonId },
            ProjectionExpression: "sessionCurrent",
          })
        );
        const s2 = again.Item?.sessionCurrent;
        if (s2?.lastQuestionId) {
          const qOut = await ddb.send(
            new GetCommand({
              TableName: QUESTIONS_TABLE,
              Key: { questionId: s2.lastQuestionId },
              ProjectionExpression: QUESTION_PROJECTION,
            })
          );
          if (qOut.Item) {
            const fmt = formatQuestionForClient(qOut.Item, lang);
            if (fmt) {
              const asked2 = Array.isArray(s2.askedQuestionIds) ? s2.askedQuestionIds.length : asked.length;
              return res.json(buildNextResponse(s2, fmt, asked2, false));
            }
          }
        }
        return res.status(409).json({ ok: false, error: "question_race_conflict" });
      }
      throw err;
    }

    return res.json(buildNextResponse(session, formatted, asked.length, reshuffled));
  } catch (err) {
    const error = mapDynamoError(err);
    logger.error("quiz_next_question_failed", { message: err.message, error });
    const status = error === "aws_not_configured" ? 503 : 500;
    return res.status(status).json({ ok: false, error });
  }
});

module.exports = router;
