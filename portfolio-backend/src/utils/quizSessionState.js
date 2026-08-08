/**
 * Pure session counter / queue updates after an answer (no DynamoDB).
 */
function applyAnswerToSession(session, { questionId, isCorrect, isTimeout }) {
  const asked = Array.isArray(session.askedQuestionIds) ? [...session.askedQuestionIds] : [];
  const wrongQueue = Array.isArray(session.wrongQueue) ? [...session.wrongQueue] : [];
  const results = Array.isArray(session.results) ? [...session.results] : [];

  return {
    asked,
    wrongQueue,
    results,
    newCorrectCount: session.correctCount + (isCorrect ? 1 : 0),
    newWrongCount: session.wrongCount + (!isCorrect && !isTimeout ? 1 : 0),
    newTimeoutCount: session.timeoutCount + (isTimeout ? 1 : 0),
    newQuestionIndex: session.questionIndex + 1,
    pushWrong: session.mode === "practice" && !isCorrect,
  };
}

module.exports = { applyAnswerToSession };
