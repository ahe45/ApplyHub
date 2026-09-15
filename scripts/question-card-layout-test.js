const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { renderApplicantFieldList } = require('../client/features/templates/renderers');

const root = path.resolve(__dirname, '..');
const styles = fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/<link rel="stylesheet"[^>]+>/g).join('\n');
const fields = [
  { id: 'terms', questionText: '유플러스시스템 이용약관 동의', questionDescription: '제1조 (목적) 이 약관은 유플러스시스템이 제공하는 원서접수 서비스의 이용 조건과 절차, 이용자의 권리 및 의무를 정합니다.', answerTypeLabel: '약관 동의', systemLabel: '사용 중', required: true },
  { id: 'long', questionText: '공백없는아주긴질문제목'.repeat(10), questionDescription: 'https://example.com/' + 'A'.repeat(240) + 'long-description-without-spaces'.repeat(100), answerTypeLabel: '파일 업로드', systemLabel: '일반 항목' },
  { id: 'multiline', questionText: '여러 줄 설명', questionDescription: '첫 번째 안내입니다.\n두 번째 안내입니다.\n\n마지막 안내입니다.', required: true },
  { id: 'short', questionText: '이름', questionDescription: '' },
  { id: 'whitespace', questionText: '이름', questionDescription: '  \n\t ' },
  { id: 'missing', questionText: '이름' },
  { id: 'null', questionText: '이름', questionDescription: null },
  { id: 'one-line', questionText: '이름', questionDescription: '이름을 입력하세요.' },
];
async function run() {
  const browser = await puppeteer.launch({ headless: true,
    executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  try {
    const page = await browser.newPage();
    let markup = '';
    const base = process.env.THEME_TEST_URL || 'http://localhost:3000';
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.isNavigationRequest() && request.url() === base + '/__question-card-layout-test__') {
        request.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: markup });
      } else request.continue();
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const artifacts = path.join(root, '.tmp-question-card-check');
    fs.mkdirSync(artifacts, { recursive: true });
    for (const theme of ['light', 'dark']) {
      for (const width of [320, 390, 720, 768, 1024, 1180, 1280, 1440]) {
        await page.setViewport({ width, height: 1000 });
        // Real production renderer and styles; no saved settings or user data are changed.
        markup = `<!doctype html><html lang="ko" data-theme="${theme}"><head><base href="${base}/">${styles}</head>
          <body><div class="app-shell"><aside class="sidebar"></aside><div class="page-shell"><main class="content-area">
          <div class="question-management-view"><div id="question-management-panel"><div id="signup-question-mount"><div id="signup-terms-editor" class="view-stack">
          <fieldset class="signup-question-controls"><section class="applicant-settings-layout"><article class="form-card applicant-settings-fields-panel">
          <div class="section-header"><h3>약관관리</h3></div>${renderApplicantFieldList(fields, {})}
          </article><div class="applicant-settings-side"><article class="form-card applicant-field-editor-panel"><h3>약관 수정</h3></article></div></section></fieldset>
          </div></div></div></div></main></div></div></body></html>`;
        await page.goto(base + '/__question-card-layout-test__', { waitUntil: 'networkidle2' });
        assert.equal(await page.$eval('.applicant-field-card', el => getComputedStyle(el).display), 'grid', 'production CSS must load');
        assert.equal(await page.$eval('body', el => getComputedStyle(el).colorScheme), theme);
        const failures = await page.evaluate(() => {
          const problems = [];
          if (document.documentElement.scrollWidth > innerWidth + 1) problems.push('page overflow');
          for (const card of document.querySelectorAll('.applicant-field-card')) {
            const box = card.getBoundingClientRect();
            const content = card.querySelector('.applicant-field-card-content').getBoundingClientRect();
            const actions = card.querySelector('.applicant-field-card-actions').getBoundingClientRect();
            if (card.scrollWidth > card.clientWidth + 1) problems.push('card overflow');
            if (content.right > actions.left + 1 && content.bottom > actions.top + 1 && content.left < actions.right - 1 && content.top < actions.bottom - 1) problems.push('actions overlap text');
            for (const el of card.querySelectorAll('strong, .applicant-field-card-description, .applicant-field-meta-chip, button')) {
              const rect = el.getBoundingClientRect();
              if (rect.left < box.left - 1 || rect.right > box.right + 1) problems.push('element outside card');
              if (el.scrollWidth > el.clientWidth + 1) problems.push('element text overflow');
            }
            const title = card.querySelector('strong').getBoundingClientRect();
            const description = card.querySelector('.applicant-field-card-description');
            if (description && description.getBoundingClientRect().top < title.bottom - 1) problems.push('description shares title row');
          }
          const multiline = document.querySelector('[data-applicant-field-select="multiline"] .applicant-field-card-description');
          const lineHeight = parseFloat(getComputedStyle(multiline).lineHeight);
          if (!Number.isFinite(lineHeight) || multiline.getBoundingClientRect().height < lineHeight * 4 - 1) problems.push('manual line breaks lost');
          return problems;
        });
        assert.deepEqual(failures, [], `${theme} at ${width}px`);
        const oneLineHeight = await page.$eval('[data-applicant-field-select="one-line"]', el => el.getBoundingClientRect().height);
        for (const id of ['short', 'whitespace', 'missing', 'null']) {
          assert.equal(await page.$eval(`[data-applicant-field-select="${id}"] .applicant-field-card-description`, el => el.textContent), '등록된 설명이 없습니다.');
          assert.equal(await page.$eval(`[data-applicant-field-select="${id}"]`, el => el.getBoundingClientRect().height), oneLineHeight, 'empty description keeps the standard card height');
        }
        assert.equal(fields.find(field => field.id === 'short').questionDescription, '', 'placeholder must not change the data');
        assert.equal(await page.$eval('[data-applicant-field-select="long"] .applicant-field-card-description', el => el.textContent), fields[1].questionDescription);
        if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(artifacts, `${theme}-${width}.png`), fullPage: true });
        console.log(`PASS: question cards ${theme} at ${width}px`);
      }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
