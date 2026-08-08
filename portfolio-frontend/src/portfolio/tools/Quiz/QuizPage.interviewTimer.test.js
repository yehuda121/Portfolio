import "../../../i18n";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import QuizPage from "./QuizPage";
import {
  fetchNextQuestion,
  fetchQuizSession,
  startQuizSession,
} from "../../../api/quizApi";

jest.mock("../../../api/client", () => ({
  getQuizAnonId: () => "test-anon-id-12345",
  isApiConfigured: () => true,
  quizHeaders: (id) => ({ "Content-Type": "application/json", "x-anon-id": id }),
}));

jest.mock("../../../api/quizApi", () => ({
  fetchQuizSession: jest.fn(),
  startQuizSession: jest.fn(),
  fetchNextQuestion: jest.fn(),
  submitQuizAnswer: jest.fn(),
  fetchQuizExplanation: jest.fn(),
}));

describe("QuizPage interview timer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchQuizSession.mockResolvedValue({
      ok: true,
      data: { historyScores: [], lastSessionSummary: null },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("initializes timeLeft on the first interview question after start", async () => {
    startQuizSession.mockResolvedValue({
      ok: true,
      data: {
        sessionCurrent: {
          sessionId: "s1",
          mode: "interview",
          timePerQuestion: 60,
          questionIndex: 1,
          correctCount: 0,
        },
      },
    });

    fetchNextQuestion.mockResolvedValue({
      ok: true,
      data: {
        questionId: "q-interview-1",
        questionText: "First interview question?",
        answers: ["A", "B", "C", "D"],
        questionNumber: 1,
        totalQuestions: 10,
        timePerQuestion: 60,
        hasExplanation: false,
      },
    });

    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText("Start Quiz")).toBeInTheDocument();
    });

    const selects = screen.getAllByRole("combobox");
    // category, difficulty, mode
    fireEvent.change(selects[2], { target: { value: "interview" } });

    fireEvent.click(screen.getByText("Start Quiz"));

    await waitFor(() => {
      expect(screen.getByText("First interview question?")).toBeInTheDocument();
    });

    expect(screen.getByText("60s")).toBeInTheDocument();
    expect(startQuizSession).toHaveBeenCalled();
    expect(fetchNextQuestion).toHaveBeenCalled();
  });

  it("does not show a countdown timer in practice mode", async () => {
    startQuizSession.mockResolvedValue({
      ok: true,
      data: {
        sessionCurrent: {
          sessionId: "s2",
          mode: "practice",
          timePerQuestion: null,
          questionIndex: 1,
          correctCount: 0,
        },
      },
    });

    fetchNextQuestion.mockResolvedValue({
      ok: true,
      data: {
        questionId: "q-practice-1",
        questionText: "Practice question?",
        answers: ["A", "B", "C", "D"],
        timePerQuestion: null,
        hasExplanation: false,
      },
    });

    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText("Start Quiz")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Start Quiz"));

    await waitFor(() => {
      expect(screen.getByText("Practice question?")).toBeInTheDocument();
    });

    expect(screen.queryByText(/^\d+s$/)).not.toBeInTheDocument();
  });
});
