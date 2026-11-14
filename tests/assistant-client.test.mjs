import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import ts from 'typescript';

function client(fetch) {
  const source = readFileSync(new URL('../src/lib/assistant-client.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  return new Script(`(function(){const exports={};${outputText};return exports;})()`)
    .runInNewContext({ fetch });
}
test('browser uses only proof/session and message/chat same-origin contracts', async () => {
  const calls = [];
  const api = client(async (path, init) => {
    calls.push([path, init]);
    return Response.json(path.endsWith('/session') ? { status: 'ready' } : { answer: 'Grounded answer.' });
  });
  const signal = new AbortController().signal;
  await api.requestVerifiedSession('proof-valid', signal);
  assert.equal(await api.requestAssistantAnswer('BundesHost?', signal), 'Grounded answer.');
  assert.deepEqual(calls.map(([path]) => path), ['/api/chat/session', '/api/chat']);
  for (const [, options] of calls) {
    assert.equal(options.credentials, 'same-origin'); assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store'); assert.equal(options.signal, signal);
    assert.deepEqual(Object.keys(options.headers), ['Content-Type']);
  }
  assert.deepEqual(JSON.parse(calls[0][1].body), { proof: 'proof-valid' });
  assert.deepEqual(JSON.parse(calls[1][1].body), { message: 'BundesHost?' });
});
test('invalid proof does not fetch, and failures never retry or display server details', async () => {
  let calls = 0;
  const api = client(async () => { calls++; return new Response('PRIVATE SERVER DATA', { status: 503 }); });
  for (const proof of ['', 'invalid proof', 'proof\n', 'x'.repeat(2049)]) {
    await assert.rejects(api.requestVerifiedSession(proof, new AbortController().signal));
  }
  assert.equal(calls, 0);
  await assert.rejects(api.requestVerifiedSession('valid-proof', new AbortController().signal), (error) => {
    assert.ok(!error.message.includes('PRIVATE')); return error.status === 503;
  });
  assert.equal(calls, 1);
});
test('unexpected secret-bearing session JSON and answer metadata are rejected', async () => {
  const api = client(async () => Response.json({ status: 'ready', token: 'not-accepted' }));
  await assert.rejects(api.requestVerifiedSession('proof-valid', new AbortController().signal));
  const answer = client(async () => Response.json({ answer: 'Text', debug: 'private' }));
  await assert.rejects(answer.requestAssistantAnswer('Question', new AbortController().signal));
});
