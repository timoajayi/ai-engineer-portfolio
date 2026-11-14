import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { loadGatewayModules } from "./helpers/chat-gateway-loader.mjs";

const modules = loadGatewayModules();
const { createChatGateway } = modules.gateway;
const { TrustedVisitorIdentityProvider } = modules.identity;
const fixture = JSON.parse(readFileSync(new URL("./fixtures/gateway_assertions_v1.json", import.meta.url)));
const KEY = fixture.policy.currentKey.secret_hex;
const TOKEN = "c".repeat(43), ISSUANCE = "i".repeat(43), SESSION = fixture.session_token;
const COOKIE = `__Host-portfolio-chat=${SESSION}`;
const NOW = fixture.now * 1000 + 123;
const SECRET = "private-marker-never-echo";
const environment = {
  CHAT_ENABLED: "true", APP_ORIGIN: "https://portfolio.example.test", AI_ASSISTANT_BACKEND_URL: "https://backend.example.test",
  AI_ASSISTANT_CHAT_TOKEN: TOKEN, AI_ASSISTANT_BACKEND_TOKEN: ISSUANCE,
  GATEWAY_ASSERTION_ISSUER: fixture.policy.issuer, GATEWAY_ASSERTION_AUDIENCE: fixture.policy.audience,
  GATEWAY_ASSERTION_KEY_ID: fixture.policy.currentKey.kid, GATEWAY_ASSERTION_KEY: Buffer.from(KEY, "hex").toString("base64url"),
  GATEWAY_ASSERTION_KEY_NOT_BEFORE: String(fixture.policy.currentKey.notBefore),
  GATEWAY_ASSERTION_KEY_NOT_AFTER: String(fixture.policy.currentKey.notAfter), GATEWAY_INGRESS_POLICY: fixture.policy.ipSource,
};
class FixtureProvider extends TrustedVisitorIdentityProvider {
  calls = [];
  constructor(options = {}) { super(options.policy ?? environment.GATEWAY_INGRESS_POLICY); this.options = options; }
  async resolveEvidence(context) {
    this.calls.push(context);
    if (this.options.wait) await this.options.wait();
    return { visitorIP: this.options.ip ?? "192.0.2.42", ingressPolicy: this.options.resultPolicy ?? environment.GATEWAY_INGRESS_POLICY,
      requestId: this.options.requestId ?? context.requestId, evidenceId: "offline-fixture-only", ...this.options.result };
  }
}
function harness(options = {}) {
  const calls = [];
  const provider = options.provider === undefined ? new FixtureProvider(options.identity) : options.provider;
  const handle = createChatGateway({ readEnvironment: () => ({ ...environment, ...options.environment }),
    identityProvider: provider, now: options.now ?? (() => NOW),
    bodyTimeoutMs: options.bodyTimeoutMs ?? 25, upstreamTimeoutMs: options.upstreamTimeoutMs ?? 25,
    totalTimeoutMs: options.totalTimeoutMs ?? 100,
    fetch: (...args) => { calls.push(args); return options.fetch ? options.fetch(...args) : Promise.resolve(Response.json({ answer: "Grounded answer." })); },
  });
  return { calls, provider, handle };
}
function request(body = { message: "BundesHost?" }, headers = {}, suffix = "") {
  return new Request(environment.APP_ORIGIN + "/api/chat" + suffix, { method: "POST",
    headers: { Origin: environment.APP_ORIGIN, "Content-Type": "application/json", Cookie: COOKIE, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body) });
}
async function check(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "no-store");
  for (const name of ["set-cookie", "location", "x-internal", "www-authenticate"]) assert.equal(response.headers.get(name), null);
  const text = await response.text();
  for (const secret of [SESSION, TOKEN, ISSUANCE, SECRET, KEY, environment.GATEWAY_ASSERTION_KEY, "192.0.2.42"])
    assert.ok(!text.includes(secret), "No session, credentials, identity or provider data in browser response");
  return text ? JSON.parse(text) : null;
}
function signed(calls) {
  const [url, init] = calls[0];
  const headers = new Headers(init.headers);
  const assertion = headers.get("X-Portfolio-Gateway-Assertion");
  const [h, p, mac] = assertion.split(".");
  const header = JSON.parse(Buffer.from(h, "base64url")), payload = JSON.parse(Buffer.from(p, "base64url"));
  assert.equal(createHmac("sha256", Buffer.from(KEY, "hex")).update(h + "." + p).digest("base64url"), mac);
  return { url, init, headers, assertion, header, payload };
}

test("no production identity provider: flags and keys alone never allow a fetch", async () => {
  for (const provider of [null, {}, { authorizedIdentity: () => ({ visitorIP: "192.0.2.42" }) },
    Object.create(TrustedVisitorIdentityProvider.prototype)]) {
    const h = harness({ provider });
    await check(await h.handle(request()), 503);
    assert.equal(h.calls.length, 0);
  }
});

test("real route stays unavailable even with complete test configuration and CHAT_ENABLED=true", async () => {
  let calls = 0;
  const route = loadGatewayModules({ process: { env: environment }, fetch: () => { calls++; throw new Error("Forbidden"); } })
    .load("src/app/api/chat/route.ts");
  await check(await route.POST(request()), 503);
  assert.equal(calls, 0);
});

test("disabled CHAT_ENABLED ignores separate session issuance flag", async () => {
  for (const flag of [undefined, "false", "TRUE", "true ", "1"]) {
    const h = harness({ environment: { CHAT_ENABLED: flag, CHAT_SESSION_ENABLED: "true" } });
    await check(await h.handle(request()), 503);
    assert.equal(h.calls.length, 0);
    assert.equal(h.provider.calls.length, 0);
  }
  for (const flag of [undefined, "false", "true"]) {
    const h = harness({ environment: { CHAT_SESSION_ENABLED: flag } });
    await check(await h.handle(request()), 200);
  }
});

test("all missing signing, authority and scoped credential settings fail closed", async () => {
  for (const name of Object.keys(environment).filter((name) => !["CHAT_ENABLED", "AI_ASSISTANT_BACKEND_TOKEN"].includes(name))) {
    for (const value of [undefined, ""]) {
      const h = harness({ environment: { [name]: value } });
      await check(await h.handle(request()), 503);
      assert.equal(h.calls.length, 0);
    }
  }
});

test("generic issuance credential is not a fallback and equal credentials are rejected", async () => {
  for (const environment of [{ AI_ASSISTANT_CHAT_TOKEN: undefined }, { AI_ASSISTANT_CHAT_TOKEN: ISSUANCE },
    { AI_ASSISTANT_CHAT_TOKEN: "c".repeat(43) + "\n" }, { AI_ASSISTANT_CHAT_TOKEN: "short" }]) {
    const h = harness({ environment }); await check(await h.handle(request()), 503); assert.equal(h.calls.length, 0);
  }
  const h = harness({ environment: { AI_ASSISTANT_BACKEND_TOKEN: undefined } });
  await check(await h.handle(request()), 200); // issuance can be independently disabled/unconfigured
});

test("weak malformed key encoding, invalid IDs, timestamps and key windows are rejected", async () => {
  const cases = [
    { GATEWAY_ASSERTION_KEY: "x" }, { GATEWAY_ASSERTION_KEY: Buffer.alloc(31).toString("base64url") },
    { GATEWAY_ASSERTION_KEY: environment.GATEWAY_ASSERTION_KEY + "=" }, { GATEWAY_ASSERTION_KEY: TOKEN },
    { GATEWAY_ASSERTION_KEY_ID: "gateway-key-1\n" }, { GATEWAY_ASSERTION_ISSUER: "other\n" },
    { GATEWAY_ASSERTION_AUDIENCE: "é" }, { GATEWAY_INGRESS_POLICY: "trusted=false" },
  ];
  for (const name of ["GATEWAY_ASSERTION_KEY_NOT_BEFORE", "GATEWAY_ASSERTION_KEY_NOT_AFTER"]) {
    for (const value of ["-1", "1.5", "true", "01", "1e9", "253402300800"]) cases.push({ [name]: value });
  }
  for (const environment of cases) {
    const h = harness({ environment }); await check(await h.handle(request()), 503); assert.equal(h.calls.length, 0);
  }
  for (const now of [NaN, Infinity, NOW + .5, -1, 1_900_000_000_000]) {
    const h = harness({ now: () => now }); await check(await h.handle(request()), 503); assert.equal(h.calls.length, 0);
  }
});

test("missing malformed duplicate and noncanonical host cookies never go upstream", async () => {
  for (const Cookie of ["", "other=value", "__Host-portfolio-chat=short", `__Host-portfolio-chat=${SESSION}=`,
    `__Host-portfolio-chat="${SESSION}"`, `__Host-portfolio-chat=${SESSION}; __Host-portfolio-chat=${SESSION}`,
    `__Host-portfolio-chat=${SESSION}, other=value`, `__Host-portfolio-chat=%41${SESSION.slice(1)}`,
    `__Host-portfolio-chat=${TOKEN}`, "bad-cookie; " + COOKIE, "Cookie=" + "x".repeat(4097)]) {
    const h = harness(); await check(await h.handle(request(undefined, { Cookie })), 401); assert.equal(h.calls.length, 0);
  }
  const h = harness(); const missing = request(); missing.headers.delete("Cookie");
  await check(await h.handle(missing), 401); assert.equal(h.calls.length, 0);
});

test("Origin Fetch Metadata URL queries and framing failures reject before identity", async () => {
  for (const headers of [{ Origin: "https://attacker.test" }, { Origin: environment.APP_ORIGIN + "/" },
    { "Sec-Fetch-Site": "cross-site" }, { "Sec-Fetch-Mode": "navigate" }, { "Sec-Fetch-Dest": "document" },
    { "Content-Length": "1, 1" }, { "Content-Length": "01" }, { "Content-Length": "1", "Transfer-Encoding": "chunked" },
    { "Transfer-Encoding": "chunked" }, { Trailer: "X-Private" }]) {
    const h = harness(); const result = await h.handle(request(undefined, headers));
    assert.ok([400, 403].includes(result.status)); await check(result, result.status);
    assert.equal(h.calls.length, 0); assert.equal(h.provider.calls.length, 0);
  }
  const h = harness(); await check(await h.handle(request(undefined, {}, "?credential=private")), 400);
  assert.equal(h.calls.length, 0);
});

test("browser credentials, identity and session assertion headers are rejected rather than forwarded", async () => {
  for (const name of ["Authorization", "Proxy-Authorization", "X-Portfolio-Session", "X-Portfolio-Gateway-Assertion",
    "X-Forwarded-For", "X-Real-IP", "CF-Connecting-IP", "Forwarded", "X-Portfolio-Client-IP", "X-Credential-ID"]) {
    const h = harness(); await check(await h.handle(request(undefined, { [name]: SECRET })), 403); assert.equal(h.calls.length, 0);
  }
});

test("duplicate decoded JSON names, extra fields, BOM and lone surrogates fail", async () => {
  for (const body of ['{"message":"ok","message":"bad"}', '{"message":"ok","\\u006dessage":"bad"}',
    '{"message":"ok","extra":"PRIVATE"}', '{"message":"\\ud800"}', '\ufeff{"message":"ok"}']) {
    const h = harness(); await check(await h.handle(request(body)), 400); assert.equal(h.calls.length, 0);
  }
});

test("exact backend contract signs and sends the SAME UTF-8 buffer", async () => {
  const h = harness();
  await check(await h.handle(request({ message: "  Tourism — café 😀  " }, { "X-Unused": "not-forwarded" })), 200);
  assert.equal(h.calls.length, 1);
  const { url, init, headers, payload, header } = signed(h.calls);
  assert.equal(url, environment.AI_ASSISTANT_BACKEND_URL + "/internal/session-chat");
  assert.equal(init.method, "POST"); assert.ok(init.body instanceof Uint8Array);
  assert.equal(Buffer.from(init.body).toString(), JSON.stringify({ message: "Tourism — café 😀" }));
  assert.equal(payload.body_sha256, createHash("sha256").update(init.body).digest("hex"));
  assert.equal(payload.session_sha256, createHash("sha256").update(SESSION, "ascii").digest("hex"));
  assert.equal(payload.iss, environment.GATEWAY_ASSERTION_ISSUER); assert.equal(payload.aud, environment.GATEWAY_ASSERTION_AUDIENCE);
  assert.equal(payload.ip_source, environment.GATEWAY_INGRESS_POLICY); assert.equal(payload.visitor_ip, "192.0.2.42");
  assert.equal(payload.path, "/internal/session-chat"); assert.equal(payload.method, "POST");
  assert.equal(header.kid, environment.GATEWAY_ASSERTION_KEY_ID); assert.equal(header.typ, "portfolio-gateway-assertion-v1");
  assert.equal(payload.exp - payload.iat, 30); assert.equal(payload.iat, fixture.now);
  assert.equal(headers.get("Authorization"), `Bearer ${TOKEN}`); assert.equal(headers.get("X-Portfolio-Session"), SESSION);
  assert.deepEqual([...headers.keys()].sort(), ["authorization", "content-type", "x-portfolio-gateway-assertion", "x-portfolio-session"]);
  assert.equal(init.redirect, "manual"); assert.equal(init.credentials, "omit"); assert.equal(init.cache, "no-store");
  assert.equal(h.provider.calls[0].sessionSHA256, payload.session_sha256);
  assert.equal(h.provider.calls[0].bodySHA256, payload.body_sha256);
  assert.ok(Object.isFrozen(h.provider.calls[0]));
  assert.deepEqual(Object.keys(h.provider.calls[0]).sort(), ["bodySHA256", "method", "origin", "path", "requestId", "sessionSHA256"]);
});

test("cryptographic nonces and identity request contexts are unique per deliberate request", async () => {
  const h = harness();
  for (let i = 0; i < 8; i++) await check(await h.handle(request()), 200);
  const nonces = h.calls.map((call) => signed([call]).payload.jti);
  assert.equal(new Set(nonces).size, 8);
  assert.equal(new Set(h.provider.calls.map((value) => value.requestId)).size, 8);
  for (const nonce of nonces) assert.equal(Buffer.from(nonce, "base64url").length, 32);
});

test("provider must authorize the pinned policy canonical address and exact request context", async () => {
  for (const identity of [{ policy: "unapproved" }, { resultPolicy: "unapproved" }, { ip: "invalid" },
    { ip: "2001:DB8::1" }, { ip: "::ffff:192.0.2.42" }, { ip: "fe80::1%eth0" }, { requestId: "old-request" },
    { result: { evidenceId: "" } }, { result: { extra: true } }]) {
    const h = harness({ identity }); await check(await h.handle(request()), 503); assert.equal(h.calls.length, 0);
  }
  const h = harness({ identity: { ip: "2001:db8::1" } });
  await check(await h.handle(request()), 200); assert.equal(signed(h.calls).payload.visitor_ip, "2001:db8::1");
});

test("a slow noncooperative identity provider cannot fetch after the overall deadline", async () => {
  let release;
  const h = harness({ totalTimeoutMs: 25, identity: { wait: () => new Promise((resolve) => { release = resolve; }) } });
  await check(await h.handle(request()), 504);
  assert.equal(h.calls.length, 0);
  release(); await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(h.calls.length, 0);
});

test("invalid response schema, duplicate keys, metadata and encoding are sanitized", async () => {
  for (const body of ['{"answer":"ok","answer":"bad"}', '{"answer":"ok","token":"PRIVATE"}',
    '{"answer":"\\ud800"}', '{"answer":null}', '{"answer":true}', '{}', '[]']) {
    const h = harness({ fetch: () => new Response(body, { headers: { "Content-Type": "application/json" } }) });
    await check(await h.handle(request()), 502); assert.equal(h.calls.length, 1);
  }
  const h = harness({ fetch: () => new Response('{}', { headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" } }) });
  await check(await h.handle(request()), 502);
});

test("network exceptions and deadline failures never retry or invoke legacy endpoint", async () => {
  for (const options of [{ fetch: () => { throw new Error(SECRET); } }, { fetch: () => new Promise(() => {}) }]) {
    const h = harness(options); const response = await h.handle(request());
    await check(response, options.fetch.toString().includes("throw") ? 502 : 504);
    assert.equal(h.calls.length, 1); assert.ok(h.calls[0][0].endsWith("/internal/session-chat"));
  }
});

test("no console/env/network is exposed to modules under the test loader", async () => {
  const h = harness(); await check(await h.handle(request()), 200);
  const errorHarness = harness({ identity: { wait: () => { throw new Error(SECRET); } } });
  await check(await errorHarness.handle(request()), 503); assert.equal(errorHarness.calls.length, 0);
});


test("upstream answer cannot accidentally echo a known session or credential", async () => {
  for (const answer of [SESSION, TOKEN, ISSUANCE, environment.GATEWAY_ASSERTION_KEY]) {
    const h = harness({ fetch: () => Response.json({ answer }) });
    await check(await h.handle(request()), 502); assert.equal(h.calls.length, 1);
  }
});

test("non-UTF8 charset and ambiguous response lengths fail closed", async () => {
  const h = harness();
  await check(await h.handle(request(undefined, { "Content-Type": "application/json; charset=iso-8859-1" })), 415);
  assert.equal(h.calls.length, 0);
  for (const length of ["01", "1, 1", "1"]) {
    const h = harness({ fetch: () => new Response('{"answer":"ok"}', { headers: { "Content-Type": "application/json", "Content-Length": length } }) });
    await check(await h.handle(request()), 502);
  }
});
