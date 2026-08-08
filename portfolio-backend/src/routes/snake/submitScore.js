const { UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("../../config/dynamo");
const logger = require("../../utils/logger");
const { mapDynamoError } = require("../../utils/mapDynamoError");
const { PK_VALUE, SK_VALUE, buildSnakeBestScoreUpdateParams } = require("../../utils/snakeScoreUpdate");

const TABLE = process.env.SNAKE_BEST_SCORE_TABLE || "snake_bestScore";
const MAX_SCORE = 100000;

module.exports = async function submitScore(req, res) {
  try {
    const score = Number(req.body?.score);

    if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
      return res.status(400).json({ ok: false, error: "invalid_score" });
    }

    const nowIso = new Date().toISOString();

    try {
      await ddb.send(
        new UpdateCommand(buildSnakeBestScoreUpdateParams(TABLE, score, nowIso))
      );
    } catch (err) {
      if (err.name !== "ConditionalCheckFailedException") {
        throw err;
      }
      // Lower or equal score — keep existing best
    }

    const currentRes = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: PK_VALUE, sk: SK_VALUE },
      })
    );

    const bestScore = Number(currentRes.Item?.bestScore ?? score) || score;
    return res.json({ ok: true, bestScore });
  } catch (err) {
    const error = mapDynamoError(err);
    logger.error("snake_submit_score_failed", { message: err.message, error });
    const status = error === "aws_not_configured" ? 503 : 500;
    return res.status(status).json({ ok: false, error });
  }
};
