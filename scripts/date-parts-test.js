const assert = require('node:assert/strict');
const config = require('../shared/domain/applicant-form');
const { normalizeSignupSettings } = require('../server/modules/applications/membership');
const { validateAnswers } = require('../server/modules/applications/signup-questions');
const { renderDateSelectControls, getDateDayCount } = require('../client/features/applicant-public/rendering-helpers');

const cases = [
  { key: 'year', dateParts: ['year'], value: '2024', invalid: '2024-02-29' },
  { key: 'month', dateParts: ['month'], value: '02', invalid: '13' },
  { key: 'day', dateParts: ['day'], value: '29', invalid: '32' },
  { key: 'year-month', dateParts: ['year', 'month'], value: '2024-02', invalid: '2024-00' },
  { key: 'month-day', dateParts: ['month', 'day'], value: '02-29', invalid: '02-30' },
  { key: 'full', dateParts: ['year', 'month', 'day'], value: '2024-02-29', invalid: '2023-02-29' },
];

function run() {
  for (const list of [config.answerTypeOptions, config.signupAnswerTypeOptions, config.applicationAnswerTypeOptions]) assert(list.some(type => type.key === 'date'));
  for (const item of cases) {
    const field = { ...item, inputType: 'date', label: item.key, required: true };
    assert(config.isValidDateValue(item.value, field));
    assert(!config.isValidDateValue(item.invalid, field));
    assert(!config.isValidDateValue('', field));
    assert.equal(config.buildDateValue(config.parseDateValue(item.value, field), field), item.value);
    assert.equal(config.buildDateValue({}, field), '');
    assert.equal(config.buildDateValue({ year: '2024', month: '02', day: '29' }, field), item.value);
    assert.deepEqual(validateAnswers([field], { [field.key]: item.value }), { [field.key]: item.value });
    for (const value of [item.invalid, '']) assert.throws(() => validateAnswers([field], { [field.key]: value }), error => error.fieldKey === `profile.${field.key}`);
    assert.equal(validateAnswers([{ ...field, required: false }], {})[field.key], '');
    const settings = normalizeSignupSettings({ extraFields: [field] });
    assert.deepEqual(settings.questions.find(q => q.key === field.key).dateParts, item.dateParts);
    for (const prefix of ['member', 'applicant']) {
      const html = renderDateSelectControls({ ...field, fieldKey: field.key, prefix, parts: config.parseDateValue(item.value, field) });
      assert.equal((html.match(/<select /g) || []).length, item.dateParts.length);
      for (const part of config.datePartKeys) assert.equal(html.includes(`data-${prefix}-date-part="${part}"`), item.dateParts.includes(part));
    }
  }
  assert.deepEqual(config.normalizeDateParts(['day', 'year']), ['year', 'month', 'day']);
  assert.deepEqual(config.normalizeDateParts(['day']), ['day']);
  for (const inputType of ['date', 'daterange']) {
    const field = { key: 'legacy', label: '기존 항목', inputType, dateParts: ['year', 'day'] };
    assert.deepEqual(normalizeSignupSettings({ extraFields: [field] }).questions.find(q => q.key === 'legacy').dateParts, ['year', 'month', 'day']);
    assert.deepEqual(config.getDateParts(field), ['year', 'month', 'day']);
    assert(!config.isValidDateValue('2024-29', field));
  }
  assert.deepEqual(config.getDateParts({ inputType: 'date' }), ['year', 'month', 'day']);
  assert.deepEqual(config.getDateParts({ inputType: 'birthdate', dateParts: ['year'] }), ['year', 'month', 'day']);
  for (const dateParts of [[], null, 'year', ['year', 'year'], ['hour']]) {
    assert.throws(() => normalizeSignupSettings({ extraFields: [{ key: 'date', label: '날짜', inputType: 'date', dateParts }] }), /날짜 형식/);
  }
  assert.equal(getDateDayCount('', '02'), 29);
  assert.equal(getDateDayCount('2023', '02'), 28);
  assert.equal(getDateDayCount('2000', '02'), 29);
  assert.equal(getDateDayCount('1900', '02'), 28);
  assert.equal(getDateDayCount('', '04'), 30);
  assert.equal(getDateDayCount('', ''), 31);
  assert(!config.isValidDateValue('0000', { dateParts: ['year'] }));
  assert(!config.isValidDateValue('2024-04-31'));
  console.log('PASS: six date formats, year/day month dependency, standalone days, signup normalization, leap days and public controls');
}

if (require.main === module) run();
module.exports = { cases };
