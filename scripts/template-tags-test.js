const assert = require('node:assert/strict');
const { templateTagDefinitions, templateRenderTagDefinitions } = require('../shared/app-config');
const { createDefaultTemplateContentBuilder } = require('../shared/domain/default-template');
const { createTemplateRenderingService } = require('../server/modules/templates/rendering');
const { createTemplateBootstrapService } = require('../server/modules/templates/bootstrap');

async function run() {
  const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const renderer = createTemplateRenderingService({
    createHttpError: (_, message) => new Error(message), escapeHtml,
    formatDateAsYmd: () => '2026-09-15', templateTagDefinitions: templateRenderTagDefinitions,
  });
  assert.deepEqual(templateTagDefinitions.map(tag=>tag.label).sort(), ['수험번호','이름','생년월일','현재날짜','모집시기','전형','계열','모집단위','전공','수험생사진'].sort());
  const content = createDefaultTemplateContentBuilder({buildTemplateTokenHtml: token=>token})();
  const record = {examineeNo:'123456', name:'김<학생>', birth:'2000-01-01', track:'9월', admission:'일반', series:'인문', unit:'언어학부', major:'한국어'};
  const rendered = await renderer.renderTemplateWithExaminee(content, record);
  for (const key of ['examineeNo','birth','track','admission','series','unit','major']) assert(rendered.includes(record[key]), key);
  assert(rendered.includes('김&lt;학생&gt;'));
  assert(rendered.includes('2026-09-15'));
  assert(!rendered.includes('@{'));
  for (const label of ['시험날짜','고사건물','고사실','시간','교시','조']) {
    const oldMarkup = `<p>앞<span data-template-tag-value="@{${label}}"><b>#${label}</b></span>뒤</p><p>@{${label}} / #${label} / @${label}</p>`;
    const result = await renderer.renderTemplateWithExaminee(oldMarkup, {...record, room:'stale-room',time:'09:00',group:'A'});
    assert(!result.includes(label), label);
    assert(result.includes('앞뒤'));
    assert(!result.includes('stale-room'));
  }
  // Current seeds must not pass through the old 전형 -> 모집시기 migration.
  const bootstrap = createTemplateBootstrapService({normalizeTemplatePayload: payload=>payload});
  assert.equal(bootstrap.normalizeTemplateSeed({contentHtml:content},'used').contentHtml,content);
  console.log('PASS: current tags, default ticket, escaped values and retired saved tags');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
