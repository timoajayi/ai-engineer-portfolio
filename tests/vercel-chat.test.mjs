import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadGatewayModules } from './helpers/chat-gateway-loader.mjs';

const environment = {
  VERCEL: '1', VERCEL_ENV: 'production', NODE_ENV: 'production', CHAT_ENABLED: 'true',
  APP_ORIGIN: 'https://portfolio.example.test', AI_ASSISTANT_BACKEND_URL: 'https://backend.example.test',
  AI_ASSISTANT_CHAT_TOKEN: 'c'.repeat(43), AI_ASSISTANT_BACKEND_TOKEN: 'i'.repeat(43),
  GATEWAY_ASSERTION_ISSUER: 'portfolio-gateway', GATEWAY_ASSERTION_AUDIENCE: 'portfolio-backend',
  GATEWAY_ASSERTION_KEY_ID: 'gateway-key-1', GATEWAY_ASSERTION_KEY: Buffer.alloc(32, 7).toString('base64url'),
  GATEWAY_ASSERTION_KEY_NOT_BEFORE: '0', GATEWAY_ASSERTION_KEY_NOT_AFTER: '253402300799',
  GATEWAY_INGRESS_POLICY: 'vercel-direct-v1',
};
function harness(overrides = {}) {
  const calls = [];
  const { POST } = loadGatewayModules({ process: { env: { ...environment, ...overrides } }, fetch: async (...args) => {
    calls.push(args); return Response.json({ answer: 'Offline answer.' });
  } }).load('src/app/api/chat/route.ts');
  return { handle: POST, calls };
}
function request(headers = {}) {
  return new Request(environment.APP_ORIGIN + '/api/chat', { method: 'POST',
    headers: { Origin: environment.APP_ORIGIN, 'Content-Type': 'application/json',
      Cookie: '__Host-portfolio-chat=' + Buffer.alloc(32, 11).toString('base64url'),
      'x-vercel-forwarded-for': '192.0.2.42', 'x-forwarded-for': '192.0.2.42', 'x-real-ip': '192.0.2.42', ...headers },
    body: JSON.stringify({ message: 'BundesHost?' }) });
}
test('actual production route signs only the dedicated Vercel ingress identity', async () => {
  const h = harness(); const result = await h.handle(request());
  assert.equal(result.status, 200); assert.equal(h.calls.length, 1);
  const [url, init] = h.calls[0];
  assert.equal(new URL(url).pathname, '/internal/session-chat');
  const headers = new Headers(init.headers);
  assert.deepEqual([...headers.keys()].sort(), ['authorization','content-type','x-portfolio-gateway-assertion','x-portfolio-session']);
  const payload = JSON.parse(Buffer.from(headers.get('x-portfolio-gateway-assertion').split('.')[1], 'base64url'));
  assert.equal(payload.visitor_ip, '192.0.2.42'); assert.equal(payload.ip_source, 'vercel-direct-v1');
});
test('Vercel runtime attestation cannot be provided by HTTP headers or previews/local mode', async () => {
  for (const overrides of [{ VERCEL: undefined }, { VERCEL: 'true' }, { VERCEL_ENV: 'preview' },
    { NODE_ENV: 'development' }, { GATEWAY_INGRESS_POLICY: 'unapproved' }, { CHAT_ENABLED: undefined }]) {
    const h = harness(overrides);
    assert.equal((await h.handle(request({ vercel: '1', 'vercel-env': 'production' }))).status, 503);
    assert.equal(h.calls.length, 0);
  }
});
test('missing invalid duplicate/list identity and spoofed conflicting aliases fail closed', async () => {
  for (const value of ['', 'unknown', '192.0.2.42, 198.51.100.2', '::1%zone', '192.0.2.1:123', '01.2.3.4']) {
    const h = harness(); assert.equal((await h.handle(request({ 'x-vercel-forwarded-for': value }))).status, 503);
    assert.equal(h.calls.length, 0);
  }
  const missing = request(); missing.headers.delete('x-vercel-forwarded-for');
  const h = harness(); assert.equal((await h.handle(missing)).status, 503); assert.equal(h.calls.length, 0);
  for (const name of ['x-forwarded-for','x-real-ip']) {
    const h = harness(); assert.equal((await h.handle(request({ [name]: '198.51.100.99' }))).status, 503);
    assert.equal(h.calls.length, 0);
  }
});
test('IPv6 is canonicalized and unsupported browser identity/authorization remains rejected', async () => {
  const h = harness();
  assert.equal((await h.handle(request(Object.fromEntries(['x-vercel-forwarded-for','x-forwarded-for','x-real-ip']
    .map(name => [name, '2001:0db8:0:0::1']))))).status, 200);
  const payload = JSON.parse(Buffer.from(new Headers(h.calls[0][1].headers).get('x-portfolio-gateway-assertion').split('.')[1], 'base64url'));
  assert.equal(payload.visitor_ip, '2001:db8::1');
  for (const name of ['authorization','x-portfolio-client-ip','cf-connecting-ip']) {
    const h = harness(); assert.equal((await h.handle(request({ [name]: 'spoofed' }))).status, 403);
    assert.equal(h.calls.length, 0);
  }
});
test('production adapter keeps origin, session, configuration and disabled guards', async () => {
  for (const headers of [{ Origin: 'https://other.example' }, { Cookie: '' }]) {
    const h = harness(); assert.notEqual((await h.handle(request(headers))).status, 200); assert.equal(h.calls.length, 0);
  }
  for (const key of ['AI_ASSISTANT_CHAT_TOKEN','GATEWAY_ASSERTION_KEY','APP_ORIGIN']) {
    const h = harness({ [key]: undefined }); assert.equal((await h.handle(request())).status, 503); assert.equal(h.calls.length, 0);
  }
  const oversized = harness();
  assert.equal((await oversized.handle(request({ forwarded: 'x'.repeat(8192) }))).status, 503);
  assert.equal(oversized.calls.length, 0);
});
