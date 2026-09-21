const EMAIL = 'admin@bdnews.com';
const PASSWORD = 'admin123';

export default async function run(page, ui) {
  const snap = await ui.snapshot();
  const email = snap.match(/@(e\d+) textbox "admin@bdnews\.com"/)?.[1];
  const pass = snap.match(/@(e\d+) textbox "••••••••"/)?.[1];
  const btn = snap.match(/@(e\d+) button "Sign In"/)?.[1];
  if (!email || !pass || !btn) return { error: 'missing refs', snap };

  await ui.fill(email, EMAIL);
  await ui.fill(pass, PASSWORD);
  await ui.click(btn);
  await page.waitForTimeout(4000);

  const check = () =>
    page.evaluate(() => {
      const els = [...document.querySelectorAll('a, button')];
      return els
        .filter((el) => /bg-primary-500/.test(el.className))
        .map((el) => ({
          text: el.textContent?.trim().slice(0, 30),
          bg: getComputedStyle(el).backgroundColor,
        }));
    });

  const pages = ['/articles', '/media', '/settings', '/collections', '/homepage', '/ads'];
  const results = {};
  for (const p of pages) {
    await page.goto(`http://localhost:5174${p}`);
    await page.waitForTimeout(1500);
    results[p] = await check();
  }
  return results;
}
