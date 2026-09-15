const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');

async function run() {
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  try {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      const respond = body => request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.pathname === '/api/public/members/settings') return respond({ terms: [], questions: [{ key: 'email', label: '이메일', inputType: 'email', required: true }], emailVerification: true });
      if (url.pathname === '/api/public/members/session') return respond({ member: null });
      if (request.method() !== 'GET') return request.abort();
      return request.continue();
    });
    const base = process.env.THEME_TEST_URL || 'http://localhost:3000';
    await page.goto(base + '/applicant/signup');
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => localStorage.setItem('applyhub.theme', theme), theme);
      for (const width of [320, 390, 1440]) {
        await page.setViewport({ width, height: 1000 });
        await page.reload({ waitUntil: 'networkidle2' });
        await page.click('[data-applicant-form="member-terms"] button[type=submit]');
        for (const action of ['member-send-code', 'member-verify-code']) {
          // Explicitly exercise CSS states; this test never sends or verifies email.
          const styles = await page.$eval(`[data-applicant-action="${action}"]`, el => {
            const read = () => { const s = getComputedStyle(el); return { background: s.backgroundColor, image: s.backgroundImage, color: s.color, opacity: s.opacity, shadow: s.boxShadow, cursor: s.cursor, width: el.getBoundingClientRect().width }; };
            el.disabled = false; const enabled = read();
            el.disabled = true; const disabled = read();
            return { enabled, disabled };
          });
          assert.notEqual(styles.enabled.image, 'none', action);
          assert.equal(styles.enabled.color, 'rgb(255, 255, 255)');
          assert.notEqual(styles.enabled.shadow, 'none');
          assert.equal(styles.disabled.image, 'none');
          assert.notEqual(styles.disabled.color, styles.enabled.color);
          assert.equal(styles.disabled.opacity, '1');
          assert.equal(styles.disabled.shadow, 'none');
          assert.equal(styles.disabled.cursor, 'not-allowed');
          assert.equal(styles.enabled.width, styles.disabled.width);
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      }
    }
    console.log('PASS: clearly distinct verification button styles in light/dark at 320, 390 and 1440px');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
