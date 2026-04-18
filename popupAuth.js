const API_BASE_URL = "http://localhost:3000/api";
const AUTH_STORAGE_KEY = "authSession";

async function parseJson(response) {
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || "Request failed");
  }
  return json;
}

export async function registerUser(email, password) {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  return parseJson(response);
}

export async function loginUser(email, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  return parseJson(response);
}

export async function verifyToken(token) {
  const response = await fetch(`${API_BASE_URL}/auth/verify`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return parseJson(response);
}

export async function saveSession(session) {
  await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: session });
}

export async function getSession() {
  const result = await chrome.storage.local.get([AUTH_STORAGE_KEY]);
  return result[AUTH_STORAGE_KEY] || null;
}

export async function clearSession() {
  await chrome.storage.local.remove([AUTH_STORAGE_KEY]);
}

export { API_BASE_URL };
