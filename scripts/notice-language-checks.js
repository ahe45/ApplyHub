const assert = require('node:assert/strict');
const path = require('node:path');

async function runNoticeLanguageChecks({ services, call, adminPage, page, memberPage, go, language, artifacts }) {
  let editor = '#loginNoticeEditor';
  const edit = html => adminPage.$eval(editor, (element, value) => {
    element.innerHTML = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, html);
  const choose = async locale => {
    editor = locale === 'en' ? '#loginNoticeEditorEn' : '#loginNoticeEditor';
    await adminPage.focus(editor);
    await adminPage.waitForSelector(`[data-notice-canvas=${locale}].is-active`);
  };
  const save = async () => {
    const [response] = await Promise.all([
      adminPage.waitForResponse(response => response.request().method() === 'PUT' && response.url().endsWith('/api/login-notice')),
      adminPage.click(`[data-notice-canvas=${editor.endsWith('En') ? 'en' : 'ko'}] [data-notice-action=save]`),
    ]);
    assert.equal(response.status(), 200);
    await adminPage.waitForFunction(() => document.querySelectorAll('[data-notice-editor-language]').length === 2 && !document.activeElement.closest('[data-notice-editor-language]'));
    return response.json();
  };
  assert.equal((await call('/api/login-notice', { scope: 'login', language: 'en', html: 'unauthorized' }, '', 'PUT')).status, 401);
  await go(adminPage, '/login-notice');
  await adminPage.waitForSelector(editor);
  await adminPage.setViewport({ width: 1440, height: 1000 });
  assert.equal(await adminPage.$$eval('[data-notice-editor-language]', elements => elements.filter(el => el.getClientRects().length).length), 2);
  assert.equal(await adminPage.$('[data-notice-language]'), null, 'Languages are displayed together without tabs');
  for (const width of [1280, 1440, 1920]) {
    await adminPage.setViewport({ width, height: 1000 });
    assert(await adminPage.evaluate(() => {
      const ko = document.querySelector('[data-notice-canvas=ko]').getBoundingClientRect();
      const en = document.querySelector('[data-notice-canvas=en]').getBoundingClientRect();
      return Math.abs(ko.top - en.top) < 1 && en.left >= ko.right && document.documentElement.scrollWidth <= innerWidth + 1;
    }), `Both canvases fit side by side at ${width}px`);
  }
  await adminPage.setViewport({ width: 1440, height: 1000 });
  for (const scope of ['login', 'applicant']) {
    await adminPage.click(`[data-notice-scope=${scope}]`);
    await choose('ko');
    assert((await adminPage.$eval(editor, el => el.textContent)).includes('직접 작성한 안내입니다.'));
    const korean = `${scope} 한국어 안내`;
    const english = `${scope} English notice`;
    await edit(`<p><strong>${korean}</strong></p><p>접수하기</p>`);
    await choose('en');
    assert.equal(await adminPage.$eval(editor, el => el.textContent.trim()), '', 'New English notice starts empty');
    await edit(`<p><strong>${english}</strong></p><p><a href="https://example.test/notice">Read details</a></p>`);
    const koreanDraft = await adminPage.$eval('#loginNoticeEditor', el => el.innerHTML);
    await adminPage.$eval(editor, el => {
      const range = document.createRange();
      range.selectNodeContents(el.querySelector('a'));
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    await adminPage.click('[data-notice-command=italic]');
    assert(await adminPage.$eval(`${editor} a`, el => getComputedStyle(el).fontStyle === 'italic' || getComputedStyle(el.firstElementChild || el).fontStyle === 'italic'), 'Shared toolbar formats the English canvas');
    assert.equal(await adminPage.$eval('#loginNoticeEditor', el => el.innerHTML), koreanDraft, 'Formatting English leaves Korean unchanged');
    await adminPage.keyboard.down('Control'); await adminPage.keyboard.press('z'); await adminPage.keyboard.up('Control');
    assert(await adminPage.$eval(`${editor} a`, el => getComputedStyle(el).fontStyle !== 'italic'), 'Undo restores the English canvas');
    assert.equal(await adminPage.$eval('#loginNoticeEditor', el => el.innerHTML), koreanDraft, 'English undo leaves Korean history unchanged');
    await choose('ko');
    assert((await adminPage.$eval(editor, el => el.textContent)).includes(korean), 'Korean draft survives canvas focus changes');
    await save();
    await choose('en');
    assert((await adminPage.$eval(editor, el => el.textContent)).includes(english), 'Saving Korean preserves the English draft');
    await adminPage.click(`[data-notice-scope=${scope === 'login' ? 'applicant' : 'login'}]`);
    await adminPage.click(`[data-notice-scope=${scope}]`);
    assert((await adminPage.$eval(editor, el => el.textContent)).includes(english), 'Screen drafts stay separate');
    assert.equal((await save()).language, 'en');
    await adminPage.reload({ waitUntil: 'networkidle0' });
    await adminPage.waitForSelector(editor);
    await adminPage.click(`[data-notice-scope=${scope}]`);
    await choose('en');
    assert.equal(await adminPage.$eval(`${editor} strong`, el => el.textContent), english, 'English content and formatting persist');
    assert.equal(await adminPage.$eval(`${editor} a`, el => el.getAttribute('href')), 'https://example.test/notice');
    await adminPage.screenshot({ path: path.join(artifacts, `${scope}-notice-bilingual-canvases.png`), fullPage: true });

    const publicPage = scope === 'login' ? page : memberPage;
    await go(publicPage, scope === 'login' ? '/login' : '/applicant');
    await publicPage.waitForSelector('.login-notice-content');
    await language(publicPage, 'en');
    assert.equal(await publicPage.$eval('.login-notice-content strong', el => el.textContent), english);
    assert((await publicPage.$eval('.public-glass-notice-preview', el => el.textContent)).includes(english));
    await publicPage.click('.public-glass-notice summary');
    await language(publicPage, 'ko');
    assert(await publicPage.$eval('.public-glass-notice', el => el.open), 'Switching language preserves expansion');
    assert.equal(await publicPage.$eval('.login-notice-content strong', el => el.textContent), korean);
    await language(publicPage, 'en');
    assert.equal(await publicPage.$eval('.login-notice-content strong', el => el.textContent), english);
    await publicPage.screenshot({ path: path.join(artifacts, `${scope}-notice-english.png`), fullPage: true });

    await adminPage.bringToFront();
    await edit('<p><br></p>');
    assert.equal((await save()).html, '', 'English notice can be cleared');
    assert.equal(await services.systemService.getLoginNoticeHtml(scope, 'en'), '');
    assert((await services.systemService.getLoginNoticeHtml(scope)).includes(korean), 'Clearing English preserves Korean');
    await go(publicPage, scope === 'login' ? '/login' : '/applicant');
    await publicPage.waitForSelector('.login-notice-content strong');
    assert.equal(await publicPage.$eval('.login-notice-content strong', el => el.textContent), korean, 'English mode falls back to Korean');
    await adminPage.reload({ waitUntil: 'networkidle0' });
    await adminPage.waitForSelector(editor);
    await adminPage.click(`[data-notice-scope=${scope}]`);
    await choose('en');
    assert.equal(await adminPage.$eval(editor, el => el.textContent.trim()), '', 'Cleared English remains empty after reload');
  }
  await adminPage.setViewport({ width: 390, height: 844 });
  assert(await adminPage.evaluate(() => {
    const ko = document.querySelector('[data-notice-canvas=ko]').getBoundingClientRect();
    const en = document.querySelector('[data-notice-canvas=en]').getBoundingClientRect();
    return en.top >= ko.bottom && document.documentElement.scrollWidth <= innerWidth + 1;
  }), 'Narrow screens stack the canvases without overflow');
  await adminPage.setViewport({ width: 1440, height: 1000 });
  console.log('PASS: simultaneous bilingual notice canvases, focus and toolbar isolation, responsive layout, save/reload, public language switching and fallback');
}

module.exports = { runNoticeLanguageChecks };
