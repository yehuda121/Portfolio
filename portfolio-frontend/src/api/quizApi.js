import { apiFetch } from "./client";

export function getQuizAdminToken() {
  return sessionStorage.getItem("quizAdminToken") || "";
}

export function setQuizAdminToken(token) {
  if (token) sessionStorage.setItem("quizAdminToken", token);
  else sessionStorage.removeItem("quizAdminToken");
}

export function quizAdminHeaders() {
  return {
    "Content-Type": "application/json",
    "x-quiz-admin-token": getQuizAdminToken(),
  };
}

/** @type {Set<() => void>} */
const adminUnauthorizedListeners = new Set();

/** Subscribe to admin 401 events (clears UI auth). Returns unsubscribe. */
export function subscribeAdminUnauthorized(listener) {
  if (typeof listener !== "function") return () => {};
  adminUnauthorizedListeners.add(listener);
  return () => {
    adminUnauthorizedListeners.delete(listener);
  };
}

function notifyAdminUnauthorized() {
  adminUnauthorizedListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  });
}

async function adminApiFetch(path, options = {}) {
  const result = await apiFetch(path, options);
  if (result.status === 401) {
    setQuizAdminToken("");
    notifyAdminUnauthorized();
  }
  return result;
}

export async function fetchQuizSession(headers) {
  return apiFetch("/api/quiz/session/current", { headers });
}

export async function startQuizSession(headers, body) {
  return apiFetch("/api/quiz/session/start", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export async function fetchNextQuestion(headers, lang) {
  return apiFetch(`/api/quiz/questions/next?lang=${lang}`, { headers });
}

export async function submitQuizAnswer(headers, body) {
  return apiFetch("/api/quiz/session/answer", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export async function fetchQuizExplanation(headers, body) {
  return apiFetch("/api/quiz/session/explanation", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export async function adminLogin(password) {
  return apiFetch("/api/quiz/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function adminCheckAuth() {
  return adminApiFetch("/api/quiz/admin/me", { headers: quizAdminHeaders() });
}

export async function adminLogout() {
  return adminApiFetch("/api/quiz/admin/logout", {
    method: "POST",
    headers: quizAdminHeaders(),
  });
}

export async function adminListQuestions(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, v);
  });
  const query = qs.toString();
  return adminApiFetch(`/api/quiz/admin/questions${query ? `?${query}` : ""}`, {
    headers: quizAdminHeaders(),
  });
}

export async function adminCreateQuestion(question) {
  return adminApiFetch("/api/quiz/admin/questions", {
    method: "POST",
    headers: quizAdminHeaders(),
    body: JSON.stringify(question),
  });
}

export async function adminUpdateQuestion(questionId, question) {
  return adminApiFetch(`/api/quiz/admin/questions/${encodeURIComponent(questionId)}`, {
    method: "PUT",
    headers: quizAdminHeaders(),
    body: JSON.stringify(question),
  });
}

export async function adminDeleteQuestion(questionId) {
  return adminApiFetch(`/api/quiz/admin/questions/${encodeURIComponent(questionId)}`, {
    method: "DELETE",
    headers: quizAdminHeaders(),
  });
}

export async function adminToggleQuestionActive(questionId) {
  return adminApiFetch(`/api/quiz/admin/questions/${encodeURIComponent(questionId)}/toggle-active`, {
    method: "PATCH",
    headers: quizAdminHeaders(),
  });
}

export async function adminCharacterChat(body) {
  return adminApiFetch("/api/quiz/admin/character-chat", {
    method: "POST",
    headers: quizAdminHeaders(),
    body: JSON.stringify(body),
  });
}
