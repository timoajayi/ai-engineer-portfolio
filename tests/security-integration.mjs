import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createLocalHarness } from './helpers/local-security-harness.mjs';

const index = process.argv.indexOf('--backend');
if (index < 0 || !process.argv[index + 1]) throw new Error('Explicit --backend checkout required');
const h = await createLocalHarness(process.argv[index + 1]);
let assertions = 0;
async function status(response, expected) {
  assert.equal(response.status, expected); assertions++;
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return response;
}
async function issue(proof = 'proof-valid-session') {
  const response = await status(await h.browserRequest('/api/chat/session', { proof }), 201);
  assert.deepEqual(await response.json(), { status: 'ready' });
  return response.headers.get('set-cookie').split(';')[0];
}
async function noPaid() { const stats = await h.rpc('stats'); assert.equal(stats.generation, 0); assert.equal(stats.embedding, 0); }
try {
  const cookie = await issue();
  for (const message of ['What is BundesHost?', 'Which skills does Timothy use?']) {
    const response = await status(await h.browserRequest('/api/chat', { message }, cookie), 200);
    assert.deepEqual(await response.json(), { answer: 'Offline test answer.' });
  }
  const stats = await h.rpc('stats');
  assert.equal(stats.verification, 1); assert.equal(stats.generation, 2);
  assert.equal(stats.ledger.periods.day.admitted, 2); assert.equal(stats.ledger.active, 0);
  console.log('PASS real session gateway → mocked verification → HttpOnly cookie → signed Next gateway → real ASGI/auth/replay/SQLite/RAG → mocked Gemini');

  for (const proof of [null, '', 'proof-invalid', 'proof-expired']) {
    await h.reset();
    const response = await h.browserRequest('/api/chat/session', proof === null ? {} : { proof });
    assert.equal(response.status, proof === null || !proof ? 400 : 403); assertions++;
    assert.equal(response.headers.get('set-cookie'), null); await noPaid();
  }
  await h.reset(); await issue('proof-valid-replay');
  await status(await h.browserRequest('/api/chat/session', { proof: 'proof-valid-replay' }), 403); await noPaid();
  console.log('PASS missing, invalid, expired and replayed proof: zero paid calls');

  for (const cookie of ['', '__Host-portfolio-chat=invalid', '__Host-portfolio-chat=' + Buffer.alloc(32, 99).toString('base64url')]) {
    await h.reset();
    const response = await h.browserRequest('/api/chat', { message: 'BundesHost?' }, cookie);
    assert.equal(response.status, !cookie || cookie.endsWith('invalid') ? 401 : 502); assertions++;
    await noPaid();
  }
  await h.reset(); const expired = await issue(); await h.advance(14400);
  await status(await h.browserRequest('/api/chat', { message: 'BundesHost?' }, expired), 502); await noPaid();

  const alterations = [
    (c) => { delete c.headers.authorization; },
    (c) => { c.headers.authorization = 'Bearer ' + 'w'.repeat(43); },
    (c) => { c.headers.authorization = 'Bearer ' + 'i'.repeat(43); },
    (c) => { c.body += ' '; },
    (c) => { c.headers['x-portfolio-session'] = Buffer.alloc(32, 77).toString('base64url'); },
    (c) => { const parts = c.headers['x-portfolio-gateway-assertion'].split('.'); parts[2] = Buffer.alloc(32).toString('base64url'); c.headers['x-portfolio-gateway-assertion'] = parts.join('.'); },
  ];
  for (const alter of alterations) {
    await h.reset(); const cookie = await issue(); h.setMutator(alter);
    await status(await h.browserRequest('/api/chat', { message: 'BundesHost?' }, cookie), 502); await noPaid();
  }
  for (const modification of [{ visitor_ip: '192.0.2.99' }, { ip_source: 'unapproved-ingress' }, { iat: 0, exp: 30 }]) {
    await h.reset(); const cookie = await issue();
    h.setMutator((capture) => {
      const parts = capture.headers['x-portfolio-gateway-assertion'].split('.');
      parts[1] = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(parts[1], 'base64url')), ...modification })).toString('base64url');
      parts[2] = createHmac('sha256', Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1))).update(parts[0] + '.' + parts[1]).digest('base64url');
      capture.headers['x-portfolio-gateway-assertion'] = parts.join('.');
    });
    await status(await h.browserRequest('/api/chat', { message: 'BundesHost?' }, cookie), 502); await noPaid();
  }
  await h.reset(); const replayCookie = await issue();
  await status(await h.browserRequest('/api/chat', { message: 'BundesHost?' }, replayCookie), 200);
  const capture = h.captures.at(-1);
  assert.equal((await h.rpc('request', capture)).status, 403);
  assert.equal((await h.rpc('stats')).generation, 1); assertions++;
  console.log('PASS scoped auth, signature/body/session/IP/policy/expiry tampering and replay rejection');

  await h.reset(); const limited = await issue();
  for (let i = 0; i < 3; i++) await status(await h.browserRequest('/api/chat', { message: 'BundesHost?' }, limited), 200);
  await status(await h.browserRequest('/api/chat', { message: 'BundesHost?' }, limited), 503);
  assert.equal((await h.rpc('stats')).generation, 3);
  await h.reset();
  let admitted = 0, rejected = false;
  for (let session = 0; session < 4; session++) {
    const cookie = await issue('proof-valid-rotation-' + session);
    for (let request = 0; request < 3 && !rejected; request++) {
      const response = await h.browserRequest('/api/chat', { message: 'BundesHost?' }, cookie);
      if (response.status === 503) { rejected = true; break; }
      await status(response, 200);
      admitted++;
    }
    if (rejected) break;
  }
  // Issuance is also authenticated admission: three issuances plus seven chats
  // exhaust the existing shared ten-request window, before the IP ceiling.
  assert.ok(rejected);
  assert.equal(admitted, 7);
  assert.equal((await h.rpc('stats')).generation, admitted);
  assertions++;
  console.log('PASS rotating sessions still encounters shared admission controls before exceeding ten paid calls');
  await h.reset();
  for (let i = 0; i < 10; i++) await issue('proof-valid-farming-' + i);
  await status(await h.browserRequest('/api/chat/session', { proof: 'proof-valid-farming-11' }), 429);
  await noPaid();
  await h.reset(); const disabled = await issue(); await h.rpc('disable');
  await status(await h.browserRequest('/api/chat', { message: 'BundesHost?' }, disabled), 503); await noPaid();
  for (const path of ['/chat', '/chat/', '/internal/session-chat', '/internal/sessions']) {
    await h.reset();
    const result = await h.rpc('request', { path, body: '{"message":"BundesHost?"}', headers: { 'Content-Type': 'application/json' } });
    assert.notEqual(result.status, 200); assertions++; await noPaid();
  }
  console.log(`PASS session limit, emergency disable, direct/legacy denial; ${assertions} independent integrated boundary assertions`);
} finally { await h.close(); }
