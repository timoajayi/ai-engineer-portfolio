import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { loadSigner } from "./helpers/gateway-assertions-loader.mjs";

const { GatewayAssertionSigner, canonicalVisitorIP } = loadSigner();
const fixture = JSON.parse(readFileSync(new URL("./fixtures/gateway_assertions_v1.json", import.meta.url), "utf8"));
function policy() {
  const { secret_hex, ...key } = fixture.policy.currentKey;
  return { ...fixture.policy, currentKey: { ...key, secret: Buffer.from(secret_hex, "hex") } };
}
function signer(overrides = {}, dependencies = {}) {
  return new GatewayAssertionSigner({ ...policy(), ...overrides }, {
    now: () => fixture.now, nonceBytes: () => Buffer.from(fixture.nonce_hex, "hex"), ...dependencies,
  });
}
function request(vector = fixture.vectors[0]) {
  return { method: "POST", path: "/internal/session-chat", sessionToken: fixture.session_token,
    body: Buffer.from(vector.body_base64, "base64"), visitorIP: vector.visitor_ip_input };
}
function rejects(operation) {
  assert.throws(operation, (error) => error.message === "Invalid gateway assertion configuration or request.");
}
function payload(assertion) { return JSON.parse(Buffer.from(assertion.split(".")[1], "base64url")); }

test("Node signing matches shared Python-verified vectors and independent HMAC", () => {
  for (const vector of fixture.vectors) {
    const compact = signer().sign(request(vector));
    assert.equal(compact, vector.assertion);
    const [h, p, signature] = compact.split(".");
    const independent = createHmac("sha256", Buffer.from(fixture.policy.currentKey.secret_hex, "hex"))
      .update(`${h}.${p}`, "ascii").digest("base64url");
    assert.equal(signature, independent);
    assert.equal(JSON.stringify(payload(compact)), JSON.stringify(vector.payload));
  }
});

test("body hashes exact transmitted bytes including whitespace and UTF-8", () => {
  const base = request();
  const original = payload(signer().sign(base));
  for (const body of [Buffer.from('{ "message":"What is BundesHost?"}'),
    Buffer.concat([base.body, Buffer.from("\n")]), Buffer.from("café"), Buffer.from([0, 255])]) {
    assert.notEqual(payload(signer().sign({ ...base, body })).body_sha256, original.body_sha256);
  }
});

test("session hash binds canonical token text rather than decoded bytes", () => {
  const base = payload(signer().sign(request()));
  const other = payload(signer().sign({ ...request(), sessionToken: Buffer.alloc(32, 22).toString("base64url") }));
  assert.notEqual(base.session_sha256, other.session_sha256);
  assert.equal(base.session_sha256, fixture.vectors[0].payload.session_sha256);
});

test("strict canonical 32-byte session tokens", () => {
  for (const sessionToken of [null, [], "", "x".repeat(42), "x".repeat(44), fixture.session_token + "=",
    fixture.session_token + "\n", "é".repeat(43), fixture.session_token.slice(0, -1) + "F"]) {
    rejects(() => signer().sign({ ...request(), sessionToken }));
  }
});

test("method and exact path cannot be selected arbitrarily", () => {
  for (const method of ["GET", "post", "POST\n", null]) rejects(() => signer().sign({ ...request(), method }));
  for (const path of ["/chat", "/internal/session-chat/", "/internal/session-chat?q=1",
    "/internal/%73ession-chat", "/internal/./session-chat", null]) {
    rejects(() => signer().sign({ ...request(), path }));
  }
});

test("strict request field set prevents caller-selected scope nonce and timestamps", () => {
  for (const name of ["scope", "jti", "iat", "exp", "verified", "ip_source", "issuer", "header"]) {
    rejects(() => signer().sign({ ...request(), [name]: "client-selected" }));
  }
  for (const field of Object.keys(request())) {
    const value = request(); delete value[field]; rejects(() => signer().sign(value));
  }
  for (const value of [null, [], "request"]) rejects(() => signer().sign(value));
  const accessor = request(); Object.defineProperty(accessor, "method", { get: () => "POST" });
  rejects(() => signer().sign(accessor));
});

test("strict policy field set has no algorithm or remote key negotiation", () => {
  for (const field of ["alg", "jku", "jwk", "previousKey", "scope", "extra"]) {
    rejects(() => signer({ [field]: "untrusted" }));
  }
  for (const field of Object.keys(policy())) {
    const value = policy(); delete value[field]; rejects(() => new GatewayAssertionSigner(value));
  }
});

test("ASCII identifiers require exact spelling without newline Unicode or normalization", () => {
  for (const field of ["issuer", "audience", "ipSource"]) {
    for (const value of [undefined, null, "", "x\n", " x", "é", "e\u0301", "x".repeat(65), 12]) {
      rejects(() => signer({ [field]: value }));
    }
  }
});

test("key identifiers and key lengths are bounded", () => {
  for (const kid of [undefined, "", "A", "x\n", "remote/key", "x".repeat(33), null]) {
    rejects(() => signer({ currentKey: { ...policy().currentKey, kid } }));
  }
  for (const secret of [undefined, "X".repeat(32), Buffer.alloc(31), Buffer.alloc(65), [], null]) {
    rejects(() => signer({ currentKey: { ...policy().currentKey, secret } }));
  }
  signer({ currentKey: { ...policy().currentKey, secret: Buffer.alloc(64, 22) } }).sign(request());
});

test("key window configuration rejects coercions and invalid windows", () => {
  for (const field of ["notBefore", "notAfter"]) {
    for (const value of [null, true, "1800000000", 1.2, -1, NaN, Infinity, 253402300800]) {
      rejects(() => signer({ currentKey: { ...policy().currentKey, [field]: value } }));
    }
  }
  rejects(() => signer({ currentKey: { ...policy().currentKey, notAfter: 1 } }));
  rejects(() => signer({ currentKey: { ...policy().currentKey, extra: true } }));
});

test("time-bounded current signing key and rotation", () => {
  rejects(() => signer({}, { now: () => policy().currentKey.notBefore - 1 }).sign(request()));
  rejects(() => signer({}, { now: () => policy().currentKey.notAfter - 29 }).sign(request()));
  const original = signer().sign(request());
  const next = signer({ currentKey: { ...policy().currentKey, kid: "next-key", secret: Buffer.alloc(32, 87) } }).sign(request());
  assert.notEqual(next, original);
  assert.equal(JSON.parse(Buffer.from(next.split(".")[0], "base64url")).kid, "next-key");
});

test("maximum lifetime is 30 seconds and never silently widened", () => {
  for (const lifetimeSeconds of [undefined, null, 0, -1, 31, 1.1, "30", true, NaN]) {
    rejects(() => signer({ lifetimeSeconds }));
  }
  for (const lifetimeSeconds of [1, 30]) {
    const result = payload(signer({ lifetimeSeconds }).sign(request()));
    assert.equal(result.exp - result.iat, lifetimeSeconds);
  }
});

test("Unix-second clocks strictly reject float boolean and invalid values", () => {
  for (const now of [true, -1, 1.5, "1800000000", NaN, Infinity, 253402300800]) {
    rejects(() => signer({}, { now: () => now }).sign(request()));
  }
});

test("production signer generates independent cryptographically random 32-byte nonces", () => {
  const real = new GatewayAssertionSigner(policy(), { now: () => fixture.now });
  const nonces = new Set();
  for (let i = 0; i < 20; i++) {
    const nonce = payload(real.sign(request())).jti;
    assert.equal(Buffer.from(nonce, "base64url").length, 32);
    assert.equal(Buffer.from(nonce, "base64url").toString("base64url"), nonce);
    nonces.add(nonce);
  }
  assert.equal(nonces.size, 20);
});

test("test nonce injection is strict and cannot supply short or nonbyte values", () => {
  for (const nonce of [Buffer.alloc(31), Buffer.alloc(33), Buffer.alloc(32), Buffer.alloc(32, 88), "a".repeat(32), null, []]) {
    rejects(() => signer({}, { nonceBytes: () => nonce }).sign(request()));
  }
});

test("IP normalization covers IPv4 IPv6 and IPv4-mapped IPv6", () => {
  for (const [input, expected] of [["192.0.2.42", "192.0.2.42"], ["2001:0DB8::1", "2001:db8::1"],
    ["::ffff:192.0.2.42", "192.0.2.42"], ["::ffff:c000:22a", "192.0.2.42"],
    ["2001:db8:0:0:1:0:0:1", "2001:db8::1:0:0:1"], ["::1", "::1"]]) {
    assert.equal(canonicalVisitorIP(input), expected);
    assert.equal(payload(signer().sign({ ...request(), visitorIP: input })).visitor_ip, expected);
  }
});

test("IP parser rejects forwarding lists zones addresses with ports and hostnames", () => {
  for (const visitorIP of ["192.000.2.42", "192.0.2.42\n", " 192.0.2.42", "192.0.2.42/32",
    "192.0.2.42,192.0.2.43", "192.0.2.42:80", "[::1]", "fe80::1%eth0", "localhost", null]) {
    rejects(() => signer().sign({ ...request(), visitorIP }));
  }
});

test("body size and raw byte type are bounded", () => {
  signer().sign({ ...request(), body: Buffer.alloc(8192) });
  for (const body of [Buffer.alloc(8193), "{}", {}, null, []]) rejects(() => signer().sign({ ...request(), body }));
});

test("secret is copied private redacted and signer destruction fails closed", () => {
  const value = policy();
  const sign = signer(value);
  const expected = sign.sign(request());
  value.currentKey.secret.fill(0);
  assert.equal(sign.sign(request()), expected);
  assert.equal(Object.keys(sign).length, 0);
  assert.equal(JSON.stringify(sign), "{}");
  sign.destroy();
  rejects(() => sign.sign(request()));
});

test("no configuration environment or network is needed and nothing is logged", () => {
  // VM exposes neither process, fetch, console nor HTTP modules. Modules loaded
  // outside the allowlist throw. Signing still succeeds and contains no key.
  const compact = signer().sign(request());
  assert.ok(!compact.includes(fixture.policy.currentKey.secret_hex));
  rejects(() => signer({ issuer: "secret-marker\n" }));
});
