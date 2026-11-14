// Actual React UI + actual Next handlers + real backend guards, entirely offline.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalHarness } from './helpers/local-security-harness.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const backendArg = process.argv.indexOf('--backend');
if (backendArg < 0) throw new Error('Explicit --backend checkout required');
const chromeArg = process.argv.indexOf('--chrome');
const chromePath = chromeArg >= 0 ? process.argv[chromeArg + 1] : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!existsSync(chromePath)) throw new Error('Installed Chrome required; pass --chrome. No download is performed.');
const temporary = mkdtempSync(join(tmpdir(), 'portfolio-chat-security-'));
const require = createRequire(import.meta.url);
const { webpack } = require('next/dist/compiled/webpack/webpack');
const loader = join(temporary, 'typescript.cjs');
writeFileSync(loader, `const ts=require(${JSON.stringify(join(root, 'node_modules/typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText};`);
const cssLoader = join(temporary, 'css.cjs'); writeFileSync(cssLoader, 'module.exports=function(){return ""};');
await new Promise((done, reject) => {
  const compiler = webpack({ mode: 'production', target: 'web', context: root,
    entry: join(root, 'tests/helpers/chat-ui-entry.tsx'), output: { path: temporary, filename: 'ui.js' },
    devtool: false, optimization: { minimize: false },
    resolve: { extensions: ['.tsx', '.ts', '.mjs', '.js', '.json'], modules: [join(root, 'node_modules')] },
    module: { rules: [{ test: /\.tsx?$/, use: loader }, { test: /\.css$/, use: cssLoader }] },
  });
  compiler.run((error, stats) => compiler.close(() => {
    if (error || stats.hasErrors()) reject(error ?? new Error(stats.toString({ all: false, errors: true })));
    else done();
  }));
});
function styles(directory) {
  if (!existsSync(directory)) return '';
  return readdirSync(directory, { withFileTypes: true }).map((item) => item.isDirectory()
    ? styles(join(directory, item.name)) : item.name.endsWith('.css') ? readFileSync(join(directory, item.name), 'utf8') : '').join('\n');
}
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles(join(root, '.next/static'))}</style></head><body style="background:#09090b"><div id="app"></div><script>${readFileSync(join(temporary, 'ui.js'), 'utf8').replaceAll('</script', '<\\/script')}</script></body></html>`;
const harness = await createLocalHarness(process.argv[backendArg + 1]);
// The backend fixture starts at a fixed date. Real browsers reject cookies whose
// absolute expiry is in their past, so advance only the disposable fixture clock.
await harness.advance(Math.max(0, Math.ceil((Date.now() - harness.now) / 1000)));
const chrome = spawn(chromePath, ['--headless=new', '--remote-debugging-pipe', '--disable-background-networking',
  '--disable-component-update', '--disable-sync', '--no-first-run', '--no-default-browser-check',
  '--host-resolver-rules=MAP * ~NOTFOUND', `--user-data-dir=${join(temporary, 'chrome')}`, 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
let sequence = 0, buffer = '', session, interceptionFailure;
const pending = new Map();
let chromeExited = false;
chrome.once('exit', () => {
  chromeExited = true;
  for (const operation of pending.values()) operation.reject(new Error('Chrome exited before completing the offline browser test'));
  pending.clear();
});
const requests = [];
const browserErrors = [];
function send(method, params = {}, sessionId = session) {
  if (chromeExited) return Promise.reject(new Error('Chrome is not running'));
  return new Promise((resolveResult, reject) => {
    const id = ++sequence; pending.set(id, { resolve: resolveResult, reject });
    chrome.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
  });
}
chrome.stdio[4].on('data', (part) => {
  buffer += part.toString(); let end;
  while ((end = buffer.indexOf('\0')) >= 0) {
    const raw = buffer.slice(0, end); buffer = buffer.slice(end + 1); if (!raw) continue;
    const message = JSON.parse(raw);
    if (pending.has(message.id)) {
      const operation = pending.get(message.id); pending.delete(message.id);
      if (message.error) operation.reject(new Error(JSON.stringify(message.error))); else operation.resolve(message.result);
    } else if (message.method === 'Fetch.requestPaused') {
      void intercept(message.params).catch((error) => { interceptionFailure = error; });
    } else if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.text);
  }
});
async function fulfill(id, status, body, headers = { 'content-type': 'text/html' }) {
  await send('Fetch.fulfillRequest', { requestId: id, responseCode: status,
    responseHeaders: Object.entries(headers).map(([name, value]) => ({ name, value })),
    body: Buffer.from(body).toString('base64') });
}
async function intercept({ requestId, request }) {
  const url = new URL(request.url);
  if (url.origin === 'https://portfolio.example.test' && url.pathname === '/') return fulfill(requestId, 200, html);
  if (url.origin === 'https://challenges.cloudflare.com') {
    // No network: this is a mock widget responding at the fixed script URL.
    return fulfill(requestId, 200, `window.turnstile={render:function(element,options){window.__verification=options;return 'offline-widget';},remove:function(){window.__verification=null;}};`, { 'content-type': 'application/javascript' });
  }
  if (url.origin === 'https://portfolio.example.test' && ['/api/chat', '/api/chat/session'].includes(url.pathname)) {
    requests.push(url.pathname);
    const response = await harness.handleRequest(new Request(request.url, { method: request.method,
      headers: request.headers, body: request.postData }));
    return fulfill(requestId, response.status, await response.text(), Object.fromEntries(response.headers));
  }
  // Fonts/icons/other traffic never reach the network.
  return fulfill(requestId, 404, '', { 'content-type': 'text/plain' });
}
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  if (interceptionFailure) throw interceptionFailure;
  return result.result.value;
}
async function wait(expression) {
  for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(40); }
  throw new Error('Browser condition timed out: ' + expression + ' | ' + JSON.stringify({ requests, errors: browserErrors, text: await evaluate('document.body.innerText') }));
}
async function click(selector) {
  const point = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
  await pause(60);
}
async function enter() {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
}
const safety = setTimeout(() => { chrome.kill(); process.exitCode = 1; }, 60_000);
try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, undefined);
  ({ sessionId: session } = await send('Target.attachToTarget', { targetId, flatten: true }, undefined));
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'https://portfolio.example.test/' });
  await wait(`!!document.querySelector('[aria-haspopup="dialog"]')`);
  await click('[aria-haspopup="dialog"]');
  await wait('!!window.__verification');
  assert.equal(requests.length, 0);
  await click('[role="dialog"] input'); await send('Input.insertText', { text: 'What is BundesHost?' });
  await click('[aria-label="Send message"]');
  assert.equal(requests.length, 0); // No proof means no issuance and no paid call.
  await evaluate(`window.__verification.callback('proof-valid-browser')`);
  await click('[aria-label="Send message"]');
  await wait(`document.querySelector('[role="log"]').textContent.includes('Offline test answer.')`);
  assert.deepEqual(requests, ['/api/chat/session', '/api/chat']);
  const cookies = await send('Network.getCookies', { urls: ['https://portfolio.example.test/'] });
  const cookie = cookies.cookies.find((item) => item.name === '__Host-portfolio-chat');
  assert.ok(cookie?.httpOnly && cookie.secure && cookie.sameSite === 'Strict');
  assert.ok(!(await evaluate('document.cookie')).includes('__Host-portfolio-chat'));
  assert.equal((await harness.rpc('stats')).generation, 1);
  console.log('PASS actual UI open → mocked bot proof → real session gateway/backend issuance → real browser HttpOnly cookie → signed authenticated session-chat → RAG/mock Gemini → rendered answer');
  await click('[role="dialog"] input'); await send('Input.insertText', { text: 'Which skills?' }); await enter();
  await wait(`document.querySelectorAll('.portfolio-assistant-markdown').length===2`);
  await click('[role="dialog"] button:not([aria-label])'); // New chat keeps the existing session.
  await click('[role="dialog"] .portfolio-assistant-scrollable button');
  await wait(`document.querySelectorAll('.portfolio-assistant-markdown').length===1`);
  assert.equal(requests.filter((path) => path.endsWith('/session')).length, 1);
  assert.equal((await harness.rpc('stats')).generation, 3);
  await click('[aria-label="Close AI assistant"]');
  assert.ok(await evaluate(`document.activeElement===document.querySelector('[aria-haspopup="dialog"]')`));
  await click('[aria-haspopup="dialog"]');
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 400, deviceScaleFactor: 1, mobile: true });
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
  assert.ok(await evaluate(`!!document.querySelector('[role="dialog"] [role="log"]')&&!!document.querySelector('[role="dialog"] label')`));
  assert.deepEqual(browserErrors, []);
  console.log('PASS Send, Enter, suggestion, New chat/session reuse, close/reopen/focus, 320px short layout and accessible labels; no real network/provider calls');
} finally {
  clearTimeout(safety); await send('Browser.close').catch(() => {}); chrome.kill(); await harness.close();
}
