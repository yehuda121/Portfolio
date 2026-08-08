const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { applyAnswerToSession } = require("../src/utils/quizSessionState");

describe("applyAnswerToSession", () => {
  const base = {
    mode: "practice",
    questionIndex: 1,
    correctCount: 0,
    wrongCount: 0,
    timeoutCount: 0,
    askedQuestionIds: [],
    wrongQueue: [],
    results: [],
  };

  it("increments correct counts and does not push wrong queue", () => {
    const out = applyAnswerToSession(base, {
      questionId: "q1",
      isCorrect: true,
      isTimeout: false,
    });
    assert.equal(out.newCorrectCount, 1);
    assert.equal(out.newWrongCount, 0);
    assert.equal(out.pushWrong, false);
    assert.equal(out.newQuestionIndex, 2);
  });

  it("marks wrong answers for practice requeue", () => {
    const out = applyAnswerToSession(base, {
      questionId: "q1",
      isCorrect: false,
      isTimeout: false,
    });
    assert.equal(out.newWrongCount, 1);
    assert.equal(out.pushWrong, true);
  });

  it("timeout increments timeoutCount but still requeues in practice (!isCorrect)", () => {
    const out = applyAnswerToSession(base, {
      questionId: "q1",
      isCorrect: false,
      isTimeout: true,
    });
    assert.equal(out.newTimeoutCount, 1);
    assert.equal(out.newWrongCount, 0);
    // Preserves prior session.js behavior: practice && !isCorrect includes timeouts
    assert.equal(out.pushWrong, true);
  });
});
