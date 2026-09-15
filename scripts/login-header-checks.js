const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

async function runLoginHeaderChecks({ services, base, call }) {
  const system = services.systemService;
  const settings = await system.getSystemSettings();
  const branding = await system.getSuperAdminSettings();
  await system.updateSystemSettings({ ...settings, admissionHomepageUrl: 'https://example.test/admission' });
  await system.updateSuperAdminSettings({ ...branding, schoolName: '테스트대학교' });
  const notice = await call('/api/login-notice', null, '', 'GET');
  assert.equal(notice.status, 200);
  assert.equal(notice.body.admissionHomepageUrl, 'https://example.test/admission');
  assert.equal(notice.body.initialPassword, undefined);
  assert.equal(notice.body.systemSettings, undefined);
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => { errors.push(`Unexpected ${dialog.type()} dialog`); void dialog.accept(); });
    const artifacts = path.resolve(__dirname, '../.tmp-login-header');
    fs.mkdirSync(artifacts, { recursive: true });
    for (const width of [320, 390, 1440]) {
      await page.setViewport({ width, height: 844 });
      await page.goto(base + '/login', { waitUntil: 'networkidle2' });
      await page.waitForSelector('a.login-home-link');
      const layout = await page.$eval('.login-stage-header', header => {
        const bounds = el => { const rect = el.getBoundingClientRect(); return { left: rect.left, right: rect.right, center: rect.x + rect.width / 2 }; };
        const link = header.querySelector('.login-home-link');
        return { header: bounds(header), brand: bounds(header.querySelector('.login-stage-brand')), link: bounds(link), theme: bounds(header.querySelector('applyhub-theme-toggle')), href: link.href, target: link.target, rel: link.rel, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert(Math.abs(layout.brand.center - layout.header.center) < 1);
      assert(layout.link.right <= layout.brand.left);
      assert(layout.brand.right <= layout.theme.left);
      assert.equal(layout.href, 'https://example.test/admission');
      assert.equal(layout.target, '_blank');
      assert.match(layout.rel, /noopener/);
      assert.equal(layout.overflow, false);
      await page.screenshot({ path: path.join(artifacts, `login-${width}.png`), fullPage: true });
      console.log(`PASS: ${width}px centered login branding, separate header buttons and configured homepage link`);
    }
    await system.updateSystemSettings({ ...settings, admissionHomepageUrl: '/admission' });
    await system.updateSuperAdminSettings({ ...branding, schoolName: '아주긴학교이름을가진테스트대학교' });
    await page.setViewport({ width: 320, height: 844 });
    await page.goto(base + '/login', { waitUntil: 'networkidle2' });
    assert.equal(await page.$eval('a.login-home-link', el => el.href), base + '/admission');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await system.updateSystemSettings({ ...settings, admissionHomepageUrl: '' });
    await page.reload({ waitUntil: 'networkidle2' });
    assert(await page.$('.login-home-link:disabled'));
    assert.equal(await page.$('a.login-home-link'), null);
    assert.deepEqual(errors, []);
    console.log('PASS: relative homepage URL, long school name and disabled unconfigured shortcut');
  } finally { await browser.close(); }
}

module.exports = { runLoginHeaderChecks };
