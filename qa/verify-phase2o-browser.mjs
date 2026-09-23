import { spawn, execSync } from 'node:child_process';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config({ path: new URL('../.env', import.meta.url).pathname.slice(1) });

const web = 'http://localhost:5173';
const admin = 'http://localhost:5174';
const api = 'http://localhost:3001/api/v1';
const outputDir = new URL('./screenshots/phase-2o/', import.meta.url);
await mkdir(outputDir, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'phase2o-chrome-'));
const chrome = spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, [
  '--headless=new', '--remote-debugging-port=9339', `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-default-apps', 'about:blank',
], { stdio: 'ignore' });
const prisma = new PrismaClient();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const marker = `phase2o-browser-${Date.now()}`;
const readerEmail = `${marker}-reader@example.com`;
const readerPassword = 'ReaderPass!2468';
let readerId;
let employerId;
let jobId;
let nextId = 0;
const pending = new Map();
const consoleErrors = [];
const failedRequests = [];

async function debuggerTarget() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch('http://127.0.0.1:9339/json'); if (r.ok) return (await r.json()).find((x) => x.type === 'page'); } catch {}
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
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
  pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
const navigate = async (url) => { await send('Page.navigate', { url }); await delay(3500); };
const viewport = (width) => send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
const inspect = () => evaluate(`({url:location.pathname,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,brokenImages:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).length,heading:document.querySelector('h1')?.textContent||''})`);
const shot = async (name) => writeFile(new URL(`${name}.png`, outputDir), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64'));

const report = { responsive: [], consoleErrors, failedRequests };

try {
  await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable')]);

  // ---------- Setup via API: admin login, employer + job creation, workflow to PUBLISHED ----------
  const adminLogin = await fetch(`${api}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@bdnews.com', password: process.env.SEED_ADMIN_PASSWORD || 'admin123' }) });
  if (!adminLogin.ok) throw new Error(`Admin login failed: ${adminLogin.status}`);
  const adminAuth = await adminLogin.json();
  const adminHeaders = { 'content-type': 'application/json', Authorization: `Bearer ${adminAuth.accessToken}` };

  const category = await fetch(`${api}/job-categories`, { headers: adminHeaders }).then((r) => r.json());
  const categoryId = category[0]?.id;
  if (!categoryId) throw new Error('No job category available — seed may not have run');

  const employer = await fetch(`${api}/employers`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ name: marker, industry: 'Technology' }) }).then((r) => r.json());
  employerId = employer.id;

  const job = await fetch(`${api}/jobs`, {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({
      title: `${marker} Software Engineer`, employerId, categoryId, employmentType: 'FULL_TIME', workplaceType: 'REMOTE',
      summary: 'Browser-verified job posting for Phase 2O.', applicationMethod: 'INTERNAL',
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  }).then((r) => r.json());
  jobId = job.id;

  await fetch(`${api}/jobs/${jobId}/submit-review`, { method: 'POST', headers: adminHeaders });
  await fetch(`${api}/jobs/${jobId}/approve`, { method: 'POST', headers: adminHeaders });
  const publishResp = await fetch(`${api}/jobs/${jobId}/publish`, { method: 'POST', headers: adminHeaders });
  if (!publishResp.ok) throw new Error(`Publish failed: ${publishResp.status}`);
  const published = await publishResp.json();
  const jobSlug = published.slug;

  // ---------- Register + verify a reader account ----------
  const registration = await fetch(`${api}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName: 'Browser Job Seeker', email: readerEmail, password: readerPassword }) });
  if (!registration.ok) throw new Error(`Registration failed: ${registration.status}`);
  const registrationData = await registration.json();
  readerId = registrationData.user.id;
  await fetch(`${api}/auth/verify-email`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: registrationData.verificationToken }) });
  const readerLogin = await fetch(`${api}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: readerEmail, password: readerPassword }) });
  const readerAuth = await readerLogin.json();

  // ---------- Public web: /jobs listing ----------
  await viewport(1280);
  await navigate(`${web}/en/jobs`);
  const listingCheck = await evaluate(`({search:document.querySelectorAll('input[type=text]').length,categorySelect:!!document.querySelector('select'),jobLinks:[...document.querySelectorAll('a')].filter(a=>a.getAttribute('href')?.startsWith('/jobs/')).length})`);
  if (listingCheck.search < 1 || !listingCheck.categorySelect) throw new Error(`Jobs listing missing search/filter controls: ${JSON.stringify(listingCheck)}`);
  await shot('jobs-listing-1280');

  // ---------- Public web: job detail page ----------
  await navigate(`${web}/en/jobs/${jobSlug}`);
  const detailCheck = await evaluate(`({title:document.querySelector('h1')?.textContent||'',hasApply:/apply/i.test(document.body.innerText),hasSave:/save/i.test(document.body.innerText)})`);
  if (!detailCheck.title.includes('Software Engineer')) throw new Error(`Job detail title mismatch: ${JSON.stringify(detailCheck)}`);
  if (!detailCheck.hasApply) throw new Error('Job detail page missing Apply action');
  await shot('job-detail-1280');

  // ---------- Reader: login via localStorage injection (same technique as Phase 2N script), save job, apply ----------
  await evaluate(`localStorage.setItem('reader-auth-storage',${JSON.stringify(JSON.stringify({ state: { user: readerAuth.user, accessToken: readerAuth.accessToken, refreshToken: readerAuth.refreshToken }, version: 0 }))})`);
  await navigate(`${web}/en/jobs/${jobSlug}`);
  await delay(500);
  const saveResp = await fetch(`${api}/reader/saved-jobs/${jobId}`, { method: 'POST', headers: { Authorization: `Bearer ${readerAuth.accessToken}` } });
  if (!saveResp.ok) throw new Error(`Save job failed: ${saveResp.status}`);

  const applyResp = await fetch(`${api}/reader/job-applications/${jobId}`, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${readerAuth.accessToken}` }, body: JSON.stringify({ coverLetter: 'Browser-verified application.' }) });
  if (!applyResp.ok) throw new Error(`Apply failed: ${applyResp.status}`);
  const application = await applyResp.json();

  await navigate(`${web}/en/account/saved-jobs`);
  await delay(500);
  const savedJobsVisible = await evaluate(`document.body.innerText.includes(${JSON.stringify(job.title)})`);
  await shot('saved-jobs-1280');

  await navigate(`${web}/en/account/applications`);
  await delay(500);
  const applicationsVisible = await evaluate(`document.body.innerText.includes(${JSON.stringify(job.title)}) && document.body.innerText.includes('SUBMITTED')`);
  await shot('my-applications-1280');

  // ---------- Admin: staff moves the application to SHORTLISTED, reader sees the updated status ----------
  const statusResp = await fetch(`${api}/job-applications/${application.id}/status`, { method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ status: 'SHORTLISTED', note: 'Browser-verified shortlist' }) });
  if (!statusResp.ok) throw new Error(`Admin status update failed: ${statusResp.status}`);
  const statusAfterPatch = await statusResp.json();
  const verifyResp = await fetch(`${api}/reader/job-applications/${application.id}`, { headers: { Authorization: `Bearer ${readerAuth.accessToken}` } }).then((r) => r.json());
  await navigate(`${web}/en/account/applications`);
  await delay(500);
  const statusUpdatedVisible = await evaluate(`document.body.innerText.includes('SHORTLISTED')`);
  if (!statusUpdatedVisible) throw new Error(`Reader did not see updated SHORTLISTED status. patchStatus=${JSON.stringify(statusAfterPatch.status)} apiVerify=${JSON.stringify(verifyResp.status)} bodyText=${await evaluate('document.body.innerText.slice(0,600)')}`);

  // ---------- Admin panel: login, dashboard, jobs list, categories, employers, applications ----------
  // localStorage is per-origin — admin (5174) is a different origin from web (5173), so the reader
  // localStorage write above is invisible here. Navigate to the admin origin FIRST, then write its
  // own auth-storage key, then navigate again to the actual protected page.
  await navigate(`${admin}/login`);
  await evaluate(`localStorage.setItem('auth-storage',${JSON.stringify(JSON.stringify({ state: { user: adminAuth.user, accessToken: adminAuth.accessToken, refreshToken: adminAuth.refreshToken, isAuthenticated: true }, version: 0 }))})`);
  await navigate(`${admin}/jobs`);
  const dashboardCheck = await evaluate(`document.body.innerText.includes('Published') && document.body.innerText.includes('Jobs')`);
  if (!dashboardCheck) throw new Error('Admin jobs dashboard did not render expected content');
  await shot('admin-jobs-dashboard-1280');

  await navigate(`${admin}/jobs/all`);
  await delay(1000);
  const adminJobsListVisible = await evaluate(`document.body.innerText.includes(${JSON.stringify(job.title)})`);
  if (!adminJobsListVisible) {
    const diag = await evaluate(`({bodyText: document.body.innerText.slice(0,800), rows: document.querySelectorAll('tbody tr').length})`);
    throw new Error(`Admin jobs list did not show the browser-created job (title=${JSON.stringify(job.title)}) diag=${JSON.stringify(diag)}`);
  }
  await shot('admin-jobs-list-1280');

  await navigate(`${admin}/jobs/${jobId}/edit`);
  const editorLoaded = await evaluate(`document.querySelector('#job-title')?.value === ${JSON.stringify(job.title)}`);
  if (!editorLoaded) throw new Error('Admin job editor did not load the job for editing');
  await shot('admin-job-editor-1280');

  await navigate(`${admin}/jobs/categories`);
  const categoriesVisible = await evaluate(`document.body.innerText.includes('Government') || document.body.innerText.includes('IT & Software')`);
  if (!categoriesVisible) throw new Error('Admin job categories page did not render seeded categories');

  await navigate(`${admin}/jobs/employers`);
  const employersVisible = await evaluate(`document.body.innerText.includes(${JSON.stringify(marker)})`);
  if (!employersVisible) throw new Error('Admin employers page did not show the browser-created employer');

  await navigate(`${admin}/jobs/applications`);
  const applicationsAdminVisible = await evaluate(`document.body.innerText.includes('Browser Job Seeker')`);
  if (!applicationsAdminVisible) throw new Error('Admin applications page did not show the browser-created application');
  await shot('admin-applications-1280');

  // ---------- Responsive sweep across all requested viewports ----------
  const widths = [390, 768, 834, 1024, 1280, 1440, 1920];
  const publicPages = [`/jobs`, `/jobs/${jobSlug}`, '/account/saved-jobs', '/account/applications'];
  const adminPages = ['/jobs', '/jobs/all', `/jobs/${jobId}/edit`, '/jobs/categories', '/jobs/employers', '/jobs/applications'];
  for (const width of widths) {
    await viewport(width);
    for (const path of publicPages) { await navigate(`${web}${path}`); report.responsive.push({ app: 'web', width, path, ...(await inspect()) }); }
    for (const path of adminPages) { await navigate(`${admin}${path}`); report.responsive.push({ app: 'admin', width, path, ...(await inspect()) }); }
  }

  report.listingCheck = listingCheck;
  report.detailCheck = detailCheck;
  report.savedJobsVisible = savedJobsVisible;
  report.applicationsVisible = applicationsVisible;
  report.statusUpdatedVisible = statusUpdatedVisible;
  report.dashboardCheck = dashboardCheck;
  report.adminJobsListVisible = adminJobsListVisible;
  report.editorLoaded = editorLoaded;
  report.categoriesVisible = categoriesVisible;
  report.employersVisible = employersVisible;
  report.applicationsAdminVisible = applicationsAdminVisible;

  console.log(JSON.stringify(report, null, 2));

  const overflowIssues = report.responsive.filter((r) => r.overflow || r.brokenImages);
  const allChecksPassed = savedJobsVisible && applicationsVisible && statusUpdatedVisible && dashboardCheck && adminJobsListVisible && editorLoaded && categoriesVisible && employersVisible && applicationsAdminVisible;
  if (!allChecksPassed || overflowIssues.length || consoleErrors.length || failedRequests.length) process.exitCode = 1;
} finally {
  // ---------- Cleanup: remove every record this run created ----------
  if (jobId) {
    await prisma.jobApplication.deleteMany({ where: { jobId } }).catch(() => {});
    await prisma.savedJob.deleteMany({ where: { jobId } }).catch(() => {});
    await prisma.jobAuditLog.deleteMany({ where: { jobId } }).catch(() => {});
    await prisma.job.deleteMany({ where: { id: jobId } }).catch(() => {});
  }
  if (employerId) await prisma.employer.deleteMany({ where: { id: employerId } }).catch(() => {});
  if (readerId) await prisma.user.deleteMany({ where: { id: readerId } }).catch(() => {});
  await prisma.$disconnect();
  ws.close();
  // chrome.kill() only signals the top dispatcher process Node tracked — Chrome's renderer/GPU child
  // processes survive it, leaking one Chrome tree per run. `taskkill /T` kills the whole process tree.
  try { execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: 'ignore' }); } catch { chrome.kill(); }
  await delay(400);
  try { await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
}
