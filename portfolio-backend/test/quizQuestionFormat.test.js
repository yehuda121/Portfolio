const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  formatQuestionForClient,
  assertNoExplanationLeak,
} = require("../src/utils/quizQuestionFormat");

describe("quizQuestionFormat /next payload", () => {
  const item = {
    questionId: "oop-1",
    category: "oop",
    difficulty: "junior",
    questionText: { en: "Q?", he: "ש?" },
    answers: { en: ["a", "b", "c", "d"], he: ["א", "ב", "ג", "ד"] },
    explanation: {
      en: "Because the correct answer is b",
      he: "כי התשובה היא ב",
    },
    correctIndex: 1,
  };

  it("does not include explanation fields on formatted /next payload", () => {
    const formatted = formatQuestionForClient(item, "en");
    assert.ok(formatted);
    assert.equal(formatted.hasExplanation, true);
    assert.equal(assertNoExplanationLeak(formatted), true);
    assert.equal(Object.prototype.hasOwnProperty.call(formatted, "explanation"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(formatted, "explanationI18n"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(formatted, "correctIndex"), false);
  });

  it("preserves bilingual question/answers maps without explanations", () => {
    const he = formatQuestionForClient(item, "he");
    assert.equal(he.questionText, "ש?");
    assert.deepEqual(he.answers, ["א", "ב", "ג", "ד"]);
    assert.ok(he.questionTextI18n);
    assert.ok(he.answersI18n);
    assert.equal(assertNoExplanationLeak(he), true);
  });
});
