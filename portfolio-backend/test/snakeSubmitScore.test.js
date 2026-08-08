const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { buildSnakeBestScoreUpdateParams } = require("../src/utils/snakeScoreUpdate");

describe("snake best score update", () => {
  it("requires a higher score via DynamoDB condition", () => {
    const params = buildSnakeBestScoreUpdateParams("snake_bestScore", 42, "2026-01-01T00:00:00.000Z");
    assert.match(
      params.ConditionExpression,
      /attribute_not_exists\(bestScore\) OR bestScore < :score/
    );
    assert.equal(params.ExpressionAttributeValues[":score"], 42);
    assert.equal(params.Key.pk, "snake");
    assert.equal(params.Key.sk, "global");
  });
});
