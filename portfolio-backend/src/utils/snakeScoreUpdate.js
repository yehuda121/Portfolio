const PK_VALUE = "snake";
const SK_VALUE = "global";

function buildSnakeBestScoreUpdateParams(tableName, score, nowIso) {
  return {
    TableName: tableName,
    Key: { pk: PK_VALUE, sk: SK_VALUE },
    UpdateExpression: "SET bestScore = :score, updatedAt = :updatedAt",
    ConditionExpression: "attribute_not_exists(bestScore) OR bestScore < :score",
    ExpressionAttributeValues: {
      ":score": score,
      ":updatedAt": nowIso,
    },
  };
}

module.exports = {
  PK_VALUE,
  SK_VALUE,
  buildSnakeBestScoreUpdateParams,
};
