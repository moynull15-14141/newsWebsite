import { spawn } from 'node:child_process';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config } from 'dotenv';

config({ path: new URL('../.env', import.meta.url).pathname.slice(1) });
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = await mkdtemp(join(tmpdir(), 'phase2l-chrome-'));
const outputDir = new URL('./screenshots/phase-2l/', import.meta.url);
await mkdir(outputDir, { recursive: true });
const port = 9333;
const chrome = spawn(chromePath, [`--headless=new`, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-default-apps', 'about:blank'], { stdio: 'ignore' });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let nextId = 0;
const pending = new Map();
const failures = [];
const consoleErrors = [];

async function waitForDebugger() {
  for (let i = 0; i < 50; i++) {
    try { const response = await fetch(`http://127.0.0.1:${port}/json`); if (response.ok) return response.json(); } catch {}
    await delay(200);
  }
  throw new Error('Chrome debugging endpoint did not start');
}

const targets = await waitForDebugger();
const pageTarget = targets.find((target) => target.type === 'page');
if (!pageTarget) throw new Error('Chrome did not expose a page target');
const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
    return message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  }
  if (message.method === 'Network.loadingFailed' && !message.params.canceled) failures.push(message.params.errorText);
  if (message.method === 'Runtime.exceptionThrown') consoleErrors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '));
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10_000);
  pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
const navigate = async (url) => { await send('Page.navigate', { url }); await delay(1200); };
const viewport = (width) => send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
const screenshot = async (name) => {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(new URL(`${name}.png`, outputDir), Buffer.from(result.data, 'base64'));
};
const inspect = () => evaluate(`({
  url: location.href,
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  brokenImages: [...document.images].filter(i => i.complete && i.naturalWidth === 0).length
})`);

try {
  await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable')]);
  const widths = [390, 768, 834, 1024, 1280, 1440, 1920];
  const publicResults = [];
  for (const width of widths) {
    await viewport(width); await navigate('http://localhost:5173/');
    publicResults.push({ width, ...(await inspect()) });
    await screenshot(`homepage-${width}`);
  }

  await viewport(1280); await navigate('http://localhost:5173/');
  const articleHref = await evaluate(`[...document.querySelectorAll('a[href^="/article/"]')].map(a=>a.getAttribute('href'))[0] || null`);
  const categoryHref = await evaluate(`[...document.querySelectorAll('a[href^="/category/"]')].map(a=>a.getAttribute('href'))[0] || null`);
  const secondaryPages = ['/latest', categoryHref, articleHref].filter(Boolean);
  const secondaryResults = [];
  for (const path of secondaryPages) {
    for (const width of [390, 1280]) {
      await viewport(width); await navigate(`http://localhost:5173${path}`);
      secondaryResults.push({ path, width, ...(await inspect()) });
    }
  }

  await viewport(1280); await navigate('http://localhost:5173/');
  const tickerExists = await evaluate(`!!document.querySelector('.bn-ticker-track-inner')`);
  let movesLeftToRight = null;
  let pausesOnHover = null;
  if (tickerExists) {
    const x1 = await evaluate(`new DOMMatrix(getComputedStyle(document.querySelector('.bn-ticker-track-inner')).transform).m41`);
    await delay(500);
    const x2 = await evaluate(`new DOMMatrix(getComputedStyle(document.querySelector('.bn-ticker-track-inner')).transform).m41`);
    movesLeftToRight = x2 > x1;
    const box = await evaluate(`(() => { const r=document.querySelector('.bn-ticker-track').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y }); await delay(150);
    const p1 = await evaluate(`new DOMMatrix(getComputedStyle(document.querySelector('.bn-ticker-track-inner')).transform).m41`);
    await delay(400);
    const p2 = await evaluate(`new DOMMatrix(getComputedStyle(document.querySelector('.bn-ticker-track-inner')).transform).m41`);
    pausesOnHover = Math.abs(p2 - p1) < 0.5;
  }
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await navigate('http://localhost:5173/');
  const reducedMotionStatic = await evaluate(`!document.querySelector('.bn-ticker-track-inner')`);
  await send('Emulation.setEmulatedMedia', { features: [] });

  const login = await fetch('http://localhost:3001/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@bdnews.com', password: process.env.SEED_ADMIN_PASSWORD }) });
  if (!login.ok) throw new Error(`Admin login failed with HTTP ${login.status}`);
  const auth = await login.json();
  await navigate('http://localhost:5174/');
  await evaluate(`localStorage.setItem('auth-storage', ${JSON.stringify(JSON.stringify({ state: { user: auth.user, accessToken: auth.accessToken, refreshToken: auth.refreshToken, isAuthenticated: true }, version: 0 }))})`);
  await navigate('http://localhost:5174/breaking-news');
  const adminPage = await inspect();
  const adminHeading = await evaluate(`document.body.innerText.includes('Breaking News')`);
  const newButton = await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('New Breaking News'))?.click(), true`);
  await delay(250);
  const dialogChecks = await evaluate(`({ dialog: !!document.querySelector('[role=dialog]'), preview: document.body.innerText.toLowerCase().includes('live preview'), color: !!document.querySelector('input[type=color]'), speed: !!document.querySelector('input[type=range]') })`);
  await screenshot('breaking-news-admin-1280');
  const adminResults = [];
  for (const width of widths) {
    await viewport(width); await delay(150);
    const state = await inspect();
    const dialogOverflow = await evaluate(`(() => { const el=document.querySelector('[role=dialog]'); return el ? el.scrollWidth > el.clientWidth : true; })()`);
    adminResults.push({ width, ...state, dialogOverflow });
    if (width === 390) await screenshot('breaking-news-admin-390');
  }

  const report = { publicResults, secondaryResults, tickerExists, movesLeftToRight, pausesOnHover, reducedMotionStatic, adminPage, adminHeading, newButton, dialogChecks, adminResults, consoleErrors, failedNetworkRequests: failures };
  console.log(JSON.stringify(report, null, 2));
  if (publicResults.some((row) => row.overflow || row.brokenImages) || secondaryResults.some((row) => row.overflow || row.brokenImages) || adminPage.overflow || adminResults.some((row) => row.overflow || row.brokenImages || row.dialogOverflow) || consoleErrors.length || failures.length || !adminHeading || !dialogChecks.dialog || !dialogChecks.preview || !dialogChecks.color || !dialogChecks.speed || (tickerExists && (!movesLeftToRight || !pausesOnHover)) || !reducedMotionStatic) process.exitCode = 1;
} finally {
  ws.close(); chrome.kill(); await delay(500); try { await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
}
