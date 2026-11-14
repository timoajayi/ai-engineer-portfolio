// Explicit offline check of BOTH production implementations, never cloud access.
import assert from 'node:assert/strict';
import { createLocalHarness } from './helpers/local-security-harness.mjs';
const index = process.argv.indexOf('--backend');
if (index < 0) throw new Error('Explicit --backend checkout required');
const h = await createLocalHarness(process.argv[index + 1], { production: true });
try {
  const issued = await h.browserRequest('/api/chat/session', { proof: 'proof-valid-production-fixture' });
  assert.equal(issued.status, 201);
  const cookie = issued.headers.get('set-cookie').split(';')[0];
  const forged = await h.browserRequest('/api/chat', { message: 'BundesHost?' }, cookie,
    { 'x-forwarded-for': '198.51.100.99' });
  assert.equal(forged.status, 503); assert.equal((await h.rpc('stats')).generation, 0);
  assert.equal((await h.browserRequest('/api/chat', { message: 'BundesHost?' }, cookie)).status, 200);
  const capture = h.captures.at(-1);
  assert.equal((await h.rpc('request', capture)).status, 403); // Exact signed replay.
  const changed = { ...capture, body: capture.body + ' ' };
  assert.equal((await h.rpc('request', changed)).status, 403);
  assert.equal((await h.rpc('stats')).generation, 1);
  // Render adds its own proxy metadata. It must not replace the visitor claim.
  h.setMutator(c => { c.headers['x-forwarded-for'] = '198.51.100.88'; });
  assert.equal((await h.browserRequest('/api/chat', { message: 'BundesHost?' }, cookie)).status, 200);
  h.setMutator(undefined);
  assert.equal((await h.browserRequest('/api/chat', { message: 'BundesHost?' }, cookie)).status, 200);
  assert.equal((await h.browserRequest('/api/chat', { message: 'BundesHost?' }, cookie)).status, 503);
  assert.equal((await h.rpc('stats')).generation, 3);
  console.log('PASS actual Vercel adapter → Node assertion → Render production composition → verified session/replay/admission → mocked RAG answer; spoofing, replay, modified body and excess admission denied');
} finally { await h.close(); }
