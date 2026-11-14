import assert from "node:assert/strict";
import { test } from "node:test";

import { Buffer } from "node:buffer";
import { loadGatewayModules } from "./helpers/chat-gateway-loader.mjs";
const modules = loadGatewayModules();
const gateway = modules.gateway;
const NOW = 1_800_000_000_123;
const SESSION = Buffer.alloc(32, 17).toString("base64url");
const COOKIE = `__Host-portfolio-chat=${SESSION}`;
class FixtureProvider extends modules.identity.TrustedVisitorIdentityProvider {
  constructor() { super("offline-ingress-v1"); }
  async resolveEvidence(context) {
    return { visitorIP: "192.0.2.42", ingressPolicy: "offline-ingress-v1",
      requestId: context.requestId, evidenceId: "offline-fixture-not-production" };
  }
}
const TOKEN = "offline-server-token-" + "a".repeat(43);
const MARKER = "private-upstream-error-marker";
const environment = {
  CHAT_ENABLED: "true",
  APP_ORIGIN: "https://portfolio.example.test",
  AI_ASSISTANT_BACKEND_URL: "https://backend.example.test",
  AI_ASSISTANT_CHAT_TOKEN: TOKEN,
  GATEWAY_ASSERTION_ISSUER: "portfolio-gateway",
  GATEWAY_ASSERTION_AUDIENCE: "portfolio-backend",
  GATEWAY_ASSERTION_KEY_ID: "gateway-key-1",
  GATEWAY_ASSERTION_KEY: Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1)).toString("base64url"),
  GATEWAY_ASSERTION_KEY_NOT_BEFORE: "1799999900",
  GATEWAY_ASSERTION_KEY_NOT_AFTER: "1800003600",
  GATEWAY_INGRESS_POLICY: "offline-ingress-v1",
};
const encoder = new TextEncoder();

function request(body = { message: "What is BundesHost?" }, headers = {}) {
  return new Request("https://portfolio.example.test/api/chat", {
    method: "POST",
    headers: { Origin: environment.APP_ORIGIN, Cookie: COOKIE, "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function streamRequest(stream, headers = {}, signal) {
  return new Request("https://portfolio.example.test/api/chat", {
    method: "POST",
    headers: { Origin: environment.APP_ORIGIN, Cookie: COOKIE, "Content-Type": "application/json", ...headers },
    body: stream, duplex: "half", signal,
  });
}

function harness(options = {}) {
  const calls = [];
  const handle = gateway.createChatGateway({
    readEnvironment: () => ({ ...environment, ...options.environment }),
    fetch: async (...args) => {
      calls.push(args);
      if (options.fetch) return options.fetch(...args);
      return Response.json({ answer: "A tourism forecasting project." });
    },
    identityProvider: new FixtureProvider(),
    now: () => NOW,
    bodyTimeoutMs: 30,
    upstreamTimeoutMs: 30,
  });
  return { handle, calls };
}

async function check(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const text = await response.text();
  for (const secret of [TOKEN, SESSION, MARKER, environment.AI_ASSISTANT_BACKEND_URL]) {
    assert.ok(!text.includes(secret), "response must not contain upstream/configuration details");
  }
  return text ? JSON.parse(text) : null;
}

test("disabled and malformed flags never read a body or call upstream", async () => {
  for (const CHAT_ENABLED of [undefined, "false", "", "TRUE", " true", "1"]) {
    const h = harness({ environment: { CHAT_ENABLED } });
    await check(await h.handle(request("invalid")), 503);
    assert.equal(h.calls.length, 0);
  }
});

test("every required missing security setting fails closed", async () => {
  for (const key of ["APP_ORIGIN", "AI_ASSISTANT_BACKEND_URL", "AI_ASSISTANT_CHAT_TOKEN"]) {
    for (const value of [undefined, ""]) {
      const h = harness({ environment: { [key]: value } });
      await check(await h.handle(request()), 503);
      assert.equal(h.calls.length, 0);
    }
  }
});

test("unsafe backend URLs and token formats are rejected without fetch", async () => {
  for (const url of [
    "http://backend.example.test", "https://user:pass@backend.example.test",
    "https://backend.example.test/chat", "https://backend.example.test/api/",
    "https://backend.example.test/?secret=value", "https://backend.example.test/?",
    "https://backend.example.test/#fragment", "https://backend.example.test/#",
    "https://backend.example.test/a/..", "https://backend.example.test\\chat",
    " https://backend.example.test", "ftp://backend.example.test",
    "http://localhost.attacker.test", "http://[::]", "not-a-url",
  ]) {
    const h = harness({ environment: { AI_ASSISTANT_BACKEND_URL: url } });
    await check(await h.handle(request()), 503);
    assert.equal(h.calls.length, 0);
  }
  for (const token of ["short", "a".repeat(257), `${TOKEN}\r\nheader: value`, ` ${TOKEN}`]) {
    const h = harness({ environment: { AI_ASSISTANT_CHAT_TOKEN: token } });
    await check(await h.handle(request()), 503);
    assert.equal(h.calls.length, 0);
  }
});

test("only explicit loopback HTTP or HTTPS origins are accepted", async () => {
  for (const url of ["http://localhost:8000", "http://127.0.0.1:8000/", "http://[::1]:8000", "https://backend.example.test/"]) {
    const h = harness({ environment: { AI_ASSISTANT_BACKEND_URL: url } });
    await check(await h.handle(request()), 200);
    assert.equal(h.calls[0][0], new URL("/internal/session-chat", url).href);
  }
});

test("strict object/string/message contract and sanitized validation errors", async () => {
  for (const body of [
    {}, null, [], "null", "[]", { message: 42 }, { message: true },
    { message: {} }, { message: ["hello"] }, { message: "" },
    { message: " \n\t " }, { message: "\u0085\u001c" },
    { message: "a".repeat(1001) }, { message: "a".repeat(1000) + " " },
    { message: "hello", extra: MARKER }, { message: "hello", url: "https://attacker.test" },
  ]) {
    const h = harness();
    await check(await h.handle(request(body)), 400);
    assert.equal(h.calls.length, 0);
  }
});

test("invalid JSON and invalid UTF-8 are safe", async () => {
  for (const body of ["", "{", `{"message":"${MARKER}"`, '{"message":"ok",}']) {
    const h = harness();
    await check(await h.handle(request(body)), 400);
    assert.equal(h.calls.length, 0);
  }
  const h = harness();
  await check(await h.handle(streamRequest(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array([0xff])); controller.close(); },
  }))), 400);
  assert.equal(h.calls.length, 0);
});

test("Unicode code-point boundaries match the backend", async () => {
  for (const message of ["a".repeat(1000), "😀".repeat(1000), "e\u0301".repeat(500)]) {
    const h = harness();
    await check(await h.handle(request({ message })), 200);
    assert.equal(JSON.parse(h.calls[0][1].body).message, message);
  }
  for (const message of ["😀".repeat(1001), "e\u0301".repeat(500) + "x"]) {
    const h = harness();
    await check(await h.handle(request({ message })), 400);
    assert.equal(h.calls.length, 0);
  }
});

test("content type/encoding, origin and Fetch Metadata reject inappropriate requests", async () => {
  for (const headers of [
    { "Content-Type": "text/plain" }, { "Content-Type": "application/jsonp" },
    { "Content-Type": "application/json, application/json" }, { "Content-Encoding": "gzip" },
  ]) {
    const h = harness();
    await check(await h.handle(request(undefined, headers)), 415);
    assert.equal(h.calls.length, 0);
  }
  for (const headers of [
    { Origin: "https://attacker.test" }, { Origin: "null" }, { Origin: "" },
    { Origin: environment.APP_ORIGIN + "/" },
    { Origin: "https://attacker.test", "X-Forwarded-Host": "portfolio.example.test" },
    { "Sec-Fetch-Site": "cross-site" }, { "Sec-Fetch-Site": "same-site" },
    { "Sec-Fetch-Mode": "navigate" }, { "Sec-Fetch-Dest": "document" },
  ]) {
    const h = harness();
    await check(await h.handle(request(undefined, headers)), 403);
    assert.equal(h.calls.length, 0);
  }
  const h = harness();
  const missingOrigin = request(); missingOrigin.headers.delete("Origin");
  await check(await h.handle(missingOrigin), 403);
  assert.equal(h.calls.length, 0);
  const missingType = request(); missingType.headers.delete("Content-Type");
  await check(await h.handle(missingType), 415);
  assert.equal(h.calls.length, 0);
});

test("invalid application origins fail closed without trusting the request host", async () => {
  for (const APP_ORIGIN of ["*", "null", "http://portfolio.example.test", "https://portfolio.example.test/path", "https://portfolio.example.test/?", "https://user:pass@portfolio.example.test"]) {
    const h = harness({ environment: { APP_ORIGIN } });
    await check(await h.handle(request()), 503);
    assert.equal(h.calls.length, 0);
  }
});

test("valid request forwards only reconstructed message and server credentials", async () => {
  const h = harness();
  const response = await h.handle(request({ message: "  BundesHost?  " }, {
    Cookie: `${COOKIE}; other=browser-secret`, "X-Unused": "not-forwarded",
    "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty",
    "Content-Type": "application/json; charset=utf-8",
  }));
  assert.deepEqual(await check(response, 200), { answer: "A tourism forecasting project." });
  assert.equal(h.calls.length, 1);
  const [url, init] = h.calls[0];
  assert.equal(url, environment.AI_ASSISTANT_BACKEND_URL + "/internal/session-chat");
  assert.equal(init.method, "POST");
  assert.equal(init.redirect, "manual");
  assert.equal(init.credentials, "omit");
  assert.equal(init.cache, "no-store");
  assert.equal(init.signal.aborted, false);
  assert.deepEqual(JSON.parse(init.body), { message: "BundesHost?" });
  const headers = new Headers(init.headers);
  assert.equal(headers.get("Authorization"), `Bearer ${TOKEN}`);
  assert.deepEqual([...headers.keys()].sort(), ["authorization", "content-type", "x-portfolio-gateway-assertion", "x-portfolio-session"]);
});

test("declared oversized and malformed body lengths are rejected", async () => {
  for (const [length, status] of [["8193", 413], ["999999999999999999999", 413], ["8, 8", 400], ["-1", 400]]) {
    const h = harness();
    await check(await h.handle(request(undefined, { "Content-Length": length })), status);
    assert.equal(h.calls.length, 0);
  }
});

test("stream size is counted without trusting Content-Length; stream is cancelled", async () => {
  for (const headers of [{}, { "Content-Length": "1" }]) {
    let cancelled = false;
    const h = harness();
    const stream = new ReadableStream({
      start(controller) { controller.enqueue(encoder.encode("x".repeat(8193))); },
      cancel() { cancelled = true; },
    });
    await check(await h.handle(streamRequest(stream, headers)), 413);
    assert.equal(cancelled, true);
    assert.equal(h.calls.length, 0);
  }
});

test("exact byte limit and multibyte characters split across chunks", async () => {
  const json = JSON.stringify({ message: "😀".repeat(1000) });
  const bytes = encoder.encode(json + " ".repeat(8192 - encoder.encode(json).length));
  const h = harness();
  await check(await h.handle(streamRequest(new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
      controller.close();
    },
  }))), 200);
  assert.equal(JSON.parse(h.calls[0][1].body).message, "😀".repeat(1000));
});

test("stalled request stream has a bounded deadline, even if cancel never resolves", async () => {
  const h = harness();
  let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; return new Promise(() => {}); } });
  await check(await h.handle(streamRequest(stream)), 408);
  assert.equal(cancelled, true);
  assert.equal(h.calls.length, 0);
});

test("aborted requests do no work; mid-body abort cancels reading", async () => {
  const h = harness();
  const controller = new AbortController(); controller.abort();
  const aborted = new Request(request(), { signal: controller.signal });
  await check(await h.handle(aborted), 408);
  assert.equal(h.calls.length, 0);
  const live = new AbortController();
  const pending = h.handle(streamRequest(new ReadableStream(), {}, live.signal));
  live.abort();
  await check(await pending, 408);
  assert.equal(h.calls.length, 0);
});

test("upstream timeout aborts the fetch without retrying", async () => {
  const h = harness({ fetch: () => new Promise(() => {}) });
  await check(await h.handle(request()), 504);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][1].signal.aborted, true);
});

test("deadline also covers upstream body streaming", async () => {
  let cancelled = false;
  const h = harness({ fetch: () => new Response(new ReadableStream({
    cancel() { cancelled = true; return new Promise(() => {}); },
  }), { headers: { "Content-Type": "application/json" } }) });
  await check(await h.handle(request()), 504);
  assert.equal(cancelled, true);
  assert.equal(h.calls.length, 1);
});

test("disconnect while awaiting upstream aborts without retrying", async () => {
  const controller = new AbortController();
  const h = harness({ fetch: () => { controller.abort(); return new Promise(() => {}); } });
  await check(await h.handle(new Request(request(), { signal: controller.signal })), 504);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][1].signal.aborted, true);
});

test("successful request clears its timeout instead of aborting later", async () => {
  const h = harness();
  await check(await h.handle(request()), 200);
  await new Promise((resolve) => setTimeout(resolve, 45));
  assert.equal(h.calls[0][1].signal.aborted, false);
});

test("redirects and unexpected statuses never forward upstream bodies or headers", async () => {
  for (const status of [201, 204, 301, 302, 303, 307, 308, 400, 401, 403, 404, 429, 500, 502, 503, 504]) {
    const h = harness({ fetch: () => new Response(status === 204 ? null : `${TOKEN} ${MARKER}`, {
      status, headers: {
        Location: "https://attacker.test", "WWW-Authenticate": `Bearer ${TOKEN}`,
        "Set-Cookie": `secret=${TOKEN}`, "X-Internal": MARKER,
        "Retry-After": "9999999", "Access-Control-Allow-Origin": "*",
      },
    }) });
    const response = await h.handle(request());
    await check(response, status === 429 || status === 503 ? 503 : status === 504 ? 504 : 502);
    for (const name of ["Location", "WWW-Authenticate", "Set-Cookie", "X-Internal", "Retry-After", "Access-Control-Allow-Origin"]) {
      assert.equal(response.headers.get(name), null);
    }
    assert.equal(h.calls.length, 1);
  }
});

test("invalid upstream content, JSON and answer shapes are sanitized", async () => {
  for (const body of ["not JSON", "null", "[]", "{}", '{"answer":42}', '{"answer":""}', '{"answer":"  \\n "}']) {
    const h = harness({ fetch: () => new Response(body, { headers: { "Content-Type": "application/json" } }) });
    await check(await h.handle(request()), 502);
    assert.equal(h.calls.length, 1);
  }
  const h = harness({ fetch: () => new Response(MARKER, { headers: { "Content-Type": "text/html" } }) });
  await check(await h.handle(request()), 502);
});

test("upstream response size is bounded for declared and streamed bodies", async () => {
  for (const declared of [true, false]) {
    let cancelled = false;
    const h = harness({ fetch: () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(encoder.encode("x".repeat(65537))); },
      cancel() { cancelled = true; },
    }), { headers: { "Content-Type": "application/json", ...(declared ? { "Content-Length": "65537" } : {}) } }) });
    await check(await h.handle(request()), 502);
    assert.equal(cancelled, true);
    assert.equal(h.calls.length, 1);
  }
});

test("upstream byte boundary accepts split UTF-8 and sanitizes broken streams", async () => {
  const answer = "A 😀 answer.";
  const json = JSON.stringify({ answer });
  const bytes = encoder.encode(json + " ".repeat(65536 - encoder.encode(json).length));
  const h = harness({ fetch: () => new Response(new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 1025) controller.enqueue(bytes.slice(i, i + 1025));
      controller.close();
    },
  }), { headers: { "Content-Type": "application/json" } }) });
  assert.deepEqual(await check(await h.handle(request()), 200), { answer });
  const broken = harness({ fetch: () => new Response(new ReadableStream({
    start(controller) { controller.error(new Error(MARKER)); },
  }), { headers: { "Content-Type": "application/json" } }) });
  await check(await broken.handle(request()), 502);
  const badUtf8 = harness({ fetch: () => new Response(new Uint8Array([0xff]), {
    headers: { "Content-Type": "application/json" },
  }) });
  await check(await badUtf8.handle(request()), 502);
});

test("network/provider exceptions do not expose internal errors or retry", async () => {
  const h = harness({ fetch: () => { throw new Error(`${MARKER} ${TOKEN} ${environment.AI_ASSISTANT_BACKEND_URL}`); } });
  await check(await h.handle(request()), 502);
  assert.equal(h.calls.length, 1);
});

test("unexpected upstream metadata is rejected, no upstream headers returned", async () => {
  const h = harness({ fetch: () => Response.json({ answer: "Safe answer.", token: TOKEN, debug: MARKER }, {
    headers: { "Set-Cookie": "unsafe=1", "X-Internal": MARKER },
  }) });
  const response = await h.handle(request());
  await check(response, 502);
  assert.equal(response.headers.get("Set-Cookie"), null);
  assert.equal(response.headers.get("X-Internal"), null);
});

test("actual route wiring defaults disabled and controls all non-POST methods", async () => {
  let calls = 0;
  const route = loadGatewayModules({
    process: { env: {} },
    fetch: () => { calls++; throw new Error("Network forbidden in offline tests"); },
  }).load("src/app/api/chat/route.ts");
  assert.equal(route.runtime, "nodejs");
  await check(await route.POST(request()), 503);
  for (const method of ["GET", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    const response = await route[method](new Request("https://portfolio.example.test/api/chat", { method }));
    await check(response, 405);
    assert.equal(response.headers.get("Allow"), "POST");
  }
  assert.equal(calls, 0);
});
