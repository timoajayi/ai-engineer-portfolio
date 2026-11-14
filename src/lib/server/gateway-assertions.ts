import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
import { isIP } from "node:net";
import { URL } from "node:url";

// Isolated protocol utility. Never reads environment variables or performs I/O.
export const ASSERTION_PROTOCOL = "portfolio-gateway-assertion-v1";
export const ASSERTION_METHOD = "POST";
export const ASSERTION_PATH = "/internal/session-chat";
const MAX_TIME = 253402300799;
const identifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const keyId = /^[a-z0-9][a-z0-9_-]{0,31}$/;

export class GatewayAssertionError extends Error {
  constructor() { super("Invalid gateway assertion configuration or request."); }
}
function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new GatewayAssertionError();
}
function exactObject(value: unknown, fields: string[]): asserts value is Record<string, unknown> {
  requireValid(value !== null && typeof value === "object" && !Array.isArray(value));
  const names = Reflect.ownKeys(value);
  requireValid(names.length === fields.length && names.every((key) => typeof key === "string" && fields.includes(key)));
  // Accessors could return different values between validation and signing.
  requireValid(names.every((key) => Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, "value")));
}
function matches(value: unknown, expression: RegExp): value is string {
  // JS $ also matches before a final newline: require the matched length too.
  return typeof value === "string" && expression.exec(value)?.[0] === value;
}
function timestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_TIME;
}
function bytes(value: unknown, maximum: number, minimum = 0): Buffer {
  requireValid(value instanceof Uint8Array && value.byteLength >= minimum && value.byteLength <= maximum);
  return Buffer.from(value);
}
function sessionBytes(value: unknown): Buffer {
  requireValid(matches(value, /^[A-Za-z0-9_-]{43}$/));
  const decoded = Buffer.from(value, "base64url");
  requireValid(decoded.length === 32 && decoded.toString("base64url") === value);
  return Buffer.from(value, "ascii");
}
export function canonicalVisitorIP(value: unknown): string {
  // Parsing is not a claim that this address came from a trusted ingress.
  requireValid(typeof value === "string" && value.length <= 45 && !value.includes("%"));
  const family = isIP(value);
  requireValid(family !== 0);
  if (family === 4) return value;
  const normalized = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  if (normalized.startsWith("::ffff:")) {
    const words = normalized.slice(7).split(":");
    requireValid(words.length === 2);
    const number = parseInt(words[0], 16) * 65536 + parseInt(words[1], 16);
    return [24, 16, 8, 0].map((shift) => (number >>> shift) & 255).join(".");
  }
  return normalized;
}

export type AssertionSigningKey = {
  kid: string;
  secret: Uint8Array;
  notBefore: number;
  notAfter: number;
};
export type AssertionSigningPolicy = {
  issuer: string;
  audience: string;
  ipSource: string;
  currentKey: AssertionSigningKey;
  lifetimeSeconds: number;
};
export type AssertionRequest = {
  method: "POST";
  path: "/internal/session-chat";
  sessionToken: string;
  body: Uint8Array;
  visitorIP: string;
};
export type SigningDependencies = {
  now?: () => number; // integer Unix seconds, NOT milliseconds
  nonceBytes?: () => Uint8Array; // test injection; production uses randomBytes(32)
};

export class GatewayAssertionSigner {
  #secret: Buffer;
  #kid: string;
  #notBefore: number;
  #notAfter: number;
  #issuer: string;
  #audience: string;
  #source: string;
  #lifetime: number;
  #now: () => number;
  #nonce: () => Uint8Array;

  constructor(policy: AssertionSigningPolicy, dependencies: SigningDependencies = {}) {
    exactObject(policy, ["issuer", "audience", "ipSource", "currentKey", "lifetimeSeconds"]);
    requireValid([policy.issuer, policy.audience, policy.ipSource].every((v) => matches(v, identifier)));
    exactObject(policy.currentKey, ["kid", "secret", "notBefore", "notAfter"]);
    const key = policy.currentKey;
    requireValid(matches(key.kid, keyId));
    const secret = bytes(key.secret, 64, 32);
    requireValid(timestamp(key.notBefore) && timestamp(key.notAfter) && key.notAfter > key.notBefore);
    requireValid(Number.isInteger(policy.lifetimeSeconds) && policy.lifetimeSeconds >= 1 && policy.lifetimeSeconds <= 30);
    requireValid(dependencies !== null && typeof dependencies === "object");
    requireValid(Object.keys(dependencies).every((name) => name === "now" || name === "nonceBytes"));
    requireValid(dependencies.now === undefined || typeof dependencies.now === "function");
    requireValid(dependencies.nonceBytes === undefined || typeof dependencies.nonceBytes === "function");
    this.#secret = secret;
    this.#kid = key.kid;
    this.#notBefore = key.notBefore;
    this.#notAfter = key.notAfter;
    this.#issuer = policy.issuer;
    this.#audience = policy.audience;
    this.#source = policy.ipSource;
    this.#lifetime = policy.lifetimeSeconds;
    this.#now = dependencies.now ?? (() => Math.floor(Date.now() / 1000));
    this.#nonce = dependencies.nonceBytes ?? (() => randomBytes(32));
  }

  sign(request: AssertionRequest): string {
    exactObject(request, ["method", "path", "sessionToken", "body", "visitorIP"]);
    requireValid(request.method === ASSERTION_METHOD && request.path === ASSERTION_PATH);
    const session = sessionBytes(request.sessionToken);
    const body = bytes(request.body, 8192);
    const address = canonicalVisitorIP(request.visitorIP);
    const iat = this.#now();
    requireValid(timestamp(iat));
    const exp = iat + this.#lifetime;
    requireValid(timestamp(exp) && this.#notBefore <= iat && exp <= this.#notAfter);
    const nonce = bytes(this.#nonce(), 32, 32);
    requireValid(new Set(nonce).size > 1);
    const header = { typ: ASSERTION_PROTOCOL, alg: "HS256", kid: this.#kid };
    const payload = {
      v: 1, iss: this.#issuer, aud: this.#audience, scope: "session:chat",
      method: request.method, path: request.path, iat, exp, jti: nonce.toString("base64url"),
      session_sha256: createHash("sha256").update(session).digest("hex"),
      body_sha256: createHash("sha256").update(body).digest("hex"),
      visitor_ip: address, ip_source: this.#source,
    };
    const encodedHeader = Buffer.from(JSON.stringify(header), "ascii");
    const encodedPayload = Buffer.from(JSON.stringify(payload), "ascii");
    requireValid(encodedHeader.length <= 256 && encodedPayload.length <= 1024);
    const input = `${encodedHeader.toString("base64url")}.${encodedPayload.toString("base64url")}`;
    const signature = createHmac("sha256", this.#secret).update(input, "ascii").digest();
    const compact = `${input}.${signature.toString("base64url")}`;
    requireValid(compact.length <= 2048);
    return compact;
  }

  // Explicit destruction for callers managing rotation; a destroyed signer fails closed.
  destroy(): void {
    this.#secret.fill(0);
    this.#notAfter = 0;
  }
}
