const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { normalizeSignupTerms, signupTermsVersion, buildSignupConsent } = require('../server/modules/applications/signup-terms');

async function runTermsLanguageChecks({ services, members, query, base, call }) {
  const originalConsents = await query('SELECT id, consent_json FROM applicant_members ORDER BY id');
  const original = await members.getSettings();
  const term = original.terms[0];
  assert.equal(term.titleEn, '');
  assert.equal(term.textEn, '');
  assert.throws(() => normalizeSignupTerms({ terms: [{ ...term, titleEn: 'x'.repeat(101) }] }), /영어 약관 제목/);
  assert.throws(() => normalizeSignupTerms({ terms: [{ ...term, textEn: 'x'.repeat(30001) }] }), /영어 약관 내용/);
  await query('UPDATE accounts SET password_temporary = 0');
  const { initialPassword } = await services.systemService.getSystemSettings();
  const login = await call('/api/auth/login', { id: 'admin', password: initialPassword });
  assert.equal(login.status, 200);
  const artifacts = path.resolve('.tmp-terms-language');
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const errors = [];
  const go = (page, route) => page.goto(base + route, { waitUntil: 'networkidle0' });
  try {
    const context = await browser.createBrowserContext();
    const at = login.cookie.indexOf('=');
    await context.setCookie({ name: login.cookie.slice(0, at), value: login.cookie.slice(at + 1), url: base });
    const admin = await context.newPage();
    admin.on('pageerror', error => errors.push(error.message));
    await admin.setViewport({ width: 1440, height: 1000 });
    await go(admin, '/applicant-question-template-management?tab=terms');
    await admin.waitForSelector('[data-term-select]');
    await admin.click('[data-term-select]');
    const titleEn = 'Consent to personal data use';
    const textEn = 'Please read these terms.\nYour data is used for admissions. <b>Plain text</b>';
    await admin.type('[data-term-input=titleEn]', titleEn);
    await admin.type('[data-term-input=textEn]', textEn);
    assert(await admin.$eval('.signup-term-language-grid', el => { const [ko, en] = el.children; return ko.getBoundingClientRect().top === en.getBoundingClientRect().top && ko.getBoundingClientRect().right < en.getBoundingClientRect().left; }));
    await admin.screenshot({ path: path.join(artifacts, 'terms-editor.png'), fullPage: true });
    const [saved] = await Promise.all([
      admin.waitForResponse(response => response.url().endsWith('/api/applicant-signup-settings') && response.request().method() === 'PUT'),
      admin.click('[data-term-form] button[type=submit]'),
    ]);
    assert.equal(saved.status(), 200);
    let settings = await members.getSettings();
    assert.equal(settings.terms[0].titleEn, titleEn);
    assert.equal(settings.terms[0].textEn, textEn);
    assert.equal(settings.terms[0].text, term.text);
    await admin.reload({ waitUntil: 'networkidle0' });
    await admin.click('[data-term-select]');
    assert.equal(await admin.$eval('[data-term-input=textEn]', el => el.value), textEn);
    const version = signupTermsVersion(settings);
    const payload = { termsVersion: version, termConsents: [{ id: term.id, agreed: true }], language: 'en' };
    const consent = buildSignupConsent(settings, payload);
    assert.equal(consent.language, 'en');
    assert.equal(consent.terms[0].textEn, textEn);
    assert.equal(consent.terms[0].text, term.text);
    const changed = { ...settings, terms: [{ ...settings.terms[0], textEn: textEn + ' Updated.' }] };
    assert.notEqual(signupTermsVersion(changed), version);
    assert.throws(() => buildSignupConsent(changed, payload), /약관이 변경/);
    const visitor = await browser.createBrowserContext();
    const page = await visitor.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 390, height: 844 });
    await go(page, '/applicant/signup');
    await page.waitForSelector('.applicant-member-terms-text');
    assert.equal(await page.$eval('.applicant-member-terms-text', el => el.textContent), term.text);
    await page.click('[data-member-term]');
    await page.click('[data-language=en]');
    await page.waitForFunction(text => document.querySelector('.applicant-member-terms-text')?.textContent === text, {}, textEn);
    assert.equal(await page.$eval('.applicant-member-terms-heading [data-i18n-ko]', el => el.textContent), titleEn);
    assert.equal(await page.$('.applicant-member-terms-text b'), null, 'Authored terms remain plain text');
    assert(await page.$eval('[data-member-term]', el => el.checked));
    await page.click('[data-member-term-view]');
    assert.equal(await page.$eval('#member-term-dialog-title', el => el.textContent), titleEn);
    assert.equal(await page.$eval('[data-member-term-content]', el => el.textContent), textEn);
    await page.screenshot({ path: path.join(artifacts, 'terms-english.png') });
    await page.click('[data-member-term-close]');
    await page.click('[data-language=ko]');
    await page.waitForFunction(text => document.querySelector('.applicant-member-terms-text')?.textContent === text, {}, term.text);
    assert(await page.$eval('[data-member-term]', el => el.checked));
    await page.click('[data-language=en]');
    settings = await members.saveSettings({ ...settings, terms: settings.terms.map(item => ({ ...item, titleEn: '', textEn: '' })) });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.applicant-member-terms-text');
    assert.equal(await page.$eval('html', el => el.lang), 'en');
    assert.equal(await page.$eval('.applicant-member-terms-text', el => el.textContent), term.text);
    assert.deepEqual(await query('SELECT id, consent_json FROM applicant_members ORDER BY id'), originalConsents);
    assert.deepEqual(errors, []);
    console.log('PASS: bilingual terms editing, persistence, language switching, full text, Korean fallback, versioning and preserved consent history');
  } finally { await browser.close(); }
}

module.exports = { runTermsLanguageChecks };
