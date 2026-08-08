const BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

export function isApiConfigured() {
  return Boolean(BASE_URL);
}

export async function apiFetch(path, options = {}) {
  if (!BASE_URL) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: "api_not_configured",
    };
  }

  const url = `${BASE_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, { ...options, headers });
    const text = await response.text();
    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      error: response.ok ? null : data?.error || "request_failed",
    };
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      error: "network_error",
    };
  }
}

export function getQuizAnonId() {
  let id = localStorage.getItem("quizAnonId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("quizAnonId", id);
  }
  return id;
}

export function quizHeaders(anonId) {
  return {
    "Content-Type": "application/json",
    "x-anon-id": anonId,
  };
}
