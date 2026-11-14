// Test-only server composition. No source module or production route imports it.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { loadGatewayModules } from './chat-gateway-loader.mjs';

export async function createLocalHarness(backend, { production = false } = {}) {
  const child = spawn(resolve(backend, '.venv/bin/python'), ['-B',
    new URL('./offline_backend_bridge.py', import.meta.url).pathname, '--backend', resolve(backend)],
    { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  let sequence = 0;
  const pending = new Map();
  let diagnostic = '';
  child.stderr.on('data', (part) => { diagnostic = (diagnostic + part.toString()).slice(-6000); });
  child.on('exit', () => {
    for (const operation of pending.values()) {
      clearTimeout(operation.timer); operation.reject(new Error('Offline backend bridge exited: ' + diagnostic));
    }
    pending.clear();
  });
  createInterface({ input: child.stdout }).on('line', (line) => {
    const message = JSON.parse(line), operation = pending.get(message.id);
    if (!operation) return;
    pending.delete(message.id); clearTimeout(operation.timer);
    if (message.error) operation.reject(new Error('Offline backend fixture: ' + message.error));
    else operation.resolve(message.result);
  });
  function rpc(action, parameters = {}) {
    return new Promise((resolveResult, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Offline fixture deadline')); }, 15_000);
      pending.set(id, { resolve: resolveResult, reject, timer });
      child.stdin.write(JSON.stringify({ id, action, ...parameters }) + '\n');
    });
  }
  const modules = loadGatewayModules();
  let metadata;
  let clock;
  let captures = [];
  let mutate;
  let visitorIP = '192.0.2.10';
  class SyntheticIdentity extends modules.identity.TrustedVisitorIdentityProvider {
    constructor() { super(metadata.policy); }
    async resolveEvidence(context) {
      return { visitorIP, ingressPolicy: metadata.policy, requestId: context.requestId, evidenceId: 'offline-only-evidence' };
    }
  }
  async function upstream(url, init) {
    const capture = { path: new URL(url).pathname, method: init.method,
      body: typeof init.body === 'string' ? init.body : Buffer.from(init.body).toString('utf8'),
      headers: Object.fromEntries(new Headers(init.headers)) };
    captures.push(capture);
    if (mutate) mutate(capture);
    const response = await rpc('request', capture);
    return new Response(response.body, { status: response.status, headers: response.headers });
  }
  let session, chat;
  async function reset() {
    metadata = await rpc('reset', { production }); clock = metadata.now; captures = []; mutate = undefined; visitorIP = '192.0.2.10';
    const environment = { CHAT_ENABLED: 'true', CHAT_SESSION_ENABLED: 'true', APP_ORIGIN: 'https://portfolio.example.test',
      AI_ASSISTANT_BACKEND_URL: 'https://backend.example.test', AI_ASSISTANT_CHAT_TOKEN: 'c'.repeat(43),
      AI_ASSISTANT_BACKEND_TOKEN: 'i'.repeat(43), GATEWAY_ASSERTION_ISSUER: 'portfolio-gateway',
      GATEWAY_ASSERTION_AUDIENCE: 'portfolio-backend', GATEWAY_ASSERTION_KEY_ID: 'gateway-key-1',
      GATEWAY_ASSERTION_KEY: Buffer.from(metadata.key, 'hex').toString('base64url'),
      GATEWAY_ASSERTION_KEY_NOT_BEFORE: '0', GATEWAY_ASSERTION_KEY_NOT_AFTER: '253402300799',
      GATEWAY_INGRESS_POLICY: metadata.policy };
    session = modules.load('src/lib/server/session-gateway.ts').createSessionGateway({
      readEnvironment: () => environment, fetch: upstream, now: () => clock,
    });
    chat = production ? modules.load('src/lib/server/vercel-chat.ts').createVercelChatGateway({
      readEnvironment: () => environment, fetch: upstream, now: () => clock,
      readRuntime: () => ({ VERCEL: '1', VERCEL_ENV: 'production', NODE_ENV: 'production' }),
    }) : modules.gateway.createChatGateway({ readEnvironment: () => environment, fetch: upstream,
      now: () => clock, identityProvider: new SyntheticIdentity() });
  }
  await reset();
  return {
    rpc, reset,
    async advance(seconds) { clock = (await rpc('advance', { seconds })).now; },
    setMutator(fn) { mutate = fn; },
    setVisitor(ip) { visitorIP = ip; },
    get captures() { return captures; },
    get now() { return clock; },
    async browserRequest(path, body, cookie = '', extra = {}) {
      const request = new Request('https://portfolio.example.test' + path, { method: 'POST',
        headers: { Origin: 'https://portfolio.example.test', 'Content-Type': 'application/json',
          ...(production ? { 'x-vercel-forwarded-for': visitorIP, 'x-forwarded-for': visitorIP } : {}),
          ...(cookie ? { Cookie: cookie } : {}), ...extra },
        body: typeof body === 'string' ? body : JSON.stringify(body) });
      return (path === '/api/chat/session' ? session : chat)(request);
    },
    async handleRequest(request) { return (new URL(request.url).pathname === '/api/chat/session' ? session : chat)(request); },
    async close() { child.stdin.end(); await new Promise((done) => child.once('exit', done)); },
  };
}
