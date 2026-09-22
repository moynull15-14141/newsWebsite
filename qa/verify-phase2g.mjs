import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { config } from 'dotenv';

config({ path: '.env' });
const outputDir = 'qa/screenshots/phase-2g';
await mkdir(outputDir, { recursive: true });

const port = 9700 + Math.floor(Math.random() * 200);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  `--remote-debugging-port=${port}`, `--user-data-dir=${process.env.TEMP}/news-phase2g-${port}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browserVersion;
for (let attempt = 0; attempt < 50; attempt += 1) {
  try { browserVersion = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json()); break; } catch { await sleep(100); }
}
if (!browserVersion) throw new Error('Chrome debugging endpoint did not start');

const pageInfo = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then((response) => response.json());
const socket = new WebSocket(pageInfo.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sequence = 0;
const pending = new Map();
const consoleErrors = [];
const failedResponses = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id) {
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') consoleErrors.push(message.params.args.map((item) => item.value || item.description).join(' '));
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) failedResponses.push({ status: message.params.response.status, url: message.params.response.url });
    return;
  }
  const request = pending.get(message.id); pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
const navigate = async (url, waitFor) => { await send('Page.navigate', { url }); for (let attempt = 0; attempt < 60; attempt += 1) { if (await evaluate(`Boolean(${waitFor})`)) return; await sleep(250); } throw new Error(`Timed out loading ${url}`); };
const viewport = (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
const screenshot = async (name) => { const layout = await send('Page.getLayoutMetrics'); const size = layout.cssContentSize || layout.contentSize; const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 } }); await writeFile(`${outputDir}/${name}.png`, Buffer.from(shot.data, 'base64')); };

try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  const articlesResponse = await fetch('http://localhost:3001/api/v1/public/articles?page=1&limit=20&lang=bn').then((response) => response.json());
  const article = articlesResponse.data.find((item) => item.status === 'PUBLISHED') || articlesResponse.data[0];
  if (!article) throw new Error('No published Aiven article available for browser verification');

  await viewport(1440, 1000);
  await navigate(`http://localhost:5173/article/${article.slug}`, `document.querySelector('article h1') && document.querySelector('link[rel="canonical"]')`);
  const publicArticle = await evaluate(`(()=>{const json=JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);return {title:document.title,description:document.querySelector('meta[name="description"]')?.content,canonical:document.querySelector('link[rel="canonical"]')?.href,robots:document.querySelector('meta[name="robots"]')?.content,ogTitle:document.querySelector('meta[property="og:title"]')?.content,ogImage:document.querySelector('meta[property="og:image"]')?.content,twitter:document.querySelector('meta[name="twitter:card"]')?.content,hreflang:[...document.querySelectorAll('link[rel="alternate"][hreflang]')].map(x=>x.hreflang),schemaTypes:(json['@graph']||[json]).map(x=>x['@type']),overflow:document.documentElement.scrollWidth>innerWidth}})()`);
  await screenshot('public-article-desktop');
  await viewport(390, 844); await sleep(400);
  const publicMobile = await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth})`);
  await screenshot('public-article-mobile');

  await navigate('http://localhost:5173/search?q=news', `document.querySelector('meta[name="robots"]')`);
  const searchRobots = await evaluate(`document.querySelector('meta[name="robots"]')?.content`);

  await viewport(1440, 1000);
  await navigate('http://localhost:5174/login', `document.querySelector('form')`);
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  await evaluate(`(()=>{const set=(el,value)=>{const proto=el instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLTextAreaElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};set(document.querySelector('input[type="email"]'),'admin@bdnews.com');set(document.querySelector('input[type="password"]'),${JSON.stringify(adminPassword)});document.querySelector('form').requestSubmit();return true})()`);
  for (let attempt = 0; attempt < 60; attempt += 1) { if ((await evaluate(`location.pathname`)) !== '/login') break; await sleep(250); }

  await navigate('http://localhost:5174/seo', `document.body.innerText.includes('SEO Intelligence Center') && document.body.innerText.includes('Overall site health')`);
  const dashboard = await evaluate(`({text:document.querySelector('main')?.innerText.slice(0,2000),overflow:document.documentElement.scrollWidth>innerWidth})`);
  await screenshot('seo-dashboard-desktop');
  await viewport(390, 844); await sleep(400);
  const dashboardMobile = await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth})`);
  await screenshot('seo-dashboard-mobile');

  await viewport(1440, 1000);
  await navigate(`http://localhost:5174/articles/${article.id}/edit`, `document.body.innerText.includes('SEO Intelligence') && document.getElementById('article-title')`);
  const editorBefore = await evaluate(`(()=>{const section=[...document.querySelectorAll('section')].find(x=>x.innerText.includes('SEO Intelligence'));return {text:section?.innerText.slice(0,3000),score:section?.querySelector('[role="status"]')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth}})()`);
  await screenshot('article-editor-seo-desktop');
  await evaluate(`(()=>{const set=(id)=>{const el=document.getElementById(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'');el.dispatchEvent(new Event('input',{bubbles:true}));};set('article-title');set('seo-title');return true})()`);
  await sleep(400);
  const editorAfterScore = await evaluate(`([...document.querySelectorAll('section')].find(x=>x.innerText.includes('SEO Intelligence'))?.querySelector('[role="status"]')?.textContent)`);
  await viewport(390, 844); await sleep(400);
  const editorMobile = await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth})`);
  await screenshot('article-editor-seo-mobile');

  const robotsText = await fetch('http://localhost:5173/robots.txt').then((response) => response.text());
  const sitemapText = await fetch('http://localhost:5173/sitemap.xml').then((response) => response.text());
  const report = { article: { id: article.id, slug: article.slug }, publicArticle, publicMobile, searchRobots, dashboard, dashboardMobile, editorBefore, editorAfterScore, liveScoreChanged: editorBefore.score !== editorAfterScore, editorMobile, robots: { hasAdminBlock: robotsText.includes('Disallow: /admin'), hasSearchBlock: robotsText.includes('Disallow: /search'), sitemapDeclared: robotsText.includes('/seo/sitemap.xml') }, sitemap: { isIndex: sitemapText.includes('<sitemapindex'), articles: sitemapText.includes('article-sitemap.xml'), categories: sitemapText.includes('category-sitemap.xml'), tags: sitemapText.includes('tag-sitemap.xml'), authors: sitemapText.includes('author-sitemap.xml'), locations: sitemapText.includes('location-sitemap.xml') }, consoleErrors, failedResponses };
  console.log(JSON.stringify(report, null, 2));
} finally {
  socket.close(); chrome.kill();
}
