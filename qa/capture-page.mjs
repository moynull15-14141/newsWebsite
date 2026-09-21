import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const [url, output, widthValue, heightValue, action] = process.argv.slice(2);
const width = Number(widthValue);
const height = Number(heightValue);
const port = 9333 + Math.floor(Math.random() * 500);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  `--remote-debugging-port=${port}`, `--user-data-dir=${process.env.TEMP}/news-qa-${port}`,
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let version;
for (let attempt = 0; attempt < 40; attempt += 1) {
  try {
    version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json());
    break;
  } catch {
    await sleep(100);
  }
}
if (!version) throw new Error('Chrome debugging endpoint did not start');

const tab = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }).then((response) => response.json());
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let sequence = 0;
const pending = new Map();
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id) return;
  const request = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});

await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
await send('Page.enable');
await send('Page.navigate', { url });
await sleep(5000);
await send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.documentElement.scrollHeight)' });
await sleep(1000);
await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)' });
await sleep(300);
if (action) {
  await send('Runtime.evaluate', {
    expression: `document.querySelector('[aria-label="${action}"]')?.click()`,
  });
  await sleep(500);
}
const metrics = await send('Runtime.evaluate', {
  expression: `JSON.stringify((()=>{const bn=document.querySelector('[lang="bn"]');const images=[...document.images];return {innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,font:getComputedStyle(document.body).fontFamily,headingFont:getComputedStyle(document.querySelector('h1,h2,h3')).fontFamily,bengaliFont:bn?getComputedStyle(bn).fontFamily:null,bengaliLineHeight:bn?getComputedStyle(bn).lineHeight:null,bengaliElements:document.querySelectorAll('[lang="bn"]').length,images:images.length,loadedImages:images.filter(image=>image.complete&&image.naturalWidth>0).length,placeholders:document.querySelectorAll('[aria-label="Image unavailable"]').length}})())`,
  returnByValue: true,
});
const layout = await send('Page.getLayoutMetrics');
const content = layout.cssContentSize || layout.contentSize;
const screenshot = await send('Page.captureScreenshot', {
  format: 'png', captureBeyondViewport: true,
  clip: { x: 0, y: 0, width: content.width, height: content.height, scale: 1 },
});
await mkdir(dirname(output), { recursive: true });
await writeFile(output, Buffer.from(screenshot.data, 'base64'));
console.log(metrics.result.value);
socket.close();
chrome.kill();
