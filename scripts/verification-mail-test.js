const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const mysql = require('mysql2/promise');
const puppeteer = require('puppeteer-core');
const nodemailer = require('nodemailer');
const {getDbConfig} = require('../db');
const {createApplicationServices} = require('../server/app/services');
const {createEmailSettingsService} = require('../server/modules/system/service/email-settings');
const {createApiRouteDependencies} = require('../server/app/api-route-dependencies');
const {createApiRoutes} = require('../server/http/api-routes');
const {dispatchRoute} = require('../server/http/router');
const {createPageRequestHandlers} = require('../server/http/page-handler');
const responseHelpers = require('../server/http/response');
const bodyHelpers = require('../server/http/body');
const {buildContentDisposition} = require('../server/http/content-disposition');
const config = require('../shared/app-config');

async function run() {
  const rootDir = fs.mkdtempSync(path.resolve(__dirname, '../.tmp-email-test-'));
  const database = `admitcard_email_test_${Date.now()}`;
  const admin = await mysql.createConnection(getDbConfig(false));
  const originalTransport = nodemailer.createTransport;
  let pool, server, browser, smtpFailure = '', sent = [], transports = [], rejected = false, deliveryError = null;
  // Only the SMTP boundary is mocked. Real routes, DB, encryption, sessions and UI run below.
  nodemailer.createTransport = options => {
    const transport = {options, closed: false,
      async verify() {if(smtpFailure) throw Object.assign(new Error('secret server response'), {code: smtpFailure});},
      async sendMail(message) {if(deliveryError) throw deliveryError; sent.push({options, message}); return {accepted: rejected ? [] : [message.to.address], rejected: rejected ? [message.to.address] : [], messageId: 'test-id'};},
      close() {this.closed = true;},
    };
    transports.push(transport); return transport;
  };
  const emailPath = '/api/system-settings/email';
  const payload = {host:'smtp.example.test', port:465, security:'tls', user:'mail-user', password:' secret pass ', from:'admission@example.test', fromName:'입학처'};
  try {
    await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4`);
    pool = mysql.createPool({...getDbConfig(), database});
    const query = async (sql, params=[]) => (await pool.query(sql, params))[0];
    const env = {DB_NAME: database, NODE_ENV:'production', APPLICANT_SIGNUP_CODE_PREVIEW:'false'};
    const services = createApplicationServices({fs,path,query,getPool:()=>pool,rootDir,env});
    await services.initializeApplicationData();
    const environmentService=createEmailSettingsService({query,rootDir,createHttpError:services.createHttpError,env:{SMTP_HOST:'smtp.env.test',SMTP_PORT:'587',SMTP_USER:'env-user',SMTP_PASS:'env-secret',SMTP_FROM:'env@example.test'}});
    const environmentSettings=await environmentService.getEmailSettings();
    assert.equal(environmentSettings.source,'environment');assert.equal(environmentSettings.hasPassword,true);assert.equal(environmentSettings.password,undefined);
    await environmentService.checkEmailSettings();assert.equal(transports.at(-1).options.auth.pass,'env-secret');assert.equal(transports.at(-1).options.requireTLS,true);

    const deps = createApiRouteDependencies({...services,query,...responseHelpers,...bodyHelpers,buildContentDisposition});
    const routes = createApiRoutes(deps);
    const pages = createPageRequestHandlers({fs,path,root:path.resolve(__dirname,'..'),...config,...services});
    server=http.createServer(async(request,response)=>{
      try {
        const url=new URL(request.url,`http://${request.headers.host}`);
        if(url.pathname.startsWith('/api/')) {
          if(!await dispatchRoute(routes,{request,response,requestUrl:url},{authenticate:services.getAuthenticatedAccountFromRequest})) responseHelpers.sendJson(response,404,{});
        } else if(!await pages.handlePageRequest(request,response,url.pathname)) pages.serveStaticFile(response,url.pathname);
      } catch(error) {responseHelpers.sendJson(response,error.statusCode||500,{error:error.message,code:error.errorCode||''});}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base=`http://127.0.0.1:${server.address().port}`;
    const call=async(resource,body,cookie='',method='POST')=>{
      const response=await fetch(base+resource,{method,headers:{'Content-Type':'application/json',Cookie:cookie},...(method==='GET'?{}:{body:JSON.stringify(body)})});
      const text=await response.text();
      return {status:response.status,body:(()=>{try{return JSON.parse(text);}catch{return text;}})(),cookie:response.headers.getSetCookie().find(c=>c.startsWith('admitcard.sid='))?.split(';')[0]||''};
    };
    const login=async(id)=>{
      const first=await call('/api/auth/login',{id,password:'1111'});
      const setup=await call('/api/auth/password/setup',{password:'EmailTest1234',passwordConfirm:'EmailTest1234'},first.cookie);
      assert.equal(setup.status,200);return setup.cookie;
    };
    const adminCookie=await login('admin'), viewerCookie=await login('view');
    for(const [resource,method] of [[emailPath,'GET'],[emailPath,'PUT'],[emailPath+'/check','POST']]) {
      assert.equal((await call(resource,payload,'',method)).status,401);
      assert.equal((await call(resource,payload,viewerCookie,method)).status,403);
    }
    let result=await call(emailPath,null,adminCookie,'GET');
    assert.equal(result.body.hasPassword,false);
    for(const invalid of [{...payload,host:'https://smtp.test'}, {...payload,port:0}, {...payload,from:'bad'}, {...payload,fromName:'evil\r\nheader'}, {...payload,password:''},null]) {
      assert.equal((await call(emailPath,invalid,adminCookie,'PUT')).status,400);
    }
    result=await call(emailPath,payload,adminCookie,'PUT'); assert.equal(result.status,200);
    assert.equal(result.body.hasPassword,true); assert.equal(result.body.password,undefined); assert.equal(result.body.passwordEncrypted,undefined);
    let record=(await query('SELECT setting_value FROM system_set WHERE setting_key=?',['verificationEmailSettings']))[0].setting_value;
    assert(!record.includes(payload.password)); assert(JSON.parse(record).passwordEncrypted);
    result=await call(emailPath+'/check',{...payload,password:''},adminCookie);
    assert.equal(result.status,200); assert.equal(transports.at(-1).options.auth.pass,payload.password); assert(transports.at(-1).closed); assert.equal(sent.length,0);
    smtpFailure='EAUTH'; result=await call(emailPath+'/check',{...payload,password:'wrong'},adminCookie);
    assert.equal(result.status,502); assert.equal(result.body.code,'EMAIL_SMTP_AUTH_FAILED'); assert(!JSON.stringify(result.body).includes('secret server response'));
    const beforeFailed=(await query('SELECT COUNT(*) AS n FROM applicant_member_verifications'))[0].n;
    result=await call('/api/public/members/email-code',{email:'failed@example.test'});
    assert.equal(result.status,503);
    assert.equal((await query('SELECT COUNT(*) AS n FROM applicant_member_verifications'))[0].n,beforeFailed,'Failure must not create a verification proof');
    smtpFailure='';
    result=await call('/api/public/members/email-code',{email:'success@example.test'});
    assert.equal(result.status,200); assert.equal(result.body.debugCode,undefined);
    const delivered=sent.at(-1); assert.equal(delivered.options.auth.pass,payload.password); assert.equal(delivered.message.from.name,'입학처');
    const code=delivered.message.text.match(/인증 코드: (\d{6})/)[1];
    assert.equal((await call('/api/public/members/verify-email',{email:'success@example.test',verificationId:result.body.verificationId,code})).status,200);
    assert(!(JSON.stringify(await query('SELECT * FROM applicant_member_verifications'))).includes('"'+code+'"'));
    result=await call('/api/public/members/email-code',{email:'english@example.test',language:'en'});
    assert.equal(result.status,200);
    const englishMail=sent.at(-1).message;
    assert.match(englishMail.subject,/Email verification code/);
    assert.match(englishMail.text,/Verification code: \d{6}/);
    assert.match(englishMail.text,/Korea Standard Time, UTC\+09:00/);
    assert.match(englishMail.html,/lang="en"/);
    assert.match(englishMail.html,/Verify your email/);
    const englishCode=englishMail.text.match(/Verification code: (\d{6})/)[1];
    assert.equal((await call('/api/public/members/verify-email',{email:'english@example.test',verificationId:result.body.verificationId,code:englishCode})).status,200);
    result=await call('/api/public/members/email-code',{email:'fallback@example.test',language:'unsupported'});
    assert.equal(result.status,200);assert.match(sent.at(-1).message.html,/lang="ko"/);
    await query("INSERT INTO applicant_members (login_id,password_hash,name,email,email_verified,profile_json,consent_json) VALUES ('existing@example.test','unused','Existing','existing@example.test',1,'{}','{}')");
    await query("INSERT INTO accounts (login_id,display_name,role,password_value,password_temporary) VALUES ('staff@example.test','Staff','조회용','unused',0)");
    const beforeDuplicate=sent.length;
    const proofsBeforeDuplicate=await query('SELECT * FROM applicant_member_verifications ORDER BY id');
    for(const email of ['  EXISTING@example.test  ','STAFF@example.test']) {
      result=await call('/api/public/members/email-code',{email,language:'en'});
      assert.equal(result.status,409);assert.equal(result.body.error,'이미 사용 중인 이메일입니다.');
    }
    assert.equal(sent.length,beforeDuplicate,'Duplicate emails must never reach SMTP');
    assert.deepEqual(await query('SELECT * FROM applicant_member_verifications ORDER BY id'),proofsBeforeDuplicate,'Duplicate requests must not create or delete verification codes');
    await call(emailPath,{...payload,password:'changed-secret',fromName:'변경 입학처',security:'starttls',port:587},adminCookie,'PUT');
    await call('/api/public/members/email-code',{email:'changed@example.test'});
    assert.equal(sent.at(-1).options.auth.pass,'changed-secret');assert.equal(sent.at(-1).options.requireTLS,true);assert.equal(sent.at(-1).message.from.name,'변경 입학처');
    deliveryError=Object.assign(new Error('sender rejected'), {code:'EMESSAGE',responseCode:550,command:'DATA',response:'550 5.7.0 no permitted from-header address, address: admission@example.test'});
    const beforeSenderFailure=(await query('SELECT COUNT(*) AS n FROM applicant_member_verifications'))[0].n;
    result=await call('/api/public/members/email-code',{email:'sender-rejected@example.test'});
    assert.equal(result.status,503);assert.equal(result.body.code,'APPLICANT_VERIFICATION_EMAIL_SENDER_NOT_ALLOWED');
    assert(result.body.error.includes('발신 이메일'));assert(!JSON.stringify(result.body).includes('admission@example.test'));
    assert.equal((await query('SELECT COUNT(*) AS n FROM applicant_member_verifications'))[0].n,beforeSenderFailure);
    deliveryError=null;
    // New service instance decrypts the persisted credential after a restart.
    const fresh=createEmailSettingsService({query,rootDir,env,createHttpError:services.createHttpError});
    await fresh.checkEmailSettings();assert.equal(transports.at(-1).options.auth.pass,'changed-secret');
    rejected=true;
    result=await call('/api/public/members/email-code',{email:'rejected@example.test'});assert.equal(result.status,502);rejected=false;
    result=await call('/api/public/members/recovery/request',{purpose:'password',name:'회원 테스트',email:'recovery@example.test'});
    assert.equal(result.status,200);assert.equal(result.body.debugCode,undefined);assert.equal(sent.at(-1).options.auth.pass,'changed-secret');assert(sent.at(-1).message.subject.includes('비밀번호 재설정'));
    result=await call('/api/public/members/recovery/request',{purpose:'password',name:'Existing',email:'existing@example.test',language:'en'});
    assert.equal(result.status,200);assert.match(sent.at(-1).message.subject,/Password reset code/);assert.match(sent.at(-1).message.html,/Reset your password/);assert.match(sent.at(-1).message.html,/lang="en"/);
    const bootstrap=await call('/api/bootstrap',null,adminCookie,'GET');
    assert(!JSON.stringify(bootstrap.body).includes('passwordEncrypted'));assert(!JSON.stringify(bootstrap.body).includes('changed-secret'));
    const audit=await services.systemService.getSystemAuditLogs({limit:100});assert(!JSON.stringify(audit).includes('changed-secret'));
    const backup=await services.systemService.buildSystemBackupArchive({includeDatabase:true,includedAssetKeys:[]});
    const zip=new(require('adm-zip'))(backup.archiveBuffer);
    assert(!zip.getEntries().some(entry=>entry.entryName.includes('smtp.key')));
    assert(!zip.getEntries().filter(entry=>!entry.isDirectory).some(entry=>entry.getData().includes(Buffer.from('changed-secret'))));
    assert.equal((await fetch(base+'/.private/smtp.key')).status,404);
    const keyFile=path.join(rootDir,'.private','smtp.key');
    fs.writeFileSync(keyFile,Buffer.alloc(32));
    assert.equal((await fresh.getEmailSettings()).passwordNeedsReset,true);
    await assert.rejects(()=>fresh.checkEmailSettings(),error=>error.errorCode==='EMAIL_PASSWORD_UNAVAILABLE');
    await fresh.updateEmailSettings({...payload,password:'recovered-secret'});
    assert.equal((await fresh.getEmailSettings()).passwordNeedsReset,false);
    // Keep the new key: the saved credential was re-encrypted with it.
    browser=await puppeteer.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
    const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.setCookie({name:'admitcard.sid',value:adminCookie.split('=')[1],url:base});
    await page.setViewport({width:1440,height:1000});
    await page.goto(base+'/system-settings',{waitUntil:'networkidle2'});
    await page.waitForSelector('applyhub-email-settings input[name=password]');
    assert.equal(await page.$eval('applyhub-email-settings input[name=password]',el=>el.value),'');
    assert.equal(await page.$eval('[data-email-save]',el=>el.disabled),true);
    await page.click('applyhub-email-settings input[name=fromName]',{clickCount:3});
    await page.type('applyhub-email-settings input[name=fromName]','입학처 테스트');
    await page.click('[data-email-check]');
    await page.waitForFunction(()=>document.querySelector('applyhub-email-settings [role=status]')?.textContent.includes('성공'));
    await page.click('[data-email-save]');
    await page.waitForFunction(()=>document.querySelector('applyhub-email-settings [role=status]')?.textContent.includes('저장했습니다'));
    assert.equal((await fresh.getEmailSettings()).fromName,'입학처 테스트');
    assert.equal(await page.$eval('applyhub-email-settings input[name=password]',el=>el.value),'');
    smtpFailure='EAUTH'; await page.click('[data-email-check]');
    await page.waitForFunction(()=>document.querySelector('applyhub-email-settings [role=status]')?.textContent.includes('인증을 거절'));
    smtpFailure='';
    const artifacts=path.resolve(__dirname,'../.tmp-email-check');fs.mkdirSync(artifacts,{recursive:true});
    for(const theme of ['light','dark']) {
      await page.evaluate(theme=>localStorage.setItem('applyhub.theme',theme),theme);
      for(const width of [1440,390]) {
        await page.setViewport({width,height:1000});await page.goto(base+'/system-settings',{waitUntil:'networkidle2'});
        await page.waitForSelector('applyhub-email-settings input[name=password]');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
        await page.$eval('applyhub-email-settings',el=>el.scrollIntoView({block:'start'}));
        await page.screenshot({path:path.join(artifacts,theme+'-'+width+'.png')});
      }
    }
    await page.setViewport({width:1440,height:1000});
    await page.type('applyhub-email-settings input[name=password]','unsaved-secret');
    assert.equal(await page.evaluate(()=>window.AdmitCardEmailSettings.hasUnsavedChanges()),true);
    page.once('dialog',dialog=>dialog.dismiss());
    await Promise.all([page.waitForNavigation({waitUntil:'networkidle2'}),page.click('[data-view=accountManagement]')]);
    await page.goto(base+'/system-settings',{waitUntil:'networkidle2'});
    await page.waitForSelector('applyhub-email-settings input[name=password]');
    assert.equal(await page.$eval('applyhub-email-settings input[name=password]',el=>el.value),'');
    assert.equal(await page.evaluate(()=>window.AdmitCardEmailSettings.hasUnsavedChanges()),false);
    const visitor=await browser.createBrowserContext();
    const signupPage=await visitor.newPage();signupPage.on('pageerror',error=>errors.push(error.message));
    await services.membershipService.saveSettings({birth:'hidden',phone:'hidden',terms:[],extraFields:[]});
    await signupPage.goto(base+'/applicant/signup',{waitUntil:'networkidle0'});
    await signupPage.click('[data-language="en"]');
    await signupPage.click('[data-applicant-form="member-terms"] button[type="submit"]');
    await signupPage.waitForSelector('[data-applicant-form="member-register"] [name="email"]');
    await signupPage.evaluate(()=>{
      window.emailEnterEvents={send:0,submit:0,invalid:0};
      const form=document.querySelector('[data-applicant-form="member-register"]');
      form.addEventListener('submit',()=>window.emailEnterEvents.submit++);
      form.addEventListener('invalid',()=>window.emailEnterEvents.invalid++,true);
      form.querySelector('[data-applicant-action="member-send-code"]').addEventListener('click',()=>window.emailEnterEvents.send++);
    });
    await signupPage.focus('[name="email"]');await signupPage.keyboard.press('Enter');
    assert.deepEqual(await signupPage.evaluate(()=>window.emailEnterEvents),{send:0,submit:0,invalid:0},'Empty email Enter must not submit the registration form');
    await signupPage.type('[name="email"]','existing@example.test');
    await signupPage.$eval('[name="email"]',el=>{
      for(const state of [{isComposing:true},{repeat:true}]) el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...state}));
    });
    assert.deepEqual(await signupPage.evaluate(()=>window.emailEnterEvents),{send:0,submit:0,invalid:0},'Composition and held Enter must not send mail');
    const browserBeforeDuplicate=sent.length;
    let responsePromise=signupPage.waitForResponse(r=>r.url().endsWith('/members/email-code'));
    await signupPage.keyboard.press('Enter');
    assert.equal((await responsePromise).status(),409);
    await signupPage.waitForFunction(()=>document.querySelector('[name="email"]').closest('.applicant-public-field').textContent.includes('This email is already in use.'));
    assert.equal(sent.length,browserBeforeDuplicate);
    await signupPage.click('[name="email"]',{clickCount:3});await signupPage.type('[name="email"]','browser-en@example.test');
    responsePromise=signupPage.waitForResponse(r=>r.url().endsWith('/members/email-code'));
    await signupPage.keyboard.press('Enter');
    assert.equal((await responsePromise).status(),200);assert.match(sent.at(-1).message.subject,/Email verification code/);
    await signupPage.waitForFunction(()=>document.querySelector('[name="email"]').closest('.applicant-public-field').textContent.includes('10 minutes'));
    await signupPage.keyboard.press('Enter');
    assert.deepEqual(await signupPage.evaluate(()=>window.emailEnterEvents),{send:2,submit:0,invalid:0},'Enter sends only the code request and respects the resend cooldown');
    assert.equal(sent.length,browserBeforeDuplicate+1);
    await signupPage.goto(base+'/account-recovery',{waitUntil:'networkidle0'});
    await signupPage.type('[name="name"]','Existing');await signupPage.type('[name="email"]','browser-recovery@example.test');
    responsePromise=signupPage.waitForResponse(r=>r.url().endsWith('/recovery/request'));
    await signupPage.click('#recoveryForm button[type="submit"]');
    assert.equal((await responsePromise).status(),200);assert.match(sent.at(-1).message.subject,/Password reset code/);assert.match(sent.at(-1).message.html,/lang="en"/);
    await visitor.close();
    assert.deepEqual(errors,[]);
    console.log('PASS: bilingual signup/recovery emails, duplicate email blocking and translated feedback, admin permissions, encrypted persistence, safe backups, SMTP errors and responsive settings UI');
  } finally {
    nodemailer.createTransport=originalTransport;
    if(browser) await browser.close();
    if(server) await new Promise(resolve=>server.close(resolve));
    if(pool) await pool.end();
    await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);await admin.end();
    const resolved=path.resolve(rootDir);
    assert(resolved.startsWith(path.resolve(__dirname,'../.tmp-email-test-')));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
