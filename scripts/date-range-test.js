const assert = require('node:assert/strict');
const config = require('../shared/domain/applicant-form');
const { cases: dateCases } = require('./date-parts-test');
const { normalizeSignupSettings } = require('../server/modules/applications/membership');
const { validateAnswers } = require('../server/modules/applications/signup-questions');
const { renderDateRangeControls } = require('../client/features/applicant-public/rendering-helpers');

const cases = dateCases.map(item => {
  const end = config.buildDateValue({ year: '2025', month: '03', day: '30' }, item);
  return { ...item, start: item.value, end, value: `${item.value} ~ ${end}`, invalid: `${item.invalid} ~ ${end}` };
});

function run() {
  for (const list of [config.answerTypeOptions, config.signupAnswerTypeOptions, config.applicationAnswerTypeOptions]) assert(list.some(type => type.key === 'daterange'));
  for (const item of cases) {
    const field = { ...item, inputType: 'daterange', required: true, label: '기간' };
    assert.equal(config.validateDateRangeAnswer(field, item.value), item.value);
    assert.equal(config.validateDateRangeAnswer(field, `${item.start} ~ ${item.start}`), `${item.start} ~ ${item.start}`);
    assert.deepEqual(config.parseDateRange(item.value), { start: item.start, end: item.end });
    assert.equal(config.buildDateRangeValue(item.start, item.end), item.value);
    assert.equal(config.buildDateRangeValue(item.start, ''), '');
    assert.deepEqual(validateAnswers([field], { [field.key]: item.value }), { [field.key]: item.value });
    assert.equal(validateAnswers([{ ...field, required: false }], {})[field.key], '');
    for (const invalid of ['', item.invalid, `${item.end} ~ ${item.start}`, `${item.start} ~ `, ` ~ ${item.end}`, item.start, {}, []]) {
      assert.throws(() => validateAnswers([field], { [field.key]: invalid }), error => error.fieldKey === `profile.${field.key}`);
    }
    assert.throws(() => validateAnswers([{ ...field, required: false }], { [field.key]: `${item.start} ~ ` }));
    assert.deepEqual(normalizeSignupSettings({ extraFields: [field] }).questions.find(q => q.key === field.key).dateParts, item.dateParts);
    for (const prefix of ['member', 'applicant']) {
      const html = renderDateRangeControls({ ...field, fieldKey: field.key, prefix, rangeParts: Object.fromEntries(['start', 'end'].map(edge => [edge, config.parseDateValue(item[edge], field)])) });
      assert.equal((html.match(/<select /g) || []).length, item.dateParts.length * 2);
      const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
      assert.equal(new Set(ids).size, ids.length);
      assert(html.includes('시작일') && html.includes('종료일'));
    }
  }
  console.log('PASS: period formats, optional/required endpoints, ordering, invalid dates, stored text and unique controls');
}
if (require.main === module) run();
module.exports = { cases };
