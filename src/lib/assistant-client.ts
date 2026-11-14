/** Browser transport only. No backend URLs, credentials or session-token access. */
export class AssistantRequestError extends Error {
  constructor(readonly status: number) {
    super(status === 429 ? "The assistant has reached its request limit. Please try again later."
      : status === 504 ? "The assistant took too long to respond. Please try again."
      : status === 401 || status === 403 ? "Please complete verification again before sending a message."
      : status === 503 ? "The AI Portfolio Assistant is temporarily unavailable."
      : "I couldn't reach the AI Portfolio Assistant. Please try again.");
  }
}

async function post(path: "/api/chat" | "/api/chat/session", body: object, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, {
    method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal,
  });
  if (!response.ok) throw new AssistantRequestError(response.status);
  return response.json();
}

export async function requestVerifiedSession(proof: string, signal: AbortSignal) {
  if (!proof || proof.length > 2048 || /[^!-~]/.test(proof)) throw new AssistantRequestError(403);
  const value = await post("/api/chat/session", { proof }, signal);
  if (!value || typeof value !== "object" || Object.keys(value).length !== 1 ||
    !("status" in value) || value.status !== "ready") throw new AssistantRequestError(502);
}

export async function requestAssistantAnswer(message: string, signal: AbortSignal): Promise<string> {
  const value = await post("/api/chat", { message }, signal);
  if (!value || typeof value !== "object" || Object.keys(value).length !== 1 ||
    !("answer" in value) || typeof value.answer !== "string" || !value.answer.trim()) {
    throw new AssistantRequestError(502);
  }
  return value.answer;
}
