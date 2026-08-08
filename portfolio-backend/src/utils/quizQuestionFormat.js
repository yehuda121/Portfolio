const { pickLang } = require("./quizHelpers");

/**
 * Public question payload for GET /api/quiz/questions/next.
 * Never include explanation text or maps — only a boolean hasExplanation.
 */
function formatQuestionForClient(item, lang) {
  const questionText = pickLang(item.questionText, lang);
  const answers = pickLang(item.answers, lang);
  if (!questionText || !Array.isArray(answers) || answers.length !== 4) {
    return null;
  }
  return {
    questionId: item.questionId,
    category: item.category,
    difficulty: item.difficulty,
    questionText,
    answers,
    hasExplanation: !!pickLang(item.explanation, lang),
    questionTextI18n: item.questionText,
    answersI18n: item.answers,
  };
}

function assertNoExplanationLeak(payload) {
  if (!payload || typeof payload !== "object") return true;
  const forbidden = ["explanation", "explanationI18n", "explanationText", "correctIndex"];
  return !forbidden.some((key) => Object.prototype.hasOwnProperty.call(payload, key));
}

module.exports = {
  formatQuestionForClient,
  assertNoExplanationLeak,
};
