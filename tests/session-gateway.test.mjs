import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import { Buffer } from "node:buffer";
import { test } from "node:test";
import ts from "typescript";

// Existing compiler, in memory only. No environment files or real fetch are
// exposed to the tested modules, so accidental real provider calls fail closed.
function loadTypeScript(path, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  return new Script(`(function () { const exports = {}; ${outputText}\nreturn exports; })()`)
    .runInNewContext({
      Request, Response, Headers, URL, Uint8Array, TextDecoder, AbortController,
      setTimeout, clearTimeout,
      require(name) { assert.equal(name, "node:buffer"); return { Buffer }; },
      ...globals,
    });
}

const sessionGateway = loadTypeScript("../src/lib/server/session-gateway.ts");
const NOW = 1_800_000_000_123;
const SESSION = Buffer.alloc(32, 17).toString("base64url");
const BEARER = "offline-backend-credential-" + "a".repeat(43);
const PROOF = "offline-proof-token";
const PRIVATE = "private-provider-error";
const config = {
  CHAT_SESSION_ENABLED: "true",
  APP_ORIGIN: "https://portfolio.example.test",
  AI_ASSISTANT_BACKEND_URL: "https://backend.example.test",
  AI_ASSISTANT_BACKEND_TOKEN: BEARER,
};
const encoder = new TextEncoder();
const validResult = () => ({ token: SESSION, expires_at: Math.floor(NOW / 1000) + 14_400 });

function request(body = { proof: PROOF }, headers = {}, suffix = "") {
  return new Request(`https://portfolio.example.test/api/chat/session${suffix}`, {
    method: "POST", headers: { Origin: config.APP_ORIGIN, "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function streamed(body, headers = {}, signal) {
  return new Request("https://portfolio.example.test/api/chat/session", {
    method: "POST", duplex: "half", body, signal,
    headers: { Origin: config.APP_ORIGIN, "Content-Type": "application/json", ...headers },
  });
}

function harness(options = {}) {
  const calls = [];
  const handle = sessionGateway.createSessionGateway({
    readEnvironment: () => ({ ...config, ...options.environment }),
    now: options.now ?? (() => NOW),
    fetch: (...args) => {
      calls.push(args);
      return options.fetch ? options.fetch(...args) : Promise.resolve(Response.json(validResult(), { status: 201 }));
    },
    bodyTimeoutMs: 25, upstreamTimeoutMs: 25,
  });
  return { calls, handle };
}

async function check(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const text = await response.text();
  for (const secret of [SESSION, BEARER, PROOF, PRIVATE, config.AI_ASSISTANT_BACKEND_URL]) {
    assert.ok(!text.includes(secret), "secret/proof must not appear in browser JSON");
  }
  if (status !== 201) assert.equal(response.headers.get("Set-Cookie"), null, "failures must preserve existing cookies");
  return text ? JSON.parse(text) : null;
}

test("disabled by default, exact opt-in and independent of CHAT_ENABLED", async () => {
  for (const flag of [undefined, "false", "", "TRUE", " true", "true\n", "1"]) {
    const h = harness({ environment: { CHAT_SESSION_ENABLED: flag, CHAT_ENABLED: "true" } });
    await check(await h.handle(request("malformed")), 503);
    assert.equal(h.calls.length, 0);
  }
  for (const CHAT_ENABLED of [undefined, "false", "true"]) {
    const h = harness({ environment: { CHAT_ENABLED } });
    await check(await h.handle(request()), 201);
    assert.equal(h.calls.length, 1);
  }
});

test("missing and invalid configuration fails closed", async () => {
  for (const field of ["APP_ORIGIN", "AI_ASSISTANT_BACKEND_URL", "AI_ASSISTANT_BACKEND_TOKEN"]) {
    for (const value of [undefined, ""]) {
      const h = harness({ environment: { [field]: value } });
      await check(await h.handle(request()), 503);
      assert.equal(h.calls.length, 0);
    }
  }
  for (const value of ["https://user:pass@backend.example.test", "http://backend.example.test",
    "https://backend.example.test/path", "https://backend.example.test/a/..",
    "https://backend.example.test/?", "https://backend.example.test/#", "https://backend.example.test/?secret=x",
    "https://backend.example.test/#secret", "https://backend.example.test\\path",
    "https://backend.example.test\n", " https://backend.example.test", "ftp://backend.example.test",
    "http://localhost.attacker.test", "http://[::]", "not-a-url"]) {
    const h = harness({ environment: { AI_ASSISTANT_BACKEND_URL: value } });
    await check(await h.handle(request()), 503);
    assert.equal(h.calls.length, 0);
  }
  for (const value of ["http://localhost:3000", "http://portfolio.example.test", "*", "null",
    "https://portfolio.example.test/path", "https://portfolio.example.test\n"]) {
    const h = harness({ environment: { APP_ORIGIN: value } });
    await check(await h.handle(request()), 503);
    assert.equal(h.calls.length, 0);
  }
  for (const value of ["short", "a".repeat(257), BEARER + "\n", BEARER + "\r\nX-Evil: yes", " " + BEARER]) {
    const h = harness({ environment: { AI_ASSISTANT_BACKEND_TOKEN: value } });
    await check(await h.handle(request()), 503);
    assert.equal(h.calls.length, 0);
  }
});

test("server loopback HTTP is allowed, while cookie/browser policy stays secure", async () => {
  for (const base of ["http://127.0.0.1:8000", "http://localhost:8000/", "http://[::1]:8000", "https://backend.example.test/"]) {
    const h = harness({ environment: { AI_ASSISTANT_BACKEND_URL: base } });
    const response = await h.handle(request());
    assert.match(response.headers.get("Set-Cookie"), /; Secure;/);
    await check(response, 201);
    assert.equal(h.calls[0][0], new URL("/internal/verified-sessions", base).href);
  }
});

test("successful issuance maps exact proof-only backend contract and strips all browser headers", async () => {
  const h = harness();
  const response = await h.handle(request(undefined, {
    Authorization: "Bearer browser-auth", Cookie: "__Host-portfolio-chat=browser-token; other=secret",
    "X-Forwarded-For": "198.51.100.1", "X-Real-IP": "198.51.100.2",
    "CF-Connecting-IP": "198.51.100.3", "X-Request-ID": "browser-id",
    "X-Gateway-ID": "browser-gateway", "X-Verified": "true",
    "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty",
    "Content-Type": "application/json; charset=utf-8",
  }));
  assert.deepEqual(await check(response, 201), { status: "ready" });
  assert.equal(h.calls.length, 1);
  const [url, init] = h.calls[0];
  assert.equal(url, "https://backend.example.test/internal/verified-sessions");
  assert.deepEqual(JSON.parse(init.body), { proof: PROOF });
  assert.equal(init.method, "POST");
  assert.equal(init.redirect, "manual");
  assert.equal(init.credentials, "omit");
  assert.equal(init.cache, "no-store");
  assert.deepEqual([...new Headers(init.headers)], [
    ["accept", "application/json"], ["authorization", `Bearer ${BEARER}`], ["content-type", "application/json"],
  ]);
});

test("cookie has fixed host-only secure attributes and exact absolute backend expiry", async () => {
  const response = await harness().handle(request());
  const cookie = response.headers.get("Set-Cookie");
  const attributes = cookie.split("; ");
  assert.equal(attributes[0], `__Host-portfolio-chat=${SESSION}`);
  assert.deepEqual(attributes.slice(1, 5), ["Secure", "HttpOnly", "SameSite=Strict", "Path=/"]);
  assert.equal(attributes.length, 6);
  assert.equal(attributes[5], `Expires=${new Date(validResult().expires_at * 1000).toUTCString()}`);
  assert.ok(!/domain|max-age/i.test(cookie));
  await check(response, 201);
});

test("missing/wrong origins and CSRF/Fetch Metadata are rejected before fetch", async () => {
  for (const headers of [{ Origin: "" }, { Origin: "null" }, { Origin: "https://attacker.test" },
    { Origin: config.APP_ORIGIN + "/" }, { Origin: "https://sub.portfolio.example.test" },
    { Origin: "https://attacker.test", "X-Forwarded-Host": "portfolio.example.test" },
    { "Sec-Fetch-Site": "cross-site" }, { "Sec-Fetch-Site": "same-site" }, { "Sec-Fetch-Site": "none" },
    { "Sec-Fetch-Mode": "navigate" }, { "Sec-Fetch-Mode": "no-cors" }, { "Sec-Fetch-Dest": "document" }]) {
    const h = harness();
    await check(await h.handle(request(undefined, headers)), 403);
    assert.equal(h.calls.length, 0);
  }
  const h = harness(); const req = request(); req.headers.delete("Origin");
  await check(await h.handle(req), 403);
  assert.equal(h.calls.length, 0);
});

test("unsupported type/encoding and missing content type are rejected", async () => {
  for (const headers of [{ "Content-Type": "text/plain" }, { "Content-Type": "application/jsonp" },
    { "Content-Type": "application/json, application/json" }, { "Content-Encoding": "gzip" },
    { "Content-Encoding": "br" }, { "Content-Encoding": "identity, identity" }]) {
    const h = harness(); await check(await h.handle(request(undefined, headers)), 415);
    assert.equal(h.calls.length, 0);
  }
  const h = harness(); const req = request(); req.headers.delete("Content-Type");
  await check(await h.handle(req), 415); assert.equal(h.calls.length, 0);
});

test("query strings, including empty queries, are rejected", async () => {
  for (const query of ["?", "?proof=secret", "?request_id=attacker", "?gateway_id=attacker"]) {
    const h = harness(); await check(await h.handle(request(undefined, {}, query)), 400);
    assert.equal(h.calls.length, 0);
  }
});

test("proof fields require printable non-whitespace ASCII with exact length limits", async () => {
  for (const body of [{}, null, [], { proof: null }, { proof: true }, { proof: 42 }, { proof: [] },
    { proof: "" }, { proof: " " }, { proof: "a b" }, { proof: "a\n" }, { proof: "a\r" }, { proof: "a\t" },
    { proof: "a\u0000" }, { proof: "a\u007f" }, { proof: "é" }, { proof: "😀" },
    { proof: "\u00a0" }, { proof: "a".repeat(2049) }, { proof: "\ud800" }]) {
    const h = harness(); await check(await h.handle(request(body)), 400); assert.equal(h.calls.length, 0);
  }
  for (const proof of ["!", "~", "a".repeat(2048), '\\"abc!~']) {
    const h = harness(); await check(await h.handle(request({ proof })), 201);
    assert.equal(JSON.parse(h.calls[0][1].body).proof, proof);
  }
});

test("duplicate decoded keys, extra fields, nested structures and malformed JSON are rejected", async () => {
  for (const body of [
    '{"proof":"one","proof":"two"}', '{"proof":"one","pr\\u006fof":"two"}',
    '{"proof":"one","request_id":"bad"}', '{"proof":"one","gateway_id":"bad"}',
    '{"proof":"one","verified":true}', '{"proof":"one","__proto__":"bad"}',
    '{"proof":{"proof":"nested"}}', '{"proof":"one",}', '{"proof":"bad\\x20"}',
    '{"proof":"one"} {}', '{"proof":"one"}garbage', '{"proof":"one"/*comment*/}',
    '{"proof":"raw\nnewline"}', '{"proof":"one"\u00a0}', '\ufeff{"proof":"one"}',
    '', '{', '{"proof":NaN}', '{"proof":Infinity}', '{"proof":01}', '{"proof":"unterminated}',
  ]) {
    const h = harness(); await check(await h.handle(request(body)), 400); assert.equal(h.calls.length, 0);
  }
  const h = harness(); await check(await h.handle(request('{"pr\\u006fof":"escaped-key"}')), 201);
  assert.deepEqual(JSON.parse(h.calls[0][1].body), { proof: "escaped-key" });
});

test("request byte limit counts streams, cancels overflow and ignores smaller declared lengths", async () => {
  for (const headers of [{}, { "Content-Length": "1" }]) {
    let cancelled = false;
    const h = harness();
    await check(await h.handle(streamed(new ReadableStream({
      start(c) { c.enqueue(encoder.encode("x".repeat(4097))); }, cancel() { cancelled = true; },
    }), headers)), 413);
    assert.equal(cancelled, true); assert.equal(h.calls.length, 0);
  }
  for (const [length, status] of [["4097", 413], ["99999999999999999999", 413], ["1, 1", 400], ["-1", 400]]) {
    const h = harness(); await check(await h.handle(request(undefined, { "Content-Length": length })), status);
    assert.equal(h.calls.length, 0);
  }
});

test("exact body byte boundary and escapes split across chunks are accepted", async () => {
  const json = '{"proof":"\\u0061!"}';
  const bytes = encoder.encode(json + " ".repeat(4096 - encoder.encode(json).length));
  const h = harness();
  await check(await h.handle(streamed(new ReadableStream({ start(c) {
    for (let i = 0; i < bytes.length; i += 3) c.enqueue(bytes.slice(i, i + 3)); c.close();
  } }))), 201);
  assert.deepEqual(JSON.parse(h.calls[0][1].body), { proof: "a!" });
});

test("request upload deadline is bounded even when cancellation never resolves", async () => {
  let cancelled = false;
  const h = harness();
  await check(await h.handle(streamed(new ReadableStream({
    cancel() { cancelled = true; return new Promise(() => {}); },
  }))), 408);
  assert.equal(cancelled, true); assert.equal(h.calls.length, 0);
});

test("invalid UTF-8 and broken request streams are sanitized", async () => {
  for (const stream of [
    new ReadableStream({ start(c) { c.enqueue(new Uint8Array([255])); c.close(); } }),
    new ReadableStream({ start(c) { c.error(new Error(PRIVATE)); } }),
  ]) {
    const h = harness(); await check(await h.handle(streamed(stream)), 400); assert.equal(h.calls.length, 0);
  }
});

test("upstream timeout/lost response aborts without retry or cookie", async () => {
  const h = harness({ fetch: () => new Promise(() => {}) });
  await check(await h.handle(request()), 504);
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0][1].signal.aborted, true);
});

test("upstream response reading is included in the deadline", async () => {
  let cancelled = false;
  const h = harness({ fetch: () => Promise.resolve(new Response(new ReadableStream({
    cancel() { cancelled = true; return new Promise(() => {}); },
  }), { status: 201, headers: { "Content-Type": "application/json" } })) });
  await check(await h.handle(request()), 504);
  assert.equal(cancelled, true); assert.equal(h.calls.length, 1);
});

test("network failure or response lost after issuance is not retried", async () => {
  const h = harness({ fetch: () => { throw new Error(`${PRIVATE} ${SESSION} ${BEARER} ${PROOF}`); } });
  await check(await h.handle(request()), 502); assert.equal(h.calls.length, 1);
});

test("upstream redirects/auth/provider failures preserve only approved statuses", async () => {
  for (const status of [200, 202, 204, 301, 302, 303, 307, 308, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 503, 504]) {
    const h = harness({ fetch: () => Promise.resolve(new Response(status === 204 ? null : `${PRIVATE} ${SESSION} ${BEARER} ${PROOF}`, {
      status, headers: { Location: "https://attacker.test", "Set-Cookie": "unsafe=yes", "X-Internal": PRIVATE,
        "WWW-Authenticate": `Bearer ${BEARER}`, "Retry-After": "999999", "Access-Control-Allow-Origin": "*" },
    })) });
    const response = await h.handle(request(undefined, { Cookie: "__Host-portfolio-chat=existing" }));
    await check(response, [400, 403, 409, 413, 415, 422, 429, 503, 504].includes(status) ? status : 502);
    for (const name of ["Location", "Set-Cookie", "X-Internal", "WWW-Authenticate", "Retry-After", "Access-Control-Allow-Origin"]) {
      assert.equal(response.headers.get(name), null);
    }
    assert.equal(h.calls.length, 1);
  }
});

test("backend JSON must be strict, flat, unique and have exactly the two fields", async () => {
  const expires = validResult().expires_at;
  for (const text of [
    "", "not-json", "null", "[]", "{}", JSON.stringify({ token: SESSION }), JSON.stringify({ expires_at: expires }),
    JSON.stringify({ ...validResult(), private: PRIVATE }),
    `{"token":"${SESSION}","token":"${SESSION}","expires_at":${expires}}`,
    `{"token":"${SESSION}","to\\u006ben":"${SESSION}","expires_at":${expires}}`,
    `{"token":"${SESSION}","expires_at":${expires},"expires_at":${expires}}`,
    JSON.stringify({ token: { secret: SESSION }, expires_at: expires }),
    JSON.stringify(validResult()) + " garbage", "\ufeff" + JSON.stringify(validResult()),
    `{"token":"${SESSION}","expires_at":${expires},}`,
  ]) {
    const h = harness({ fetch: () => Promise.resolve(new Response(text, { status: 201, headers: { "Content-Type": "application/json" } })) });
    await check(await h.handle(request()), 502); assert.equal(h.calls.length, 1);
  }
});

test("session tokens require canonical unpadded base64url encoding of exactly 32 bytes", async () => {
  for (const token of [null, false, 42, "", SESSION + "=", SESSION + "\n", SESSION.slice(0, -1) + "F",
    SESSION.slice(0, -1), SESSION + "A", "/".repeat(43), "+".repeat(43), "é".repeat(43),
    Buffer.alloc(31).toString("base64url"), Buffer.alloc(33).toString("base64url")]) {
    const h = harness({ fetch: () => Promise.resolve(Response.json({ ...validResult(), token }, { status: 201 })) });
    await check(await h.handle(request()), 502);
  }
  const h = harness({ environment: { AI_ASSISTANT_BACKEND_TOKEN: SESSION } });
  await check(await h.handle(request()), 502); // Never issue a backend credential as a cookie.
});

test("expiry must be a safe future integer within the four-hour ceiling", async () => {
  for (const expires_at of [null, false, "1800000001", 1.5, -1, 0, Math.floor(NOW / 1000),
    NOW, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, Math.floor(NOW / 1000) + 14401]) {
    const h = harness({ fetch: () => Promise.resolve(Response.json({ token: SESSION, expires_at }, { status: 201 })) });
    await check(await h.handle(request()), 502);
  }
  for (const literal of ["NaN", "Infinity", "01", "1800000001.0", "18e8"]) {
    const h = harness({ fetch: () => Promise.resolve(new Response(`{"token":"${SESSION}","expires_at":${literal}}`, {
      status: 201, headers: { "Content-Type": "application/json" },
    })) });
    await check(await h.handle(request()), 502);
  }
  for (const expires_at of [Math.floor(NOW / 1000) + 1, Math.floor(NOW / 1000) + 14400]) {
    const h = harness({ fetch: () => Promise.resolve(Response.json({ token: SESSION, expires_at }, { status: 201 })) });
    const response = await h.handle(request());
    assert.ok(Date.parse(response.headers.get("Set-Cookie").split("Expires=")[1]) <= expires_at * 1000);
    await check(response, 201);
  }
});

test("response size is bounded for declared and streamed bodies; overflow cancels", async () => {
  for (const headers of [{}, { "Content-Length": "1" }, { "Content-Length": "2049" }]) {
    let cancelled = false;
    const h = harness({ fetch: () => Promise.resolve(new Response(new ReadableStream({
      start(c) { c.enqueue(encoder.encode("x".repeat(2049))); }, cancel() { cancelled = true; },
    }), { status: 201, headers: { "Content-Type": "application/json", ...headers } })) });
    await check(await h.handle(request()), 502); assert.equal(cancelled, true); assert.equal(h.calls.length, 1);
  }
  const text = JSON.stringify(validResult());
  const bytes = encoder.encode(text + " ".repeat(2048 - encoder.encode(text).length));
  const h = harness({ fetch: () => Promise.resolve(new Response(new ReadableStream({ start(c) {
    for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7)); c.close();
  } }), { status: 201, headers: { "Content-Type": "application/json" } })) });
  await check(await h.handle(request()), 201);
});

test("backend unsupported content types, encodings, bad UTF-8 and broken streams are safe", async () => {
  for (const headers of [{}, { "Content-Type": "text/html" }, { "Content-Type": "application/json", "Content-Encoding": "gzip" },
    { "Content-Type": "application/json", "Content-Length": "1, 1" }]) {
    const h = harness({ fetch: () => Promise.resolve(new Response(JSON.stringify(validResult()), { status: 201, headers })) });
    await check(await h.handle(request()), 502);
  }
  for (const stream of [new ReadableStream({ start(c) { c.enqueue(new Uint8Array([255])); c.close(); } }),
    new ReadableStream({ start(c) { c.error(new Error(PRIVATE)); } })]) {
    const h = harness({ fetch: () => Promise.resolve(new Response(stream, { status: 201, headers: { "Content-Type": "application/json" } })) });
    await check(await h.handle(request()), 502);
  }
});

test("existing browser cookie is never forwarded or overwritten on failed issuance", async () => {
  const h = harness({ fetch: () => Promise.resolve(new Response(PRIVATE, { status: 503 })) });
  const response = await h.handle(request(undefined, { Cookie: `__Host-portfolio-chat=${SESSION}; other=private` }));
  await check(response, 503);
  assert.equal(new Headers(h.calls[0][1].headers).get("Cookie"), null);
});

test("client abort and late backend responses cannot set cookies or cause retries", async () => {
  const aborted = new AbortController(); aborted.abort();
  const h = harness(); await check(await h.handle(new Request(request(), { signal: aborted.signal })), 408);
  assert.equal(h.calls.length, 0);
  const controller = new AbortController();
  const pending = harness({ fetch: () => { controller.abort(); return Promise.resolve(Response.json(validResult(), { status: 201 })); } });
  await check(await pending.handle(new Request(request(), { signal: controller.signal })), 504);
  assert.equal(pending.calls.length, 1);
  let complete;
  const late = harness({ fetch: () => new Promise((resolve) => { complete = resolve; }) });
  await check(await late.handle(request()), 504);
  complete(Response.json(validResult(), { status: 201 }));
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(late.calls.length, 1);
});

test("successful work clears deadline timers", async () => {
  const h = harness(); await check(await h.handle(request()), 201);
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(h.calls[0][1].signal.aborted, false);
});

test("actual route is server-only, independently disabled and controls non-POST methods", async () => {
  let calls = 0;
  const route = loadTypeScript("../src/app/api/chat/session/route.ts", {
    process: { env: { CHAT_ENABLED: "true" } },
    fetch() { calls++; throw new Error("Offline network guard"); },
    require(name) {
      if (name === "server-only") return {};
      assert.equal(name, "@/lib/server/session-gateway"); return sessionGateway;
    },
  });
  assert.equal(route.runtime, "nodejs"); assert.equal(route.dynamic, "force-dynamic");
  await check(await route.POST(request()), 503);
  for (const method of ["GET", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    const response = await route[method](new Request("https://portfolio.example.test/api/chat/session", { method }));
    await check(response, 405); assert.equal(response.headers.get("Allow"), "POST");
  }
  assert.equal(calls, 0);
});
