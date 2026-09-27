const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const ExcelJS = require('exceljs');
const { sendDataExport } = require('../server/modules/applications/data-export');

async function run() {
  const settings = { birth: 'required', phone: 'optional', extraFields: [
    { key: 'school', label: '출신학교' },
    { key: 'choices', label: '관심 분야', inputType: 'multiselect', options: ['미술', '음악'] },
    { key: 'attachment', label: '가입 서류', inputType: 'file' },
    { key: 'citizenship', label: '국적', inputType: 'nationality' },
    { key: 'literalCountry', label: '자유 입력', inputType: 'text' },
  ] };
  const memberRows = new Map([
    [101, { submissionId: 101, name: '가입 이름', email: 'member@example.test', createdAt: '2026-09-01 10:00:00',
      profileJson: JSON.stringify({ birth: '2001-02-03', phone: '01001234567', school: '=학교', choices: ['미술', '음악'], attachment: { fileName: '서류.pdf', storageKey: 'private-storage-key', base64: 'private-file-bytes' }, deletedQuestion: '예전 답변', password: 'private-password', citizenship: 'KR', literalCountry: 'US' }) }],
    [202, { submissionId: 202, name: '다른 회원', email: 'other@example.test', createdAt: '2026-09-02 11:00:00',
      profileJson: JSON.stringify({ birth: '2002-03-04', school: '다른 학교', citizenship: 'US' }) }],
  ]);
  const memberBatches = [];
  const query = async (sql, ids = []) => {
    if (sql.includes('MAX(n)')) return [{ n: 6 }];
    if (sql.includes('system_set')) return [{ value: JSON.stringify(settings) }];
    assert.match(sql, /m.id = meta.member_id/);
    memberBatches.push(ids);
    return ids.slice().reverse().flatMap(id => memberRows.has(id) ? [memberRows.get(id)] : []);
  };
  const service = {
    getApplicantSchedules: async () => [],
    getApplicantSubmissionsByIds: async ids => ids.slice().reverse().filter(id => id !== 999).map(id => ({
      id, name: `접수 이름 ${id}`, email: 'application@example.test', status: 'submitted', examineeNo: '001234',
      answerItems: [{ inputType: 'text', value: `접수 답변 ${id}` }, { inputType: 'file', value: { hasFile: true, fileName: '접수서류.pdf' } },
        { inputType: 'nationality', value: id === 101 ? 'KR' : 'US' }, { inputType: 'nationality', value: '대한민국' },
        { inputType: 'nationality', value: 'unknown-country' }, { inputType: 'nationality', value: '' }],
    })),
  };
  async function download(ids) {
    const chunks = [];
    const response = new Writable({ write(chunk, encoding, callback) { chunks.push(chunk); callback(); } });
    response.writeHead = (status, headers) => {
      assert.equal(status, 200);
      assert.equal(headers['Cache-Control'], 'no-store');
    };
    await sendDataExport({ service, query, body: { submissionIds: ids }, response, buildContentDisposition: () => 'attachment', kind: 'applications' });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.concat(chunks));
    return workbook.getWorksheet('접수이력');
  }

  const sheet = await download([202, 303, 101, 202, 999]);
  const headers = sheet.getRow(1).values;
  const cell = (row, header) => sheet.getRow(row).getCell(headers.indexOf(header));
  assert.equal(sheet.rowCount, 4, 'Missing submissions are omitted and duplicate IDs are exported once');
  assert.deepEqual([2, 3, 4].map(row => cell(row, '접수번호').value), [101, 202, 303]);
  assert.equal(cell(3, '회원가입 · 이름').value, '다른 회원');
  assert.equal(cell(2, '이름').value, '접수 이름 101');
  assert.equal(cell(2, '회원가입 · 이름').value, '가입 이름');
  assert.equal(cell(2, '회원가입 · 이메일').value, 'member@example.test');
  assert.equal(cell(2, '회원가입일시').value, '2026-09-01 10:00:00');
  assert.equal(cell(2, '회원가입 · 생년월일').value, '2001-02-03');
  assert.equal(cell(2, '회원가입 · 연락처').value, '01001234567');
  assert.equal(cell(2, '회원가입 · 연락처').numFmt, '@');
  assert.equal(cell(2, '회원가입 · 출신학교').value, '=학교', 'Formula-like answers remain literal text');
  assert.equal(cell(2, '회원가입 · 관심 분야').value, '미술, 음악');
  assert.equal(cell(2, '회원가입 · 가입 서류').value, '서류.pdf');
  assert.equal(cell(2, '회원가입 · 기존 질문 (deletedQuestion)').value, '예전 답변');
  assert.equal(cell(2, '질문1').value, '접수 답변 101');
  assert.equal(cell(2, '질문2').value, '접수서류.pdf');
  assert.equal(cell(2, '수험번호').value, '001234');
  assert.equal(cell(2, '회원가입 · 국적').value, '대한민국');
  assert.equal(cell(3, '회원가입 · 국적').value, '미국');
  assert.equal(cell(2, '회원가입 · 자유 입력').value, 'US', 'Only nationality fields are translated');
  assert.equal(cell(2, '질문3').value, '대한민국');
  assert.equal(cell(3, '질문3').value, '미국');
  assert.equal(cell(2, '질문4').value, '대한민국');
  assert.equal(cell(2, '질문5').value, 'unknown-country', 'Unrecognized nationality values are preserved');
  assert([null, ''].includes(cell(2, '질문6').value), 'Empty nationalities remain blank');
  for (const header of headers.filter(header => header.startsWith('회원가입'))) {
    assert([null, ''].includes(cell(4, header).value), 'Unlinked submissions have blank membership fields');
  }
  assert(!JSON.stringify(sheet.getSheetValues()).includes('private-'), 'Passwords and internal file data must never be exported');
  assert.equal(sheet.views[0].ySplit, 1);

  memberBatches.length = 0;
  const ids = Array.from({ length: 205 }, (_, index) => index + 1);
  const largeSheet = await download(ids.slice().reverse());
  assert.equal(largeSheet.rowCount, 206);
  assert(memberBatches.every(batch => batch.length <= 100), 'Member queries stay bounded for large downloads');
  assert.deepEqual(ids.map((id, index) => largeSheet.getRow(index + 2).getCell(1).value), ids, 'Numeric ascending order is preserved across batches');
  assert.equal(largeSheet.getRow(203).getCell(headers.indexOf('회원가입 · 이름')).value, '다른 회원');
  console.log('PASS: submission XLSX numeric sorting, Korean nationalities, member matching, text formatting and batching');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
