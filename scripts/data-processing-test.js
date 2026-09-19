const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {Readable}=require('node:stream');
const ExcelJS=require('exceljs');
const puppeteer=require('puppeteer-core');
const {allocateExamNumber}=require('../server/modules/applications/exam-number-sequence');
const {stageAttachments}=require('../server/modules/applications/attachment-transaction');
const {createMemberFileStorage}=require('../server/modules/applications/member-files');
const {readJsonBody}=require('../server/http/body');
async function verifyDataProcessing({services,query,pool,root,base,call,submissionId,memberCookie}) {
  const original=await services.applicantService.getApplicantSubmissionById(submissionId);
  for(let i=0;i<44;i++) {
    const result=await query('INSERT INTO app_meta (examinee_no) VALUES (?)',['TEST'+String(i).padStart(5,'0')]);
    await query('INSERT INTO app_subm (id,applicant_name,email,password_hash,status,field_key,answer_data,created_at,updated_at) SELECT ?,?,email,password_hash,status,field_key,answer_data,created_at,updated_at FROM app_subm WHERE id=?',[result.insertId,'성능검증'+String(i).padStart(2,'0'),submissionId]);
  }
  const login=await call('/api/auth/login',{id:'admin',password:'1111'});
  const setup=await call('/api/auth/password/setup',{password:'DataTest12345',passwordConfirm:'DataTest12345'},login.cookie);
  assert.equal(setup.status,200);const cookie=setup.cookie||login.cookie;
  const list=body=>call('/api/applicant-submissions/list',body,cookie);
  const first=await list({kind:'history',page:1,pageSize:20,sort:[{key:'id',direction:'asc'}]});
  assert.equal(first.status,200,JSON.stringify(first.body));assert.equal(first.body.total,45);assert.equal(first.body.rows.length,20);
  assert.equal(first.body.rows[0].answerItems,undefined);assert.equal(first.body.rows[0].answerMap,undefined);
  const second=await list({kind:'history',page:2,pageSize:20,sort:[{key:'id',direction:'asc'}]});
  assert.equal(second.body.rows.length,20);assert(!first.body.rows.some(a=>second.body.rows.some(b=>a.id===b.id)));
  assert.equal((await list({kind:'ticket',examineeName:'성능검증00'})).body.total,1);
  assert.equal((await list({kind:'history',columns:{statusLabel:[first.body.rows[0].statusLabel]}})).body.total,45);
  const facets=await list({kind:'history',optionsKey:'name'});assert.equal(facets.body.values.length,45);
  const boot=await call('/api/bootstrap?view=applicantHistory',null,cookie,'GET');
  assert.equal(boot.body.applicantManager.submissions.length,0);assert.equal(boot.body.examinees.length,0);
  assert.equal((await call('/api/print-history',{examineeNos:[original.examineeNo,'TEST00000']},cookie)).status,201);
  const prints=await list({kind:'print',pageSize:1});assert.equal(prints.body.total,2);assert.equal(prints.body.rows.length,1);
  async function workbook(url,body) {
    const response=await fetch(base+url,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal(response.status,200,await (response.status===200?Promise.resolve(''):response.text()));
    const result=new ExcelJS.Workbook();await result.xlsx.load(Buffer.from(await response.arrayBuffer()));return result;
  }
  const selected=first.body.rows.slice(0,3).map(row=>row.id);
  const book=await workbook('/api/applicant-submissions/export.xlsx',{submissionIds:selected});assert.equal(book.worksheets[0].rowCount,4);
  assert(book.worksheets[0].getRow(2).getCell(8).value,'Export retains answer values');
  const printBook=await workbook('/api/print-history/export.xlsx',{filters:{kind:'print'}});
  assert.equal(printBook.worksheets[0].rowCount,3);assert.equal(printBook.worksheets[1].rowCount,46);
  let allocationQueries=0;
  const numbers=await Promise.all(Array.from({length:12},async()=>{
    const connection=await pool.getConnection();
    try {await connection.beginTransaction();
      const wrapped={query:async(...args)=>{allocationQueries++;return connection.query(...args);}};
      const number=await allocateExamNumber(wrapped,{parts:['CONCURRENT',''],minDigits:5,maxDigits:5,start:1,build:n=>'CONCURRENT'+String(n).padStart(5,'0'),createHttpError:services.createHttpError});
      await connection.query('INSERT INTO app_meta (examinee_no) VALUES (?)',[number]);await connection.commit();return number;
    } catch(error) {await connection.rollback();throw error;} finally {connection.release();}
  }));
  assert.equal(new Set(numbers).size,12);assert(allocationQueries<=12*5+1,allocationQueries);
  for(let start=1;start<=10000;start+=1000) await query('INSERT INTO app_meta (examinee_no) VALUES ?', [Array.from({length:1000},(_,i)=>['HIST'+String(start+i).padStart(5,'0')+'END'])]);
  const historicalConnection=await pool.getConnection();let historicalQueries=0;
  try {
    await historicalConnection.beginTransaction();
    const next=await allocateExamNumber({query:async(...args)=>{historicalQueries++;return historicalConnection.query(...args);}},{parts:['HIST','END'],minDigits:5,maxDigits:5,start:1,build:n=>'HIST'+String(n).padStart(5,'0')+'END',createHttpError:services.createHttpError});
    assert.equal(next,'HIST10001END');assert.equal(historicalQueries,5);
    await historicalConnection.rollback();
  } finally {historicalConnection.release();}
  const file=path.join(root,'rollback.txt');await fs.writeFile(file,'before');
  const staged=await stageAttachments([{filePath:file,fileBuffer:Buffer.from('after')}]);assert.equal(await fs.readFile(file,'utf8'),'after');await staged.rollback();assert.equal(await fs.readFile(file,'utf8'),'before');
  await assert.rejects(stageAttachments([{filePath:file,fileBuffer:Buffer.from('partial')},{filePath:path.join(file,'invalid'),fileBuffer:Buffer.from('x')}]));assert.equal(await fs.readFile(file,'utf8'),'before');
  const storage=createMemberFileStorage(root), stored=await storage.store({doc:{base64:Buffer.from('member file').toString('base64'),fileName:'test.txt'}});
  assert.equal(stored.profile.doc.base64,undefined);assert.equal((await storage.read(stored.profile.doc)).toString(),'member file');await stored.rollback();
  const [member]=await query('SELECT id,profile_json FROM applicant_members ORDER BY id LIMIT 1');
  await query('UPDATE applicant_members SET profile_json=? WHERE id=?',[JSON.stringify({...JSON.parse(member.profile_json),migrationFile:{fileName:'old.txt',mimeType:'text/plain',base64:Buffer.from('legacy member bytes').toString('base64')}}),member.id]);
  await storage.migrate(query);
  const [migrated]=await query('SELECT profile_json FROM applicant_members WHERE id=?',[member.id]);
  const migratedProfile=JSON.parse(migrated.profile_json);
  assert.equal(migratedProfile.migrationFile.base64,undefined);assert.equal((await storage.read(migratedProfile.migrationFile)).toString(),'legacy member bytes');
  const session=await call('/api/public/members/session',null,memberCookie,'GET');
  assert.equal(session.status,200);assert(!JSON.stringify(session.body).includes('storageKey'));assert(!JSON.stringify(session.body).includes('base64'));
  await assert.rejects(readJsonBody(Readable.from([Buffer.alloc(10)]),{maxBytes:5}),error=>error.statusCode===413);
  const browser=await puppeteer.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const separator=cookie.indexOf('=');await browser.setCookie({name:cookie.slice(0,separator),value:cookie.slice(separator+1),url:base});
    const page=await browser.newPage(), errors=[];page.on('pageerror',error=>errors.push(error.message));
    for(const [url,grid,total] of [['/applicant-history','applicantHistoryGrid',45],['/admit-cards','admitCardLookupGrid',45],['/print-history','printHistoryGrid',2]]) {
      await page.goto(base+url,{waitUntil:'networkidle2'});
      await page.waitForFunction((key,count)=>globalThis.AdmitCardRemoteGrids?.meta(key)?.total===count,{},grid,total);
      assert.deepEqual(errors,[],url);
    }
  } finally {await browser.close();}
  console.log('PASS: SQL paging/filter/sort/facets, compact bootstrap, bounded XLSX, print summary, concurrent unique numbering, reversible file writes, member file storage, body limits and browser grids');
}
module.exports={verifyDataProcessing};
