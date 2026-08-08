import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./QuizPage.css";
import { useTranslation } from "react-i18next";
import { getQuizAnonId, isApiConfigured, quizHeaders } from "../../../api/client";
import {
  fetchNextQuestion,
  fetchQuizExplanation,
  fetchQuizSession,
  startQuizSession,
  submitQuizAnswer,
} from "../../../api/quizApi";
import InlineAlert from "../../../components/ui/InlineAlert/InlineAlert";
import LoadingSpinner from "../../../components/ui/LoadingSpinner/LoadingSpinner";

const TIME_OPTIONS = [30, 60, 90, 120];

const QuizPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("he") ? "he" : "en";
  const isRtl = lang === "he";

  const [anonId, setAnonId] = useState(null);
  const [category, setCategory] = useState("oop");
  const [difficulty, setDifficulty] = useState("junior");
  const [mode, setMode] = useState("practice");
  const [timePerQuestion, setTimePerQuestion] = useState(60);

  const [session, setSession] = useState(null);
  const [historyScores, setHistoryScores] = useState([]);
  const [question, setQuestion] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [summary, setSummary] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const timerRef = useRef(null);
  const timeoutSubmittedRef = useRef(false);

  useEffect(() => {
    setAnonId(getQuizAnonId());
  }, []);

  const headers = useMemo(() => (anonId ? quizHeaders(anonId) : null), [anonId]);

  const resolveApiError = useCallback((fallbackKey, result) => {
    if (!isApiConfigured()) return t("Quiz.errors.apiNotConfigured");
    if (result?.error === "aws_not_configured") return t("Quiz.errors.awsNotConfigured");
    if (result?.error === "admin_not_configured") return t("Quiz.admin.errors.notConfigured");
    return t(fallbackKey);
  }, [t]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimeLeft(null);
  }, []);

  const loadSession = useCallback(async () => {
    if (!headers) return;

    setHistoryLoading(true);
    setError(null);

    const result = await fetchQuizSession(headers);

    if (!result.ok || !result.data) {
      setError(resolveApiError("Quiz.errors.sessionLoadFailed", result));
      setHistoryLoading(false);
      return;
    }

    setHistoryScores(Array.isArray(result.data.historyScores) ? result.data.historyScores : []);
    if (result.data.lastSessionSummary) {
      setSummary(result.data.lastSessionSummary);
    }
    setHistoryLoading(false);
  }, [headers, resolveApiError]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const loadNextQuestion = useCallback(async () => {
    if (!headers) return;

    clearTimer();
    setLoading(true);
    setError(null);
    setInfo(null);
    setSelectedIndex(null);
    setAnswerResult(null);
    setExplanation(null);
    setShowExplanation(false);
    timeoutSubmittedRef.current = false;

    const result = await fetchNextQuestion(headers, lang);

    if (!result.ok || !result.data) {
      setQuestion(null);
      const messageKey =
        result?.error === "no_more_questions_for_session"
          ? "Quiz.errors.noQuestionsForSelection"
          : "Quiz.errors.noMoreQuestions";
      setError(resolveApiError(messageKey, result));
      if (result?.error === "no_more_questions_for_session") {
        setSession(null);
      }
      setLoading(false);
      return;
    }

    if (result.data.reshuffled) {
      setInfo(t("Quiz.reshuffled"));
    }

    setQuestion(result.data);
    setLoading(false);

    // Use /next payload only — do not read React session state (stale after setSession).
    // Backend sets timePerQuestion for interview; practice returns null.
    if (result.data.timePerQuestion) {
      setTimeLeft(result.data.timePerQuestion);
    }
  }, [headers, lang, resolveApiError, clearTimer, t]);

  useEffect(() => {
    if (session?.mode !== "interview" || selectedIndex !== null || !question?.questionId) {
      return undefined;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return prev;
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [session?.mode, selectedIndex, question?.questionId]);

  const handleTimeout = useCallback(async () => {
    if (!headers || !question || timeoutSubmittedRef.current) return;
    timeoutSubmittedRef.current = true;
    setSelectedIndex(-1);
    setLoading(true);
    setError(null);

    const result = await submitQuizAnswer(headers, {
      questionId: question.questionId,
      timedOut: true,
      lang,
    });

    if (!result.ok || !result.data) {
      setError(resolveApiError("Quiz.errors.answerFailed", result));
      setLoading(false);
      return;
    }

    const data = result.data;
    setAnswerResult(data);

    if (data.finished) {
      clearTimer();
      setSession(null);
      setSummary(data.summary || null);
      setHistoryScores(Array.isArray(data.historyScores) ? data.historyScores : []);
      setQuestion(null);
    } else {
      setSession(data.sessionCurrent || session);
      setTimeout(() => loadNextQuestion(), 1200);
    }

    setLoading(false);
  }, [headers, question, lang, resolveApiError, session, clearTimer, loadNextQuestion]);

  useEffect(() => {
    if (timeLeft === 0 && session?.mode === "interview" && selectedIndex === null) {
      handleTimeout();
    }
  }, [timeLeft, session?.mode, selectedIndex, handleTimeout]);

  const startSession = async () => {
    if (!headers) return;

    clearTimer();
    setLoading(true);
    setError(null);
    setInfo(null);
    setQuestion(null);
    setSelectedIndex(null);
    setAnswerResult(null);
    setExplanation(null);
    setShowExplanation(false);
    setSummary(null);

    const body = { category, difficulty, mode };
    if (mode === "interview") body.timePerQuestion = timePerQuestion;

    const result = await startQuizSession(headers, body);

    if (!result.ok || !result.data?.sessionCurrent) {
      setError(resolveApiError("Quiz.errors.startFailed", result));
      setLoading(false);
      return;
    }

    setSession(result.data.sessionCurrent);
    await loadNextQuestion();
  };

  const startOver = async () => {
    await startSession();
  };

  const submitAnswer = async (index) => {
    if (!headers || !question || selectedIndex !== null) return;

    clearTimer();
    setSelectedIndex(index);
    setLoading(true);
    setError(null);

    const result = await submitQuizAnswer(headers, {
      questionId: question.questionId,
      selectedIndex: index,
      lang,
    });

    if (!result.ok || !result.data) {
      setError(resolveApiError("Quiz.errors.answerFailed", result));
      setLoading(false);
      return;
    }

    const data = result.data;
    setAnswerResult(data);

    if (data.mode === "practice") {
      if (data.autoShowExplanation && data.explanation) {
        setExplanation(data.explanation);
        setShowExplanation(true);
      }
    }

    if (data.finished) {
      setSession(null);
      setSummary(data.summary || null);
      setHistoryScores(Array.isArray(data.historyScores) ? data.historyScores : []);
      setQuestion(null);
    } else if (data.mode === "interview") {
      setSession(data.sessionCurrent || session);
      setTimeout(() => loadNextQuestion(), 1200);
    } else {
      setSession(data.sessionCurrent || session);
    }

    setLoading(false);
  };

  const revealExplanation = async () => {
    if (!headers || !question || loadingExplanation) return;

    setLoadingExplanation(true);
    const result = await fetchQuizExplanation(headers, {
      questionId: question.questionId,
      lang,
    });
    setLoadingExplanation(false);

    if (!result.ok || !result.data) {
      setError(resolveApiError("Quiz.errors.explanationFailed", result));
      return;
    }

    setExplanation(result.data.explanation);
    setShowExplanation(true);
  };

  const getAnswerClass = (i) => {
    let cls = "quiz-answer-btn";
    if (selectedIndex === null) return cls;

    const correct = answerResult?.correctIndex;
    if (typeof correct === "number" && i === correct) return `${cls} quiz-answer-correct`;
    if (i === selectedIndex && i !== correct) return `${cls} quiz-answer-wrong`;
    return cls;
  };

  const canContinue = !!session;
  const showQuestion = !!session && !!question;
  const isInterview = session?.mode === "interview";
  const isPractice = session?.mode === "practice";
  const timerPercent =
    isInterview && question?.timePerQuestion && timeLeft !== null
      ? Math.max(0, (timeLeft / question.timePerQuestion) * 100)
      : 0;

  const dismissSummary = () => {
    setSummary(null);
  };

  const endQuiz = () => {
    clearTimer();
    setSession(null);
    setQuestion(null);
    setSelectedIndex(null);
    setAnswerResult(null);
    setExplanation(null);
    setShowExplanation(false);
    setSummary(null);
    setError(null);
    setInfo(null);
    setLoading(false);
  };

  const displayQuestion = useMemo(() => {
    if (!question) return null;
    const textMap = question.questionTextI18n;
    const answersMap = question.answersI18n;
    return {
      ...question,
      questionText: textMap?.[lang] ?? question.questionText,
      answers: answersMap?.[lang] ?? question.answers,
    };
  }, [question, lang]);

  useEffect(() => {
    // After an answer, re-fetch explanation in the active language (never from /next payload)
    if (!headers || !question?.questionId || selectedIndex === null) return;
    const shouldShow =
      showExplanation ||
      (answerResult?.autoShowExplanation);
    if (!shouldShow) return;

    let cancelled = false;
    (async () => {
      const result = await fetchQuizExplanation(headers, {
        questionId: question.questionId,
        lang,
      });
      if (cancelled || !result.ok || !result.data) return;
      setExplanation(result.data.explanation);
    })();

    return () => {
      cancelled = true;
    };
  }, [lang, question?.questionId, showExplanation, selectedIndex, answerResult?.autoShowExplanation, headers]);

  return (
    <div className="quiz-page" dir={isRtl ? "rtl" : "ltr"}>
      <div className="quiz-header">
        <div className="quiz-title">{t("Quiz.title")}</div>
        <div className="quiz-subtitle">{t("Quiz.subtitle")}</div>
      </div>

      <div className="quiz-card">
        <div className="quiz-controls">
          <select className="quiz-select" value={category} onChange={(e) => setCategory(e.target.value)} disabled={loading || canContinue}>
            <option value="oop">{t("Quiz.categoryOOP")}</option>
            <option value="data_structures">{t("Quiz.categoryDataStructures")}</option>
            <option value="algorithms">{t("Quiz.categoryAlgorithms")}</option>
          </select>

          <select className="quiz-select" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} disabled={loading || canContinue}>
            <option value="junior">{t("Quiz.junior")}</option>
            <option value="mid">{t("Quiz.mid")}</option>
            <option value="senior">{t("Quiz.senior")}</option>
          </select>

          <select className="quiz-select" value={mode} onChange={(e) => setMode(e.target.value)} disabled={loading || canContinue}>
            <option value="practice">{t("Quiz.practice")}</option>
            <option value="interview">{t("Quiz.interview")}</option>
          </select>

          {mode === "interview" && !canContinue && (
            <select
              className="quiz-select"
              value={timePerQuestion}
              onChange={(e) => setTimePerQuestion(Number(e.target.value))}
              disabled={loading}
            >
              {TIME_OPTIONS.map((s) => (
                <option key={s} value={s}>{t(`Quiz.seconds${s}`)}</option>
              ))}
            </select>
          )}

          {!canContinue ? (
            <button className="quiz-start-btn" onClick={startSession} disabled={loading || !anonId}>
              {t("Quiz.start")}
            </button>
          ) : (
            <>
              {isPractice && (
                <button className="quiz-start-btn" onClick={loadNextQuestion} disabled={loading || !anonId || selectedIndex === null}>
                  {t("Quiz.next")}
                </button>
              )}
              <button className="quiz-next-btn" onClick={startOver} disabled={loading || !anonId} title={t("Quiz.startOver")}>
                {t("Quiz.startOver")}
              </button>
              <button className="quiz-end-btn" onClick={endQuiz} disabled={loading}>
                {t("Quiz.endQuiz")}
              </button>
            </>
          )}
        </div>

        {error && <InlineAlert type="error" message={error} />}
        {info && <InlineAlert type="info" message={info} />}

        {loading && session && !showQuestion && !summary && (
          <LoadingSpinner label={t("Quiz.loading")} />
        )}

        {!session && !showQuestion && !summary && !loading && (
          <div className="quiz-empty-state">
            <div className="quiz-empty-title">{t("Quiz.emptyStateTitle")}</div>
            <div className="quiz-empty-text">{t("Quiz.emptyState")}</div>
          </div>
        )}

        {summary && (
          <div className="quiz-summary">
            <h3 className="quiz-summary-title">{t("Quiz.summary.title")}</h3>
            <div className="quiz-summary-stats">
              <span>{t("Quiz.summary.score")}: {summary.scorePercent}%</span>
              <span>{t("Quiz.summary.correct")}: {summary.correctCount}</span>
              <span>{t("Quiz.summary.wrong")}: {summary.wrongCount}</span>
              <span>{t("Quiz.summary.timedOut")}: {summary.timeoutCount}</span>
            </div>
            {summary.wrongAnswers?.length > 0 && (
              <div className="quiz-summary-wrong-list">
                <h4>{t("Quiz.summary.reviewTitle")}</h4>
                {summary.wrongAnswers.map((item) => (
                  <div key={item.questionId} className="quiz-summary-item">
                    <div className="quiz-summary-question">{item.questionText}</div>
                    <div className="quiz-summary-meta">
                      {item.timedOut
                        ? t("Quiz.summary.timedOutLabel")
                        : t("Quiz.summary.yourAnswer", {
                            answer: item.selectedIndex !== null ? item.answers?.[item.selectedIndex] : "—",
                          })}
                    </div>
                    <div className="quiz-summary-correct">
                      {t("Quiz.summary.correctAnswer")}: {item.answers?.[item.correctIndex]}
                    </div>
                    {item.explanation && (
                      <div className="quiz-explanation">{item.explanation}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button className="quiz-start-btn" onClick={dismissSummary}>{t("Quiz.summary.dismiss")}</button>
          </div>
        )}

        {showQuestion && (
          <div className="quiz-question-wrapper">
            <div className="quiz-progress-row">
              <div className="quiz-progress">
                {isInterview ? (
                  <>
                    {t("Quiz.question")} {question.questionNumber}/{question.totalQuestions}
                    <span> · </span>
                    {t("Quiz.correctSoFar")} {session.correctCount}
                  </>
                ) : (
                  <>
                    {t("Quiz.question")} {session.questionIndex}
                    <span> · </span>
                    {t("Quiz.correctSoFar")} {session.correctCount}
                  </>
                )}
              </div>
              {isInterview && timeLeft !== null && (
                <div className={`quiz-timer ${timeLeft <= 10 ? "quiz-timer-urgent" : ""}`}>
                  <div className="quiz-timer-bar" style={{ width: `${timerPercent}%` }} />
                  <span className="quiz-timer-text">{timeLeft}s</span>
                </div>
              )}
            </div>

            <div className="quiz-question-text">{displayQuestion.questionText}</div>

            <div className="quiz-answers" dir={isRtl ? "rtl" : "ltr"}>
              {displayQuestion.answers.map((ans, i) => (
                <button
                  key={i}
                  className={getAnswerClass(i)}
                  onClick={() => submitAnswer(i)}
                  disabled={loading || selectedIndex !== null}
                >
                  {ans}
                </button>
              ))}
            </div>

            {selectedIndex !== null && answerResult?.isCorrect && isPractice && (
              <InlineAlert type="success" message={t("Quiz.correctAnswer")} />
            )}

            {selectedIndex !== null && !answerResult?.isCorrect && !answerResult?.timedOut && (
              <InlineAlert type="error" message={t("Quiz.incorrectAnswer")} />
            )}

            {selectedIndex !== null && answerResult?.timedOut && (
              <InlineAlert type="warning" message={t("Quiz.timeUp")} />
            )}

            {isPractice && selectedIndex !== null && answerResult?.isCorrect && answerResult?.hasExplanation && !showExplanation && (
              <button className="quiz-next-btn" onClick={revealExplanation} disabled={loadingExplanation}>
                {loadingExplanation ? t("Quiz.loading") : t("Quiz.showExplanation")}
              </button>
            )}

            {isPractice && showExplanation && explanation && (
              <div className="quiz-explanation">{explanation}</div>
            )}
          </div>
        )}
      </div>

      <div className="quiz-history-card">
        <div className="quiz-history-title">{t("Quiz.progress")}</div>

        {historyLoading ? (
          <LoadingSpinner label={t("Quiz.loading")} />
        ) : historyScores.length === 0 ? (
          <div className="quiz-subtitle">{t("Quiz.noHistory")}</div>
        ) : (
          <div className="quiz-graph">
            {historyScores.map((score, i) => (
              <div
                key={i}
                className="quiz-bar"
                style={{ height: `${Math.max(2, Math.min(100, score))}%` }}
                title={`${score}%`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizPage;
