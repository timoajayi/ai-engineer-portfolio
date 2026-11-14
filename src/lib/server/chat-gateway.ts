import "server-only";
import { Buffer } from "node:buffer";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { GatewayAssertionSigner, ASSERTION_PATH } from "./gateway-assertions";
import { strictObject } from "./session-gateway";
import { TrustedVisitorIdentityProvider } from "./visitor-identity";

export type ChatEnvironment = {
  CHAT_ENABLED?: string;
  APP_ORIGIN?: string;
  AI_ASSISTANT_BACKEND_URL?: string;
  AI_ASSISTANT_CHAT_TOKEN?: string;
  AI_ASSISTANT_BACKEND_TOKEN?: string; // issuance/old credential: comparison only, NEVER fallback
  GATEWAY_ASSERTION_ISSUER?: string;
  GATEWAY_ASSERTION_AUDIENCE?: string;
  GATEWAY_ASSERTION_KEY_ID?: string;
  GATEWAY_ASSERTION_KEY?: string; // canonical base64url, 32–64 independent random bytes
  GATEWAY_ASSERTION_KEY_NOT_BEFORE?: string;
  GATEWAY_ASSERTION_KEY_NOT_AFTER?: string;
  GATEWAY_INGRESS_POLICY?: string;
};
type Dependencies = {
  readEnvironment: () => ChatEnvironment;
  fetch: typeof fetch;
  identityProvider?: TrustedVisitorIdentityProvider;
  now?: () => number; // integer UTC milliseconds, used only for assertion timestamps
  bodyTimeoutMs?: number;
  upstreamTimeoutMs?: number;
  totalTimeoutMs?: number;
};
const BODY_LIMIT = 8192;
const RESPONSE_LIMIT = 65536;
const COOKIE_NAME = "__Host-portfolio-chat";
const UNAVAILABLE = "The AI assistant is temporarily unavailable.";
const BAD_REQUEST = "Invalid chat request.";
const UPSTREAM_FAILURE = "The AI assistant could not generate a response.";
class GatewayError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
function json(status: number, detail: string) {
  return Response.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}
export function rejectChatMethod(request: Request) {
  return new Response(request.method === "HEAD" ? null : JSON.stringify({ detail: "Method not allowed." }), {
    status: 405, headers: { "Allow": "POST", "Cache-Control": "no-store", "Content-Type": "application/json" },
  });
}
function exact(value: unknown, regex: RegExp): value is string {
  return typeof value === "string" && regex.exec(value)?.[0] === value;
}
function bearer(value: unknown): value is string { return exact(value, /^[A-Za-z0-9_-]{43,256}$/); }
function originUrl(value: string | undefined, browser = false): URL {
  if (!value || /[\s\\?#]/.test(value) || !/^https?:\/\/[^/?#\s\\]+\/?$/.test(value)) throw new Error();
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== "/") throw new Error();
  const loopback = url.hostname === "localhost" || url.hostname === "[::1]" || /^127\.\d+\.\d+\.\d+$/.test(url.hostname);
  if (url.protocol !== "https:" && (browser || !loopback)) throw new Error();
  return url;
}
function timestamp(value: unknown): number {
  if (!exact(value, /^(?:0|[1-9][0-9]{0,11})$/)) throw new Error();
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > 253402300799) throw new Error();
  return number;
}
function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function configuration(environment: ChatEnvironment, dependencies: Dependencies) {
  const origin = originUrl(environment.APP_ORIGIN, true).origin;
  const endpoint = new URL(ASSERTION_PATH, originUrl(environment.AI_ASSISTANT_BACKEND_URL)).href;
  const token = environment.AI_ASSISTANT_CHAT_TOKEN;
  if (!bearer(token) || (environment.AI_ASSISTANT_BACKEND_TOKEN && sameSecret(token, environment.AI_ASSISTANT_BACKEND_TOKEN))) throw new Error();
  const encoded = environment.GATEWAY_ASSERTION_KEY;
  if (!exact(encoded, /^[A-Za-z0-9_-]{43,86}$/)) throw new Error();
  const key = Buffer.from(encoded, "base64url");
  if (key.length < 32 || key.length > 64 || key.toString("base64url") !== encoded || sameSecret(encoded, token) ||
    (environment.AI_ASSISTANT_BACKEND_TOKEN && sameSecret(encoded, environment.AI_ASSISTANT_BACKEND_TOKEN))) throw new Error();
  const seconds = () => {
    const milliseconds = (dependencies.now ?? Date.now)();
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) throw new Error();
    return Math.floor(milliseconds / 1000);
  };
  const signer = new GatewayAssertionSigner({
    issuer: environment.GATEWAY_ASSERTION_ISSUER,
    audience: environment.GATEWAY_ASSERTION_AUDIENCE,
    ipSource: environment.GATEWAY_INGRESS_POLICY,
    currentKey: { kid: environment.GATEWAY_ASSERTION_KEY_ID, secret: key,
      notBefore: timestamp(environment.GATEWAY_ASSERTION_KEY_NOT_BEFORE),
      notAfter: timestamp(environment.GATEWAY_ASSERTION_KEY_NOT_AFTER) },
    lifetimeSeconds: 30,
  }, { now: seconds });
  return { origin, endpoint, token, signer, policy: environment.GATEWAY_INGRESS_POLICY, encodedKey: encoded };
}
function isJson(headers: Headers): boolean {
  return /^application\/json(?:[ \t]*;[ \t]*charset=(?:utf-8|"utf-8"))?$/i.test(headers.get("Content-Type") ?? "");
}
function sessionCookie(headers: Headers, config: ReturnType<typeof configuration>): string {
  const cookie = headers.get("Cookie");
  if (!cookie || cookie.length > 4096 || /[^\x20-\x7e\t]/.test(cookie)) throw new GatewayError(401, UNAVAILABLE);
  const values: string[] = [];
  for (const part of cookie.split(";")) {
    const pair = part.replace(/^[ \t]+|[ \t]+$/g, "");
    const equals = pair.indexOf("=");
    if (equals < 1 || !exact(pair.slice(0, equals), /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/) ||
      /[^\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]/.test(pair.slice(equals + 1))) throw new GatewayError(401, UNAVAILABLE);
    if (pair.slice(0, equals) === COOKIE_NAME) values.push(pair.slice(equals + 1));
  }
  if (values.length !== 1 || !exact(values[0], /^[A-Za-z0-9_-]{43}$/) ||
    Buffer.from(values[0], "base64url").length !== 32 || Buffer.from(values[0], "base64url").toString("base64url") !== values[0] ||
    sameSecret(values[0], config.token) || sameSecret(values[0], config.encodedKey)) throw new GatewayError(401, UNAVAILABLE);
  return values[0];
}
function requestHeaders(request: Request) {
  let size = 0, count = 0;
  for (const [name, value] of request.headers) { size += name.length + value.length; count++; }
  if (size > 8192 || count > 32) throw new GatewayError(400, BAD_REQUEST);
  for (const name of ["authorization", "proxy-authorization", "x-portfolio-session", "x-portfolio-gateway-assertion",
    "x-forwarded-for", "x-real-ip", "cf-connecting-ip", "forwarded", "x-portfolio-client-ip", "x-user-id", "x-credential-id"]) {
    if (request.headers.has(name)) throw new GatewayError(403, "Request not permitted.");
  }
  if (request.headers.has("Transfer-Encoding") || request.headers.has("Trailer")) throw new GatewayError(400, BAD_REQUEST);
}
async function withDeadline<T>(
  milliseconds: number, parent: AbortSignal, failure: GatewayError | (() => GatewayError),
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const error = () => typeof failure === "function" ? failure() : failure;
  if (parent.aborted || milliseconds <= 0) throw error();
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, milliseconds);
  let onAbort: () => void;
  const stopped = new Promise<never>((_, reject) => {
    onAbort = () => reject(error());
    controller.signal.addEventListener("abort", onAbort, { once: true });
  });
  parent.addEventListener("abort", abort, { once: true });
  try { return await Promise.race([stopped, operation(controller.signal)]); }
  finally {
    clearTimeout(timeout); parent.removeEventListener("abort", abort);
    controller.signal.removeEventListener("abort", onAbort);
  }
}
async function readJson(
  body: ReadableStream<Uint8Array> | null, headers: Headers, limit: number, signal: AbortSignal,
  invalid: GatewayError, oversized: GatewayError,
) {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const cancel = () => { void reader?.cancel().catch(() => {}); };
  try {
    const length = headers.get("Content-Length");
    if (length !== null) {
      if (!exact(length, /^[0-9]+$/)) throw invalid;
      if (Number(length) > limit) throw oversized;
      if (!exact(length, /^(?:0|[1-9][0-9]{0,19})$/)) throw invalid;
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
    if (length !== null && Number(length) !== size) throw invalid;
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return strictObject(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes));
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    throw invalid;
  } finally {
    signal.removeEventListener("abort", cancel); cancel();
    reader?.releaseLock();
    if (!reader && body) void body.cancel().catch(() => {});
  }
}
function messageFrom(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    Object.keys(value).length !== 1 || !("message" in value) ||
    typeof value.message !== "string") throw new GatewayError(400, BAD_REQUEST);
  // Python/Pydantic counts Unicode code points, rather than UTF-16 code units.
  // Check before trimming, matching the backend's Field validation order.
  if (Array.from(value.message).length > 1000) throw new GatewayError(400, BAD_REQUEST);
  // Match Python str.strip(), including its ASCII information separators.
  const message = value.message.replace(
    /^[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/gu,
    "",
  );
  if (Buffer.from(message, "utf8").toString("utf8") !== message) throw new GatewayError(400, BAD_REQUEST);
  if (!message) throw new GatewayError(400, BAD_REQUEST);
  return message;
}


export function createChatGateway(dependencies: Dependencies) {
  return async function handleChat(request: Request): Promise<Response> {
    const started = performance.now();
    if (request.method !== "POST") return rejectChatMethod(request);
    let config: ReturnType<typeof configuration> | undefined;
    try {
      const environment = dependencies.readEnvironment();
      if (environment.CHAT_ENABLED !== "true") return json(503, UNAVAILABLE);
      try { config = configuration(environment, dependencies); } catch { return json(503, UNAVAILABLE); }
      // Only trusted composition can inject this provider. The real route has
      // none: enabling an environment flag cannot invent ingress provenance.
      const provider = dependencies.identityProvider;
      if (!(provider instanceof TrustedVisitorIdentityProvider)) return json(503, UNAVAILABLE);
      const uploadMs = dependencies.bodyTimeoutMs ?? 5000;
      const upstreamMs = dependencies.upstreamTimeoutMs ?? 45000;
      const totalMs = dependencies.totalTimeoutMs ?? uploadMs + upstreamMs;
      if (![uploadMs, upstreamMs, totalMs].every((v) => Number.isInteger(v) && v > 0) ||
        uploadMs > 5000 || upstreamMs > 45000 || totalMs > 50000) return json(503, UNAVAILABLE);
      const url = new URL(request.url);
      if (request.url.includes("?") || url.hash || url.pathname !== "/api/chat") return json(400, BAD_REQUEST);
      const site = request.headers.get("Sec-Fetch-Site"), mode = request.headers.get("Sec-Fetch-Mode"), dest = request.headers.get("Sec-Fetch-Dest");
      if (url.origin !== config.origin || request.headers.get("Origin") !== config.origin ||
        (site !== null && site !== "same-origin") || (mode !== null && mode !== "cors" && mode !== "same-origin") ||
        (dest !== null && dest !== "empty")) return json(403, "Request not permitted.");
      requestHeaders(request);
      if (!isJson(request.headers) || ![null, "identity"].includes(request.headers.get("Content-Encoding"))) {
        return json(415, "Content type not supported.");
      }
      const session = sessionCookie(request.headers, config);
      let stage = "body";
      const failure = () => new GatewayError(request.signal.aborted && stage === "body" ? 408 : 504, UPSTREAM_FAILURE);
      const remaining = () => Math.max(0, started + totalMs - performance.now());
      return await withDeadline(remaining(), request.signal, failure, async (overallSignal) => {
        const data = await withDeadline(Math.min(uploadMs, remaining()), overallSignal,
          new GatewayError(408, "Request took too long."), (signal) => readJson(request.body, request.headers, BODY_LIMIT, signal,
            new GatewayError(400, BAD_REQUEST), new GatewayError(413, "Request body too large.")));
        const message = messageFrom(data);
        if (overallSignal.aborted || remaining() <= 0) throw failure();
        stage = "identity";
        const bytes = Buffer.from(JSON.stringify({ message }), "utf8");
        const context = Object.freeze({ requestId: randomUUID(), origin: config.origin, method: "POST" as const,
          path: "/api/chat" as const, sessionSHA256: createHash("sha256").update(session, "ascii").digest("hex"),
          bodySHA256: createHash("sha256").update(bytes).digest("hex") });
        let identity;
        try { identity = await TrustedVisitorIdentityProvider.prototype.authorizedIdentity.call(provider, context, config.policy); }
        catch { throw new GatewayError(503, UNAVAILABLE); }
        if (overallSignal.aborted || remaining() <= 0) throw failure();
        const assertion = config.signer.sign({ method: "POST", path: ASSERTION_PATH,
          sessionToken: session, body: bytes, visitorIP: identity.visitorIP });
        if (overallSignal.aborted || remaining() <= 0) throw failure();
        stage = "upstream";
        try {
          return await withDeadline(Math.min(upstreamMs, remaining()), overallSignal,
            new GatewayError(504, UPSTREAM_FAILURE), async (signal) => {
              const response = await dependencies.fetch(config.endpoint, {
                method: "POST", headers: { "Authorization": `Bearer ${config.token}`, "Content-Type": "application/json",
                  "X-Portfolio-Session": session, "X-Portfolio-Gateway-Assertion": assertion },
                body: bytes, signal, redirect: "manual", credentials: "omit", cache: "no-store",
              });
              if (signal.aborted || response.status !== 200 || !isJson(response.headers) ||
                ![null, "identity"].includes(response.headers.get("Content-Encoding"))) {
                void response.body?.cancel().catch(() => {});
                const status = signal.aborted || response.status === 504 ? 504 : [429, 503].includes(response.status) ? 503 : 502;
                throw new GatewayError(status, UPSTREAM_FAILURE);
              }
              const result = await readJson(response.body, response.headers, RESPONSE_LIMIT, signal,
                new GatewayError(502, UPSTREAM_FAILURE), new GatewayError(502, UPSTREAM_FAILURE));
              if (Object.keys(result).length !== 1 || typeof result.answer !== "string" || !result.answer.trim() ||
                Buffer.from(result.answer, "utf8").toString("utf8") !== result.answer || signal.aborted || overallSignal.aborted) {
                throw new GatewayError(502, UPSTREAM_FAILURE);
              }
              for (const secret of [session, config.token, config.encodedKey, assertion, environment.AI_ASSISTANT_BACKEND_TOKEN]) {
                if (typeof secret === "string" && secret.length && result.answer.includes(secret)) throw new GatewayError(502, UPSTREAM_FAILURE);
              }
              if (remaining() <= 0) throw new GatewayError(504, UPSTREAM_FAILURE);
              const browserResponse = Response.json({ answer: result.answer }, { headers: { "Cache-Control": "no-store" } });
              if (remaining() <= 0) throw new GatewayError(504, UPSTREAM_FAILURE);
              return browserResponse;
            });
        } catch (error) {
          if (error instanceof GatewayError) throw error;
          throw new GatewayError(502, UPSTREAM_FAILURE);
        }
      });
    } catch (error) {
      if (error instanceof GatewayError) return json(error.status, error.message);
      return json(503, UNAVAILABLE);
    } finally { config?.signer.destroy(); }
  };
}
