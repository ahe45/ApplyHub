const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const puppeteer=require('puppeteer-core');
async function runTranslationChecks({services,query,base,call}) {
  await query('UPDATE accounts SET password_temporary=0');
  const {initialPassword}=await services.systemService.getSystemSettings();
  const admin=await call('/api/auth/login',{id:'admin',password:initialPassword});assert.equal(admin.status,200);
  const viewer=await call('/api/auth/login',{id:'view',password:initialPassword});
  const payload={languages:['en','mn'],entries:[{id:'f0',text:'전형 안내 @{회원가입:이름}'}]};
  assert.equal((await call('/api/admin/translations',payload)).status,401);
  assert.equal((await call('/api/admin/translations',payload,viewer.cookie)).status,403);
  assert.equal((await fetch(base+'/.env')).status,404);
  const translationPath='/api/system-settings/translation';
  await services.authService.createAccount({id:'translate-super',name:'번역 슈퍼관리자',role:services.superAdminRole});
  await query('UPDATE accounts SET password_temporary=0');
  const superAccount=await call('/api/auth/login',{id:'translate-super',password:initialPassword});
  assert.equal(superAccount.status,200);
  const apiKey='AIza'+'x'.repeat(35),changedApiKey='AIza'+'y'.repeat(35);
  for(const [url,method] of [[translationPath,'GET'],[translationPath,'PUT'],[translationPath+'/check','POST']]) {
    assert.equal((await call(url,{apiKey},'',method)).status,401);
    assert.equal((await call(url,{apiKey},admin.cookie,method)).status,403);
    assert.equal((await call(url,{apiKey},viewer.cookie,method)).status,403);
  }
  assert.equal((await call(translationPath,{apiKey:'bad'},superAccount.cookie,'PUT')).status,400);
  const savedSettings=await call(translationPath,{apiKey},superAccount.cookie,'PUT');
  assert.equal(savedSettings.status,200);assert.equal(savedSettings.body.hasApiKey,true);
  assert(!JSON.stringify(savedSettings.body).includes(apiKey));
  const stored=(await query('SELECT setting_value FROM system_set WHERE setting_key=?',['googleTranslationApiSettings']))[0].setting_value;
  assert(!stored.includes(apiKey));assert(JSON.parse(stored).encrypted);
  assert.equal((await call(translationPath+'/check',{apiKey:''},superAccount.cookie)).status,200);
  assert.equal((await call(translationPath,{apiKey:''},superAccount.cookie,'PUT')).status,200);
  assert.equal((await fetch(base+'/.private/translation.key')).status,404);
  const revealPath='/api/system-settings/secrets/reveal';
  const emailPassword='mail-fixture-password-123';
  await services.systemService.updateEmailSettings({host:'smtp.example.test',port:465,security:'tls',user:'fixture',password:emailPassword,from:'fixture@example.test',fromName:'테스트'});
  for(const cookie of ['',admin.cookie,viewer.cookie]) assert.equal((await call(revealPath,{kind:'translation',currentPassword:initialPassword},cookie)).status,cookie?403:401);
  assert.equal((await call(revealPath,{kind:'translation',currentPassword:''},superAccount.cookie)).status,400);
  const wrong=await call(revealPath,{kind:'translation',currentPassword:'wrong-password',accountId:'admin'},superAccount.cookie);
  assert.equal(wrong.status,403);assert.equal(wrong.body.code,'SECRET_PASSWORD_INVALID');assert(!JSON.stringify(wrong.body).includes(apiKey));
  for(const [kind,value] of [['translation',apiKey],['email',emailPassword]]) {
    const response=await fetch(base+revealPath,{method:'POST',headers:{'Content-Type':'application/json',Cookie:superAccount.cookie},body:JSON.stringify({kind,currentPassword:initialPassword})});
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).value,value);
  }
  const a=services.applicantService;
  await a.createApplicantRecruitmentUnit({trackName:'수시',admissionCode:'1',admissionName:'일반전형',seriesCode:'2',seriesName:'공학',unitCode:'3',unitName:'컴퓨터공학부',majorCode:'4',majorName:'소프트웨어'});
  await a.createApplicantFormField({fieldKey:'translate-choice',questionText:'시간 선택',questionDescription:'원하는 시간을 선택하세요.',inputType:'select',options:['오전','오후'],optionsEn:{오전:'Existing morning'}});
  await a.createApplicantFormField({formScope:'documents',fieldKey:'translate-document',questionText:'졸업증명서',questionDescription:'PDF로 제출하세요.',inputType:'file'});
  const field=(await a.getApplicantFormFields()).find(f=>f.fieldKey==='translate-choice');
  const settings=await services.membershipService.getSettings();
  await services.membershipService.saveSettings({...settings,questions:[...settings.questions,{key:'translate-signup',label:'주소',description:'현재 주소',inputType:'text'}],terms:[{id:'translate-term',title:'가입 약관',text:'연락처 {이름}을 확인하세요.',enabled:true,required:true}]});
  const browser=await puppeteer.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const i=admin.cookie.indexOf('=');await browser.setCookie({name:admin.cookie.slice(0,i),value:admin.cookie.slice(i+1),url:base});
  const out=path.resolve('.tmp-translation');fs.mkdirSync(out,{recursive:true});await page.setViewport({width:1440,height:1000});
  const go=url=>page.goto(base+url,{waitUntil:'networkidle0'});
  const translate=async key=>{const selector=`[editor-key="${key}"]`;await page.click(selector+' .auto-translate-button');await page.waitForFunction(sel=>document.querySelector(sel+' [role=status]')?.textContent.includes('번역을 입력했습니다'),{},selector);};
  const select=async(key,code)=>{await page.click(`[editor-key="${key}"] .language-menu-trigger`);await page.click(`[editor-key="${key}"] [data-language=${code}]`);};
  const saveQuestion=async(prefix)=>{
    const response=page.waitForResponse(r=>r.request().method()!=='GET' && r.url().includes(prefix==='signup'?'/api/applicant-signup-settings':'/api/applicant-form-fields'));
    await page.click(`[data-${prefix}-field-form] button[type=submit]`);
    assert.equal((await response).status(),200);
    await page.waitForFunction(()=>document.querySelector('.toast-message')?.textContent.includes('했습니다'));
    await page.waitForSelector(`[data-${prefix}-field-select].is-editing`);
    assert(await page.$eval(`[data-${prefix}-field-input=questionText]`,n=>!n.disabled&&!!n.value),'Saved question remains editable');
  };
  try {
    const j=superAccount.cookie.indexOf('=');await browser.setCookie({name:superAccount.cookie.slice(0,j),value:superAccount.cookie.slice(j+1),url:base});
    await go('/super-admin');await page.waitForSelector('applyhub-translation-settings input[name=apiKey]');
    for(const [input,button] of [['applyhub-email-settings input[name=password]','[data-email-reveal]'],['applyhub-translation-settings input[name=apiKey]','[data-translation-reveal]']]){
      assert(await page.evaluate((a,b)=>{const i=document.querySelector(a).getBoundingClientRect(),button=document.querySelector(b),r=button.getBoundingClientRect();return r.left>=i.right&&Math.abs(r.bottom-i.bottom)<2&&!button.disabled;},input,button),'Saved-value button aligns to the right of its input');
    }
    assert.equal(await page.$eval('applyhub-translation-settings input[name=apiKey]',n=>n.value),'');
    await page.type('applyhub-translation-settings input[name=apiKey]',changedApiKey);
    await page.click('[data-translation-check]');
    await page.waitForFunction(()=>document.querySelector('applyhub-translation-settings [data-settings-status]')?.textContent.includes('연결 확인됨'));
    await page.click('[data-translation-save]');
    await page.waitForFunction(()=>document.querySelector('applyhub-translation-settings [data-settings-status]')?.textContent.includes('저장됨'));
    assert.equal(await page.$eval('applyhub-translation-settings input[name=apiKey]',n=>n.value),'');
    await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('applyhub-translation-settings input[name=apiKey]');
    assert.equal(await page.$eval('applyhub-translation-settings input[name=apiKey]',n=>n.value),'');
    await page.click('[data-translation-reveal]');
    await page.waitForSelector('.secret-value-dialog[open] input[name=currentPassword]');
    assert.equal(await page.$('.secret-value-dialog [data-secret-value]'),null);
    await page.type('.secret-value-dialog input','wrong-password');await page.click('.secret-value-dialog [type=submit]');
    await page.waitForFunction(()=>document.querySelector('.secret-value-dialog [role=status]')?.textContent.includes('올바르지'));
    assert.equal(await page.$('.secret-value-dialog [data-secret-value]'),null);
    await page.type('.secret-value-dialog input',initialPassword);await page.click('.secret-value-dialog [type=submit]');
    await page.waitForSelector('.secret-value-dialog [data-secret-value]');
    assert.equal(await page.$eval('.secret-value-dialog textarea',n=>n.value),changedApiKey);
    await page.screenshot({path:path.join(out,'secret-api-dialog.png')});
    await page.keyboard.press('Escape');await page.waitForSelector('.secret-value-dialog',{hidden:true});
    assert.equal(await page.$('[data-secret-value]'),null);
    assert.equal(await page.$eval('applyhub-translation-settings input[name=apiKey]',n=>n.value),'');
    await page.click('[data-email-reveal]');await page.type('.secret-value-dialog input',initialPassword);await page.click('.secret-value-dialog [type=submit]');
    await page.waitForSelector('.secret-value-dialog textarea');assert.equal(await page.$eval('.secret-value-dialog textarea',n=>n.value),emailPassword);
    await page.click('[data-secret-close]');assert.equal(await page.$('[data-secret-value]'),null);
    await page.evaluate(()=>{window.originalSecretTimeout=window.setTimeout;window.setTimeout=(fn,delay,...args)=>{if(delay===60000)window.secretExpiry=fn;return window.originalSecretTimeout(fn,delay,...args);};});
    await page.click('[data-translation-reveal]');await page.type('.secret-value-dialog input',initialPassword);await page.click('.secret-value-dialog [type=submit]');
    await page.waitForSelector('.secret-value-dialog textarea');
    await page.evaluate(()=>{window.secretExpiry();window.setTimeout=window.originalSecretTimeout;delete window.originalSecretTimeout;delete window.secretExpiry;});
    assert.equal(await page.$('[data-secret-value]'),null,'Timed expiry removes visible secrets');
    await page.click('[data-email-reveal]');await page.type('.secret-value-dialog input',initialPassword);await page.click('.secret-value-dialog [type=submit]');await page.waitForSelector('.secret-value-dialog textarea');
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});
    assert.equal(await page.$('[data-secret-value]'),null,'Hiding the tab removes visible secrets');
    await page.$eval('applyhub-translation-settings',n=>n.scrollIntoView({block:'center'}));
    await page.screenshot({path:path.join(out,'api-settings-desktop.png')});
    await page.setViewport({width:390,height:844});await page.$eval('applyhub-translation-settings',n=>n.scrollIntoView({block:'center'}));
    assert(await page.$eval('applyhub-translation-settings',n=>n.scrollWidth<=n.clientWidth+1));
    await page.screenshot({path:path.join(out,'api-settings-mobile.png')});await page.setViewport({width:1440,height:1000});
    await browser.setCookie({name:admin.cookie.slice(0,i),value:admin.cookie.slice(i+1),url:base});
    await go('/applicant-recruitment-management');await page.click('tr[data-grid-row-clickable=true]');await page.waitForSelector('#applicantRecruitmentUnitModal:not(.hidden)');
    await translate('recruitment-names');assert.equal(await page.$eval('#applicantRecruitmentAdmissionNameEn',n=>n.value),'EN: 일반전형');assert.equal(await page.$eval('#applicantRecruitmentUnitNameMn',n=>n.value),'MN: 컴퓨터공학부');
    await page.click('#applicantRecruitmentUnitModalSaveButton');await page.waitForSelector('#applicantRecruitmentUnitModal.hidden');assert.equal((await a.getApplicantRecruitmentUnits())[0].admissionNameEn,'EN: 일반전형');
    await go('/applicant-question-template-management');await page.click('.form-template-thumbnail-open');await page.click(`[data-applicant-field-select="${field.id}"]`);await translate('question-application');
    assert.equal(await page.$eval('[data-applicant-field-input=questionTextMn]',n=>n.value),'MN: 시간 선택');assert.equal(await page.$eval('[data-applicant-field-input="optionEnglish:0"]',n=>n.value),'Existing morning','Default keeps authored translations');
    await page.click('[editor-key=question-application] .auto-translation-overwrite input');await translate('question-application');assert.equal(await page.$eval('[data-applicant-field-input="optionEnglish:0"]',n=>n.value),'EN: 오전');
    await saveQuestion('applicant');assert(await page.$(`[data-applicant-field-select="${field.id}"].is-editing`));assert.equal((await a.getApplicantFormFields()).find(f=>f.id===field.id).optionsMn.오전,'MN: 오전');
    for(const tab of ['documents','signup','terms']){
      await go('/applicant-question-template-management?tab='+tab);
      if(tab==='documents'){await page.click('.form-template-thumbnail-open');await page.click('[data-applicant-field-select]');await translate('question-documents');assert.equal(await page.$eval('[data-applicant-field-input=questionTextEn]',n=>n.value),'EN: 졸업증명서');}
      if(tab==='signup'){await page.click('[data-signup-field-select="translate-signup"]');await translate('question-signup');assert.equal(await page.$eval('[data-signup-field-input=questionTextMn]',n=>n.value),'MN: 주소');}
      if(tab!=='terms') {
        const prefix=tab==='signup'?'signup':'applicant';
        const selected=await page.$eval(`[data-${prefix}-field-select].is-editing`,n=>n.getAttribute('data-'+(n.hasAttribute('data-signup-field-select')?'signup':'applicant')+'-field-select'));
        await saveQuestion(prefix);
        assert(await page.$(`[data-${prefix}-field-select="${selected}"].is-editing`),'Editing keeps the same card selected');
      }
      if(tab==='terms'){await page.click('[data-term-select]');await translate('signup-terms');assert.equal(await page.$eval('[data-term-input=textEn]',n=>n.value),'EN: 연락처 {이름}EN: 을 확인하세요.');}
    }
    for(const tab of ['application','documents','signup']) {
      await go('/applicant-question-template-management?tab='+tab);
      const prefix=tab==='signup'?'signup':'applicant';
      if(tab!=='signup')await page.click('.form-template-thumbnail-open');
      await page.click(`[data-${prefix}-field-add]`);
      await page.type(`[data-${prefix}-field-input=questionText]`,'선택 유지 '+tab);
      const created=page.waitForResponse(r=>r.request().method()===(tab==='signup'?'PUT':'POST')&&r.url().includes(tab==='signup'?'/api/applicant-signup-settings':'/api/applicant-form-fields'));
      await page.click(`[data-${prefix}-field-form] button[type=submit]`);
      assert.equal((await created).status(),tab==='signup'?200:201);
      await page.waitForSelector(`[data-${prefix}-field-select].is-editing`);
      const selected=await page.$eval(`[data-${prefix}-field-select].is-editing`,n=>n.getAttribute('data-'+(n.hasAttribute('data-signup-field-select')?'signup':'applicant')+'-field-select'));
      assert.equal(await page.$eval(`[data-${prefix}-field-input=questionText]`,n=>n.value),'선택 유지 '+tab);
      await saveQuestion(prefix);
      assert(await page.$(`[data-${prefix}-field-select="${selected}"].is-editing`),'Saving a new question again updates the same card');
      const questions=tab==='signup'?(await services.membershipService.getSettings()).questions:await a.getApplicantFormFields();
      assert.equal(questions.filter(q=>(q.label||q.questionText)==='선택 유지 '+tab).length,1,'Repeat save must not create duplicates');
    }
    await go('/login-notice');await page.$eval('#loginNoticeEditor',n=>{n.innerHTML='<p><strong>접수 안내</strong></p><p>회원 @{회원가입:이름} <a href="https://example.test">확인</a></p>';n.dispatchEvent(new Event('input',{bubbles:true}));});await translate('notice-editor');
    const html=await page.$eval('#loginNoticeEditorMn',n=>n.innerHTML);assert(html.includes('<strong>MN: 접수 안내</strong>'));assert(html.includes('@{회원가입:이름}'));assert(html.includes('href="https://example.test"'));assert.equal(await page.$eval('[editor-key=notice-editor]',n=>n.value),'ko');
    await select('notice-editor','mn');const response=page.waitForResponse(r=>r.url().endsWith('/api/login-notice')&&r.request().method()==='PUT');await page.click('[data-notice-canvas=mn] [data-notice-action=save]');assert.equal((await response).status(),200);await page.reload({waitUntil:'networkidle0'});assert((await page.$eval('#loginNoticeEditorMn',n=>n.innerHTML)).includes('MN: 접수 안내'));
    await page.setViewport({width:390,height:844});await page.screenshot({path:path.join(out,'notice-mobile.png')});assert(await page.$eval('[editor-key=notice-editor]',n=>n.scrollWidth<=n.clientWidth+1));
    assert.deepEqual(errors,[]);
    const audit=JSON.stringify(await services.systemService.getSystemAuditLogs({limit:200}));
    for(const value of [apiKey,changedApiKey,emailPassword,'wrong-password'])assert(!audit.includes(value),'Audit logs must not contain credentials');
    let limited=false;
    for(let attempt=0;attempt<11;attempt++)if((await call(revealPath,{kind:'translation',currentPassword:'wrong-password'},superAccount.cookie)).status===429){limited=true;break;}
    assert(limited,'Password retries must be rate limited');
    const {createTranslationService}=require('../server/modules/system/service/translation');
    let quotaTime=Date.UTC(2099,0,15,12),providerCalls=0;
    const quotaDependencies={env:{GOOGLE_TRANSLATE_API_KEY:'test-only'},query,now:()=>quotaTime,fetchImpl:async(...args)=>{providerCalls++;return require('./translation-service-test').mockTranslationFetch(...args);}};
    const quotaService=createTranslationService(quotaDependencies);
    const quotaPayload={languages:['en'],entries:[{id:'f0',text:'한'.repeat(8000)}]};
    const concurrent=await Promise.allSettled([quotaService.translate(quotaPayload,'quota-a'),quotaService.translate(quotaPayload,'quota-b')]);
    assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(concurrent.find(r=>r.status==='rejected').reason.errorCode,'TRANSLATION_DAILY_LIMIT');
    assert.equal(providerCalls,2,'Only the reserved request reaches Google in two batches');
    const restartedService=createTranslationService(quotaDependencies);
    await assert.rejects(()=>restartedService.translate(quotaPayload,'quota-c'),e=>e.errorCode==='TRANSLATION_DAILY_LIMIT');
    quotaTime+=86400000;
    await restartedService.translate(quotaPayload,'quota-c');
    console.log('PASS: Google translation in all editors, preserved values/tags/HTML, saves, mobile controls and persistent concurrent daily limits');
  }catch(error){await page.screenshot({path:path.join(out,'failure.png')});console.error('Browser errors:',errors);throw error;}finally{await browser.close();}
}
module.exports={runTranslationChecks};
