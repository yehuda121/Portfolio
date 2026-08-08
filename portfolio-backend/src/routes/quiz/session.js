const express = require("express");
const crypto = require("crypto");
const { UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("../../config/dynamo");
const { getAnonId, pickLang, calcExpiresAtDays } = require("../../utils/quizHelpers");
const { applyAnswerToSession } = require("../../utils/quizSessionState");
const {
  VALID_CATEGORIES,
  VALID_DIFFICULTIES,
  VALID_MODES,
  INTERVIEW_TIME_OPTIONS,
  INTERVIEW_QUESTION_COUNT,
} = require("../../utils/quizConstants");
const logger = require("../../utils/logger");
const { mapDynamoError } = require("../../utils/mapDynamoError");

const router = express.Router();
const USERS_TABLE = process.env.QUIZ_USER_STATS_TABLE;
const QUESTIONS_TABLE = process.env.QUIZ_QUESTIONS_TABLE;

const categorySet = new Set(VALID_CATEGORIES);
const difficultySet = new Set(VALID_DIFFICULTIES);
const modeSet = new Set(VALID_MODES);

async function loadQuestionForAnswer(questionId, lang) {
  const qOut = await ddb.send(
    new GetCommand({
      TableName: QUESTIONS_TABLE,
      Key: { questionId },
      ProjectionExpression: "questionId, correctIndex, explanation, questionText, answers, isActive",
    })
  );
  const qItem = qOut.Item;
  if (!qItem) return { error: "question_not_found", status: 404 };
  if (qItem.isActive === false) return { error: "question_inactive", status: 400 };
  if (typeof qItem.correctIndex !== "number") {
    return { error: "invalid_question_correctIndex", status: 500 };
  }
  return {
    item: qItem,
    explanationText: pickLang(qItem.explanation, lang),
    questionText: pickLang(qItem.questionText, lang),
    answers: pickLang(qItem.answers, lang),
  };
}

function buildResultEntry(qItem, lang, selectedIndex, isCorrect, timedOut) {
  return {
    questionId: qItem.questionId,
    questionText: pickLang(qItem.questionText, lang),
    answers: pickLang(qItem.answers, lang),
    selectedIndex: timedOut ? null : selectedIndex,
    correctIndex: qItem.correctIndex,
    isCorrect,
    timedOut: !!timedOut,
    explanation: pickLang(qItem.explanation, lang),
  };
}

router.post("/start", async (req, res) => {
  try {
    if (!process.env.AWS_REGION_DB || !USERS_TABLE) {
      return res.status(500).json({ ok: false, error: "server_misconfigured" });
    }

    const anonId = getAnonId(req);
    if (!anonId) return res.status(400).json({ ok: false, error: "missing_x_anon_id" });

    const { category, difficulty, mode, timePerQuestion } = req.body || {};
    if (!category || !difficulty) {
      return res.status(400).json({ ok: false, error: "missing_category_or_difficulty" });
    }
    if (!categorySet.has(category)) {
      return res.status(400).json({ ok: false, error: "invalid_category" });
    }
    if (!difficultySet.has(difficulty)) {
      return res.status(400).json({ ok: false, error: "invalid_difficulty" });
    }

    const sessionMode = mode || "practice";
    if (!modeSet.has(sessionMode)) {
      return res.status(400).json({ ok: false, error: "invalid_mode" });
    }

    if (sessionMode === "interview") {
      if (!INTERVIEW_TIME_OPTIONS.includes(timePerQuestion)) {
        return res.status(400).json({ ok: false, error: "invalid_time_per_question" });
      }
    }

    const nowIso = new Date().toISOString();
    const expiresAt = calcExpiresAtDays(30);
    const sessionId = crypto.randomUUID();

    const sessionCurrent = {
      sessionId,
      startedAt: nowIso,
      category,
      difficulty,
      mode: sessionMode,
      timePerQuestion: sessionMode === "interview" ? timePerQuestion : null,
      questionIndex: 1,
      correctCount: 0,
      wrongCount: 0,
      timeoutCount: 0,
      askedQuestionIds: [],
      wrongQueue: [],
      results: [],
    };

    const out = await ddb.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { anonId },
        UpdateExpression: `
          SET lastSeenAt = :lastSeenAt,
              expiresAt = :expiresAt,
              sessionCurrent = :sessionCurrent,
              historyScores = if_not_exists(historyScores, :emptyList),
              historyTimestamps = if_not_exists(historyTimestamps, :emptyList)
        `,
        ExpressionAttributeValues: {
          ":lastSeenAt": nowIso,
          ":expiresAt": expiresAt,
          ":sessionCurrent": sessionCurrent,
          ":emptyList": [],
        },
        ReturnValues: "ALL_NEW",
      })
    );

    return res.json({ ok: true, sessionCurrent: out.Attributes.sessionCurrent });
  } catch (err) {
    const error = mapDynamoError(err);
    logger.error("quiz_session_start_failed", { message: err.message, error });
    const status = error === "aws_not_configured" ? 503 : 500;
    return res.status(status).json({ ok: false, error });
  }
});

router.post("/answer", async (req, res) => {
  try {
    if (!process.env.AWS_REGION_DB || !USERS_TABLE || !QUESTIONS_TABLE) {
      return res.status(500).json({ ok: false, error: "server_misconfigured" });
    }

    const anonId = getAnonId(req);
    if (!anonId) return res.status(400).json({ ok: false, error: "missing_x_anon_id" });

    const { questionId, selectedIndex, lang, timedOut } = req.body || {};
    if (!questionId) {
      return res.status(400).json({ ok: false, error: "missing_questionId" });
    }

    const chosenLang = (lang || "en").toString();
    if (!["en", "he"].includes(chosenLang)) {
      return res.status(400).json({ ok: false, error: "invalid_lang" });
    }

    const isTimeout = timedOut === true;
    if (!isTimeout) {
      if (typeof selectedIndex !== "number") {
        return res.status(400).json({ ok: false, error: "missing_selectedIndex" });
      }
      if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) {
        return res.status(400).json({ ok: false, error: "invalid_selectedIndex" });
      }
    }

    const userOut = await ddb.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { anonId },
        ProjectionExpression: "sessionCurrent, historyScores, historyTimestamps",
      })
    );

    const session = userOut.Item?.sessionCurrent;
    if (!session) return res.status(400).json({ ok: false, error: "no_active_session" });

    if (!session.lastQuestionId || session.lastQuestionId !== questionId) {
      return res.status(400).json({ ok: false, error: "question_not_current" });
    }

    const previouslyAsked = Array.isArray(session.askedQuestionIds) ? session.askedQuestionIds : [];
    if (previouslyAsked.includes(questionId)) {
      return res.status(400).json({ ok: false, error: "question_already_answered" });
    }

    const loaded = await loadQuestionForAnswer(questionId, chosenLang);
    if (loaded.error) {
      return res.status(loaded.status).json({ ok: false, error: loaded.error });
    }

    const qItem = loaded.item;
    const isCorrect = !isTimeout && selectedIndex === qItem.correctIndex;
    const nowIso = new Date().toISOString();
    const expiresAt = calcExpiresAtDays(30);

    const transition = applyAnswerToSession(session, {
      questionId,
      isCorrect,
      isTimeout,
    });
    const {
      asked,
      wrongQueue,
      results,
      newCorrectCount,
      newWrongCount,
      newTimeoutCount,
      newQuestionIndex,
      pushWrong,
    } = transition;

    if (pushWrong) {
      wrongQueue.push(questionId);
    }

    if (session.mode === "interview") {
      results.push(buildResultEntry(qItem, chosenLang, isTimeout ? null : selectedIndex, isCorrect, isTimeout));
    }

    const interviewFinished =
      session.mode === "interview" && asked.length + 1 >= INTERVIEW_QUESTION_COUNT;

    const answerCondition =
      "attribute_exists(sessionCurrent) AND sessionCurrent.sessionId = :sid AND sessionCurrent.lastQuestionId = :qid";

    if (session.mode === "practice" || !interviewFinished) {
      let out;
      try {
        out = await ddb.send(
          new UpdateCommand({
            TableName: USERS_TABLE,
            Key: { anonId },
            UpdateExpression: `
            SET lastSeenAt = :lastSeenAt,
                expiresAt = :expiresAt,
                sessionCurrent.questionIndex = :qIndex,
                sessionCurrent.correctCount = :cCount,
                sessionCurrent.wrongCount = :wCount,
                sessionCurrent.timeoutCount = :tCount,
                sessionCurrent.askedQuestionIds = list_append(if_not_exists(sessionCurrent.askedQuestionIds, :emptyList), :qidList),
                sessionCurrent.wrongQueue = :wrongQueue,
                sessionCurrent.results = :results
            REMOVE sessionCurrent.lastQuestionId
          `,
            ConditionExpression: answerCondition,
            ExpressionAttributeValues: {
              ":lastSeenAt": nowIso,
              ":expiresAt": expiresAt,
              ":qIndex": newQuestionIndex,
              ":cCount": newCorrectCount,
              ":wCount": newWrongCount,
              ":tCount": newTimeoutCount,
              ":emptyList": [],
              ":qidList": [questionId],
              ":wrongQueue": wrongQueue,
              ":results": results,
              ":sid": session.sessionId,
              ":qid": questionId,
            },
            ReturnValues: "ALL_NEW",
          })
        );
      } catch (err) {
        if (err.name === "ConditionalCheckFailedException") {
          return res.status(409).json({ ok: false, error: "question_already_answered" });
        }
        throw err;
      }

      const response = {
        ok: true,
        finished: false,
        isCorrect,
        timedOut: isTimeout,
        correctIndex: qItem.correctIndex,
        mode: session.mode,
        sessionCurrent: out.Attributes.sessionCurrent,
      };

      if (session.mode === "practice") {
        if (isCorrect) {
          response.hasExplanation = !!loaded.explanationText;
        } else {
          response.explanation = loaded.explanationText || null;
          response.autoShowExplanation = true;
        }
      }

      return res.json(response);
    }

    const total = INTERVIEW_QUESTION_COUNT;
    const scorePercent = Math.round((newCorrectCount / total) * 100);
    const wrongAnswers = results.filter((r) => !r.isCorrect);
    const summary = {
      mode: "interview",
      category: session.category,
      difficulty: session.difficulty,
      scorePercent,
      correctCount: newCorrectCount,
      wrongCount: newWrongCount,
      timeoutCount: newTimeoutCount,
      totalQuestions: total,
      wrongAnswers,
      finishedAt: nowIso,
    };

    const nowEpoch = Math.floor(Date.now() / 1000);
    const prevScores = Array.isArray(userOut.Item?.historyScores) ? userOut.Item.historyScores : [];
    const prevTimes = Array.isArray(userOut.Item?.historyTimestamps) ? userOut.Item.historyTimestamps : [];
    const nextScores = [...prevScores, scorePercent];
    const nextTimes = [...prevTimes, nowEpoch];
    while (nextScores.length > 50) nextScores.shift();
    while (nextTimes.length > 50) nextTimes.shift();

    let out2;
    try {
      out2 = await ddb.send(
        new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { anonId },
          UpdateExpression: `
          SET lastSeenAt = :lastSeenAt,
              expiresAt = :expiresAt,
              historyScores = :historyScores,
              historyTimestamps = :historyTimestamps,
              lastSessionSummary = :summary
          REMOVE sessionCurrent
        `,
          ConditionExpression: answerCondition,
          ExpressionAttributeValues: {
            ":lastSeenAt": nowIso,
            ":expiresAt": expiresAt,
            ":historyScores": nextScores,
            ":historyTimestamps": nextTimes,
            ":summary": summary,
            ":sid": session.sessionId,
            ":qid": questionId,
          },
          ReturnValues: "ALL_NEW",
        })
      );
    } catch (err) {
      if (err.name === "ConditionalCheckFailedException") {
        return res.status(409).json({ ok: false, error: "question_already_answered" });
      }
      throw err;
    }

    return res.json({
      ok: true,
      finished: true,
      isCorrect,
      timedOut: isTimeout,
      mode: "interview",
      correctIndex: qItem.correctIndex,
      scorePercent,
      summary,
      historyScores: out2.Attributes.historyScores,
      historyTimestamps: out2.Attributes.historyTimestamps,
    });
  } catch (err) {
    const error = mapDynamoError(err);
    logger.error("quiz_session_answer_failed", { message: err.message, error });
    const status = error === "aws_not_configured" ? 503 : 500;
    return res.status(status).json({ ok: false, error });
  }
});

router.post("/explanation", async (req, res) => {
  try {
    if (!QUESTIONS_TABLE) {
      return res.status(500).json({ ok: false, error: "server_misconfigured" });
    }

    const anonId = getAnonId(req);
    if (!anonId) return res.status(400).json({ ok: false, error: "missing_x_anon_id" });

    const { questionId, lang } = req.body || {};
    if (!questionId) return res.status(400).json({ ok: false, error: "missing_questionId" });

    const chosenLang = (lang || "en").toString();
    if (!["en", "he"].includes(chosenLang)) {
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
    if (!session || session.mode !== "practice") {
      return res.status(400).json({ ok: false, error: "explanation_not_available" });
    }

    const asked = Array.isArray(session.askedQuestionIds) ? session.askedQuestionIds : [];
    if (!asked.includes(questionId)) {
      return res.status(400).json({ ok: false, error: "question_not_answered" });
    }

    const loaded = await loadQuestionForAnswer(questionId, chosenLang);
    if (loaded.error) {
      return res.status(loaded.status).json({ ok: false, error: loaded.error });
    }

    return res.json({
      ok: true,
      explanation: loaded.explanationText || null,
    });
  } catch (err) {
    const error = mapDynamoError(err);
    logger.error("quiz_explanation_failed", { message: err.message, error });
    const status = error === "aws_not_configured" ? 503 : 500;
    return res.status(status).json({ ok: false, error });
  }
});

router.get("/current", async (req, res) => {
  try {
    if (!process.env.AWS_REGION_DB || !USERS_TABLE) {
      return res.status(500).json({ ok: false, error: "server_misconfigured" });
    }

    const anonId = getAnonId(req);
    if (!anonId) return res.status(400).json({ ok: false, error: "missing_x_anon_id" });

    const out = await ddb.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { anonId },
        ProjectionExpression: "sessionCurrent, historyScores, historyTimestamps, lastSessionSummary",
      })
    );

    return res.json({
      ok: true,
      anonId,
      sessionCurrent: out.Item?.sessionCurrent || null,
      historyScores: out.Item?.historyScores || [],
      historyTimestamps: out.Item?.historyTimestamps || [],
      lastSessionSummary: out.Item?.lastSessionSummary || null,
    });
  } catch (err) {
    const error = mapDynamoError(err);
    logger.error("quiz_session_current_failed", { message: err.message, error });
    const status = error === "aws_not_configured" ? 503 : 500;
    return res.status(status).json({ ok: false, error });
  }
});

router.get("/summary", async (req, res) => {
  try {
    if (!USERS_TABLE) {
      return res.status(500).json({ ok: false, error: "server_misconfigured" });
    }

    const anonId = getAnonId(req);
    if (!anonId) return res.status(400).json({ ok: false, error: "missing_x_anon_id" });

    const out = await ddb.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { anonId },
        ProjectionExpression: "lastSessionSummary",
      })
    );

    return res.json({
      ok: true,
      summary: out.Item?.lastSessionSummary || null,
    });
  } catch (err) {
    const error = mapDynamoError(err);
    logger.error("quiz_session_summary_failed", { message: err.message, error });
    const status = error === "aws_not_configured" ? 503 : 500;
    return res.status(status).json({ ok: false, error });
  }
});

module.exports = router;
