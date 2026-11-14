import { Buffer } from "node:buffer";

type Environment = {
  CHAT_SESSION_ENABLED?: string;
  APP_ORIGIN?: string;
  AI_ASSISTANT_BACKEND_URL?: string;
  AI_ASSISTANT_BACKEND_TOKEN?: string;
};

type Dependencies = {
  readEnvironment: () => Environment;
  fetch: typeof fetch;
  now?: () => number;
  bodyTimeoutMs?: number;
  upstreamTimeoutMs?: number;
};

const UNAVAILABLE = "Session verification is temporarily unavailable.";
const INVALID = "Invalid session request.";
const SESSION_LIFETIME_CEILING_SECONDS = 14_400;

class SessionError extends Error {
  constructor(readonly status: number, message = UNAVAILABLE) {
    super(message);
  }
}

function failure(status: number, detail = UNAVAILABLE) {
  return Response.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}

export function rejectSessionMethod(request: Request) {
  return new Response(request.method === "HEAD" ? null : JSON.stringify({ detail: "Method not allowed." }), {
    status: 405,
    headers: { "Allow": "POST", "Cache-Control": "no-store", "Content-Type": "application/json" },
  });
}

function originUrl(value: string | undefined, app = false) {
  // Inspect unnormalized input: dot segments, empty queries/fragments,
  // backslashes and credentials must not disappear during URL normalization.
  if (!value || /[\s\\?#]/.test(value) || !/^https?:\/\/[^/?#\s\\]+\/?$/.test(value)) throw new Error();
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== "/") throw new Error();
  const loopback = url.hostname === "localhost" || url.hostname === "[::1]" ||
    /^127\.\d+\.\d+\.\d+$/.test(url.hostname);
  // Cookies stay Secure even locally: use HTTPS for the browser origin.
  if (url.protocol !== "https:" && (app || !loopback)) throw new Error();
  return url;
}

function configuration(environment: Environment) {
  const origin = originUrl(environment.APP_ORIGIN, true).origin;
  const backend = originUrl(environment.AI_ASSISTANT_BACKEND_URL);
  const bearer = environment.AI_ASSISTANT_BACKEND_TOKEN;
  if (!bearer || bearer.length < 43 || bearer.length > 256 || /[^A-Za-z0-9_-]/.test(bearer)) throw new Error();
  return { origin, endpoint: new URL("/internal/verified-sessions", backend).href, bearer };
}

function hasJsonType(headers: Headers) {
  return headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() === "application/json";
}

/** Only a shallow object of JSON strings/integers is needed for these contracts.
 * Parse members before constructing the object, rejecting duplicate decoded keys.
 * JSON.parse is used ONLY for isolated string literals, never for the object.
 * No recursion or nested structures; stream bounds cap all parser work.
 */
export function strictObject(text: string): Record<string, string | number> {
  let position = 0;
  const invalid = () => { throw new Error(); };
  const whitespace = () => {
    while (position < text.length && /[\x20\t\r\n]/.test(text[position])) position++;
  };
  const string = (): string => {
    if (text[position] !== '"') return invalid();
    const start = position++;
    while (position < text.length) {
      const character = text[position++];
      if (character === '"') return JSON.parse(text.slice(start, position));
      if (character === "\\") position++;
      else if (character.charCodeAt(0) < 32) return invalid();
    }
    return invalid();
  };
  whitespace();
  if (text[position++] !== "{") return invalid();
  whitespace();
  const result: Record<string, string | number> = Object.create(null);
  const seen = new Set<string>();
  if (text[position] !== "}") {
    while (true) {
      const name = string();
      if (seen.has(name)) return invalid();
      seen.add(name);
      whitespace();
      if (text[position++] !== ":") return invalid();
      whitespace();
      if (text[position] === '"') result[name] = string();
      else {
        // The backend emits integer Unix seconds, not decimal/exponent forms.
        const number = /^-?(?:0|[1-9][0-9]*)/.exec(text.slice(position));
        if (!number) return invalid();
        position += number[0].length;
        result[name] = Number(number[0]);
      }
      whitespace();
      if (text[position] !== ",") break;
      position++;
      whitespace();
    }
  }
  if (text[position++] !== "}") return invalid();
  whitespace();
  if (position !== text.length) return invalid();
  return result;
}

async function deadline<T>(
  ms: number, parent: AbortSignal, error: SessionError,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (parent.aborted) throw error;
  const controller = new AbortController();
  const abort = () => controller.abort();
  let rejectAbort: () => void;
  const stopped = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(error);
    controller.signal.addEventListener("abort", rejectAbort, { once: true });
  });
  const timer = setTimeout(abort, ms);
  parent.addEventListener("abort", abort, { once: true });
  try {
    return await Promise.race([stopped, operation(controller.signal)]);
  } finally {
    clearTimeout(timer);
    parent.removeEventListener("abort", abort);
    controller.signal.removeEventListener("abort", rejectAbort);
  }
}

async function readObject(
  body: ReadableStream<Uint8Array> | null, headers: Headers, signal: AbortSignal,
  limit: number, invalid: SessionError, oversized: SessionError,
) {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const cancel = () => { void reader?.cancel().catch(() => {}); };
  try {
    const length = headers.get("Content-Length");
    if (length !== null) {
      if (!/^[0-9]{1,20}$/.test(length)) throw invalid;
      if (Number(length) > limit) throw oversized;
    }
    if (!body || signal.aborted) throw invalid;
    reader = body.getReader();
    signal.addEventListener("abort", cancel, { once: true });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (signal.aborted) throw invalid;
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw oversized;
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    // Preserve BOM so the strict JSON parser rejects it rather than hiding it.
    return strictObject(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes));
  } catch (error) {
    if (error instanceof SessionError) throw error;
    throw invalid;
  } finally {
    signal.removeEventListener("abort", cancel);
    cancel(); // Never await cancellation of a stalled stream.
    reader?.releaseLock();
    if (!reader && body) void body.cancel().catch(() => {});
  }
}

export function createSessionGateway(dependencies: Dependencies) {
  return async function handleSession(request: Request): Promise<Response> {
    if (request.method !== "POST") return rejectSessionMethod(request);
    try {
      const environment = dependencies.readEnvironment();
      if (environment.CHAT_SESSION_ENABLED !== "true") return failure(503);
      let config: ReturnType<typeof configuration>;
      try { config = configuration(environment); } catch { return failure(503); }
      const url = new URL(request.url);
      if (request.url.includes("?") || url.hash) return failure(400, INVALID);
      const site = request.headers.get("Sec-Fetch-Site");
      const mode = request.headers.get("Sec-Fetch-Mode");
      const destination = request.headers.get("Sec-Fetch-Dest");
      if (request.headers.get("Origin") !== config.origin ||
        (site !== null && site !== "same-origin") ||
        (mode !== null && mode !== "cors" && mode !== "same-origin") ||
        (destination !== null && destination !== "empty")) return failure(403, "Request not permitted.");
      if (!hasJsonType(request.headers) ||
        ![null, "identity"].includes(request.headers.get("Content-Encoding"))) {
        return failure(415, "Content type not supported.");
      }
      const body = await deadline(
        dependencies.bodyTimeoutMs ?? 5_000, request.signal,
        new SessionError(408, "Request took too long."),
        (signal) => readObject(request.body, request.headers, signal, 4096,
          new SessionError(400, INVALID), new SessionError(413, "Request body too large.")),
      );
      if (Object.keys(body).length !== 1 || typeof body.proof !== "string" ||
        !body.proof.length || body.proof.length > 2048 || /[^!-~]/.test(body.proof)) return failure(400, INVALID);

      try {
        return await deadline(
          dependencies.upstreamTimeoutMs ?? 15_000, request.signal, new SessionError(504),
          async (signal) => {
            const response = await dependencies.fetch(config.endpoint, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${config.bearer}`,
                "Content-Type": "application/json",
                "Accept": "application/json",
              },
              body: JSON.stringify({ proof: body.proof }),
              signal, redirect: "manual", credentials: "omit", cache: "no-store",
            });
            if (response.status !== 201 || !hasJsonType(response.headers) ||
              ![null, "identity"].includes(response.headers.get("Content-Encoding"))) {
              void response.body?.cancel().catch(() => {});
              // Backend 401/404 indicate service configuration failure, not a
              // request for browser credentials. Never relay its error body.
              const status = [400, 403, 409, 413, 415, 422, 429, 503, 504].includes(response.status)
                ? response.status : 502;
              throw new SessionError(status);
            }
            const result = await readObject(response.body, response.headers, signal, 2048,
              new SessionError(502), new SessionError(502));
            const { token, expires_at: expires } = result;
            const nowMs = (dependencies.now ?? Date.now)();
            if (Object.keys(result).length !== 2 || typeof token !== "string" ||
              token.length !== 43 || /[^A-Za-z0-9_-]/.test(token) || token === config.bearer ||
              Buffer.from(token, "base64url").length !== 32 ||
              Buffer.from(token, "base64url").toString("base64url") !== token ||
              !Number.isSafeInteger(expires) || !Number.isSafeInteger(nowMs) ||
              typeof expires !== "number" || expires <= nowMs / 1000 ||
              expires > Math.floor(nowMs / 1000) + SESSION_LIFETIME_CEILING_SECONDS) {
              throw new SessionError(502);
            }
            if (signal.aborted || request.signal.aborted) throw new SessionError(504);
            // Construct only after the entire strict response is validated.
            // Expires is absolute and is never later than backend expiration.
            return Response.json({ status: "ready" }, {
              status: 201,
              headers: {
                "Cache-Control": "no-store",
                "Set-Cookie": `__Host-portfolio-chat=${token}; Secure; HttpOnly; SameSite=Strict; Path=/; Expires=${new Date(expires * 1000).toUTCString()}`,
              },
            });
          },
        );
      } catch (error) {
        if (error instanceof SessionError) throw error;
        throw new SessionError(502);
      }
    } catch (error) {
      if (error instanceof SessionError) return failure(error.status, error.message);
      return failure(503);
    }
  };
}
