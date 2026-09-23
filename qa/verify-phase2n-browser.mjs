import { spawn, execSync } from 'node:child_process';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config({ path: new URL('../.env', import.meta.url).pathname.slice(1) });

const base = 'http://localhost:5173';
const api = 'http://localhost:3001/api/v1';
const outputDir = new URL('./screenshots/phase-2n/', import.meta.url);
await mkdir(outputDir, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'phase2n-chrome-'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--remote-debugging-port=9334', `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-default-apps', 'about:blank',
], { stdio: 'ignore' });
const prisma = new PrismaClient();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const email = `phase2n-browser-${Date.now()}@example.com`;
const password = 'ReaderPass!2468';
let userId;
let nextId = 0;
const pending = new Map();
const consoleErrors = [];
const failedRequests = [];

async function debuggerTarget() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch('http://127.0.0.1:9334/json'); if (r.ok) return (await r.json()).find((x) => x.type === 'page'); } catch {}
    await delay(200);
  }
  throw new Error('Chrome debugging endpoint did not start');
}

const target = await debuggerTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.id && pending.has(msg.id)) {
    const item = pending.get(msg.id); pending.delete(msg.id);
    return msg.error ? item.reject(new Error(msg.error.message)) : item.resolve(msg.result);
  }
  if (msg.method === 'Network.loadingFailed' && !msg.params.canceled) failedRequests.push(msg.params.errorText);
  if (msg.method === 'Runtime.exceptionThrown') consoleErrors.push(msg.params.exceptionDetails.text);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') consoleErrors.push(msg.params.args.map((x) => x.value ?? x.description).join(' '));
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
  pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
// 900ms was fine while the dev server was already warm mid-session, but a freshly (re)started
// `npm run dev` needs noticeably longer than that for its first several navigations while Vite
// pre-bundles deps and does its first real compile of each route — bumped for reliability.
const navigate = async (path) => { await send('Page.navigate', { url: `${base}${path}` }); await delay(3500); };
const viewport = (width) => send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
const inspect = () => evaluate(`({url:location.pathname,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,brokenImages:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).length,heading:document.querySelector('h1')?.textContent||''})`);
const shot = async (name) => writeFile(new URL(`${name}.png`, outputDir), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64'));
const setValue = (selector, value) => evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el) throw new Error('Missing ${selector}'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
const clickText = (selector, text) => evaluate(`(() => { const el=[...document.querySelectorAll(${JSON.stringify(selector)})].find(x=>x.textContent.trim()===${JSON.stringify(text)}); if(!el) throw new Error('Missing ${text}'); el.click(); return true; })()`);

try {
  await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable')]);
  await viewport(1280);
  await navigate('/register');
  const registrationForm = await evaluate(`({name:document.querySelectorAll('form input:not([type])').length,email:document.querySelectorAll('input[type=email]').length,passwords:document.querySelectorAll('input[type=password]').length,submit:document.querySelectorAll('form button').length})`);
  if (registrationForm.name !== 1 || registrationForm.email !== 1 || registrationForm.passwords !== 2 || registrationForm.submit !== 1) throw new Error(`Registration form incomplete: ${JSON.stringify(registrationForm)}`);
  const registration = await fetch(`${api}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName: 'Browser Reader', email, password }) });
  if (!registration.ok) throw new Error(`Registration failed: ${registration.status}`);
  const registrationData = await registration.json();
  userId = registrationData.user.id;
  const verification = await fetch(`${api}/auth/verify-email`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: registrationData.verificationToken }) });
  if (!verification.ok) throw new Error(`Verification failed: ${verification.status}`);
  await navigate('/login');
  const loginForm = await evaluate(`({email:document.querySelectorAll('input[type=email]').length,password:document.querySelectorAll('input[type=password]').length,forgot:[...document.querySelectorAll('a')].some(a=>a.getAttribute('href')==='/forgot-password')})`);
  if (loginForm.email !== 1 || loginForm.password !== 1 || !loginForm.forgot) throw new Error(`Login form incomplete: ${JSON.stringify(loginForm)}`);
  const login = await fetch(`${api}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!login.ok) throw new Error(`Login failed: ${login.status}`);
  const loginData = await login.json();
  await evaluate(`localStorage.setItem('reader-auth-storage',${JSON.stringify(JSON.stringify({ state: { user: loginData.user, accessToken: loginData.accessToken, refreshToken: loginData.refreshToken }, version: 0 }))})`);
  await navigate('/account');

  const pages = ['/login', '/register', '/account', '/account/profile', '/account/settings', '/account/saved'];
  const widths = [390, 768, 834, 1024, 1280, 1440, 1920];
  const responsive = [];
  for (const width of widths) {
    await viewport(width);
    for (const path of pages.slice(2)) { await navigate(path); responsive.push({ width, path, ...(await inspect()) }); }
    for (const path of pages.slice(0, 2)) { await navigate(path); responsive.push({ width, path, ...(await inspect()) }); }
  }

  await viewport(390); await navigate('/account/profile'); await shot('profile-390');
  const profileUpdate = await fetch(`${api}/reader/me`, { method: 'PATCH', headers: { 'content-type': 'application/json', Authorization: `Bearer ${loginData.accessToken}` }, body: JSON.stringify({ displayName: 'Browser Reader Updated', phone: '+8801700000000', location: 'Dhaka', bio: 'Browser verified profile', profilePublic: true }) });
  if (!profileUpdate.ok) throw new Error(`Profile update failed: ${profileUpdate.status}`);
  await navigate('/account/profile'); await delay(700);
  const profileSaved = await evaluate(`document.querySelector('input:not([type]):not([disabled])')?.value==='Browser Reader Updated' && document.body.innerText.includes('Dhaka')`);

  const themeUpdate = await fetch(`${api}/reader/me`, { method: 'PATCH', headers: { 'content-type': 'application/json', Authorization: `Bearer ${loginData.accessToken}` }, body: JSON.stringify({ theme: 'DARK' }) });
  if (!themeUpdate.ok) throw new Error(`Theme update failed: ${themeUpdate.status}`);
  await viewport(1280); await navigate('/account/settings'); await delay(700);
  const darkApplied = await evaluate(`document.documentElement.classList.contains('dark') && localStorage.getItem('news-theme')==='DARK' && [...document.querySelectorAll('label')].find(x=>x.textContent.trim()==='Dark')?.querySelector('input')?.checked===true`);
  await shot('settings-dark-1280');

  const auth = await evaluate(`JSON.parse(localStorage.getItem('reader-auth-storage')).state`);
  const articles = await fetch(`${api}/public/articles?limit=1`).then((r) => r.json());
  const article = articles.data?.[0];
  if (!article) throw new Error('No public article available for save verification');
  const saveResponse = await fetch(`${api}/reader/bookmarks/${article.id}`, { method: 'POST', headers: { Authorization: `Bearer ${auth.accessToken}` } });
  if (!saveResponse.ok) throw new Error(`Save article failed: ${saveResponse.status}`);
  await navigate('/account/saved'); await delay(700);
  const savedVisible = await evaluate(`document.body.innerText.includes(${JSON.stringify(article.title)})`);
  await shot('saved-1280');

  await navigate('/account');
  const accountToggle = await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Browser Reader')); if(!b) return false; b.click(); return true; })()`);
  await delay(200);
  const accountMenuVisible = await evaluate(`!!document.querySelector('#reader-account-menu a[href="/account/profile"]') && !!document.querySelector('#reader-account-menu a[href="/account/saved"]') && !!document.querySelector('#reader-account-menu a[href="/account/settings"]')`);
  await clickText('button', 'Logout'); await delay(900);
  await viewport(1280); await navigate('/');
  const anonymousDesktopLinks = await evaluate(`[...document.querySelectorAll('a')].some(a=>a.getAttribute('href')==='/login'&&a.offsetParent!==null) && [...document.querySelectorAll('a')].some(a=>a.getAttribute('href')==='/register'&&a.offsetParent!==null)`);
  await viewport(390); await navigate('/');
  await evaluate(`document.querySelector('button[aria-controls="mobile-navigation"]').click()`); await delay(150);
  const anonymousMobileLinks = await evaluate(`!document.querySelector('#mobile-navigation').hidden && document.querySelector('#mobile-navigation').innerText.includes('সাইন ইন') && document.querySelector('#mobile-navigation').innerText.includes('নিবন্ধন')`);
  await navigate('/account/profile'); await delay(500);
  const protectedRedirect = await evaluate(`location.pathname.endsWith('/login')`);
  const report = { registration: true, login: true, profileSaved, darkApplied, savedVisible, accountToggle, accountMenuVisible, logout: true, anonymousDesktopLinks, anonymousMobileLinks, protectedRedirect, responsive, consoleErrors, failedRequests };
  console.log(JSON.stringify(report, null, 2));
  if (!profileSaved || !darkApplied || !savedVisible || !accountToggle || !accountMenuVisible || !anonymousDesktopLinks || !anonymousMobileLinks || !protectedRedirect || responsive.some((x) => x.overflow || x.brokenImages) || consoleErrors.length || failedRequests.length) process.exitCode = 1;
} finally {
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect(); ws.close();
  // chrome.kill() only signals the top dispatcher process — its renderer/GPU children survive it and
  // leak one Chrome tree per run. `taskkill /T` kills the whole process tree.
  try { execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: 'ignore' }); } catch { chrome.kill(); }
  await delay(400);
  try { await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
}
