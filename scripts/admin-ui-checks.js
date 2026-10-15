const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const config = require('../shared/app-config');

async function runAdminUiChecks({ services, query, base, call }) {
  const auditOnly = process.argv.includes('--audit-only');
  await services.authService.createAccount({ id: 'ui-super', name: '화면 검증 관리자', role: config.superAdminRole });
  await query('UPDATE accounts SET password_temporary = 0');
  const { initialPassword } = await services.systemService.getSystemSettings();
  const login = await call('/api/auth/login', { id: 'ui-super', password: initialPassword });
  assert.equal(login.status, 200);
  await services.applicantService.createApplicantRecruitmentUnit({ trackName:'수시', admissionCode:'SU', admissionName:'일반전형', admissionNameEn:'General admission', admissionNameMn:'Ерөнхий элсэлт', seriesCode:'EN', seriesName:'공학계열', unitCode:'CS', unitName:'컴퓨터공학부', unitNameEn:'Computer Science', unitNameMn:'Компьютерын ухаан', majorCode:'SE', majorName:'소프트웨어전공' });
  await services.applicantService.createApplicantFormField({ fieldKey:'ui-choice', questionText:'지원 분야', questionTextEn:'Field of study', questionTextMn:'Суралцах чиглэл', inputType:'select', options:['오전반','오후반'], optionsEn:{오전반:'Morning',오후반:'Afternoon'}, optionsMn:{오전반:'Өглөө',오후반:'Үдээс хойш'} });
  const choiceField=(await services.applicantService.getApplicantFormFields()).find(f=>f.fieldKey==='ui-choice');
  await services.membershipService.saveSettings({terms:[{id:'ui-term',title:'개인정보 수집 및 이용 동의',text:'개인정보 수집 및 이용에 동의합니다.',titleEn:'Privacy consent',textEn:'Privacy terms',titleMn:'Нууцлал',textMn:'Нууцлалын нөхцөл',enabled:true,required:true}]});
  await services.applicantService.createApplicantFormField({formScope:'documents',fieldKey:'ui-document',questionText:'졸업증명서',inputType:'file'});
  const member=await query("INSERT INTO applicant_members (login_id,password_hash,name,email,email_verified,profile_json,consent_json) VALUES ('ui@example.test','unused','화면 검증 지원자','ui@example.test',1,?, '{}')",[JSON.stringify({birth:'2000-02-03',phone:'01012345678'})]);
  const meta=await query("INSERT INTO app_meta (member_id,examinee_no) VALUES (?,'SU000001')",[member.insertId]);
  const nameField=(await services.applicantService.getApplicantFormFields()).find(f=>f.systemFieldKey==='name');
  for(const [key,value] of [[nameField.fieldKey,'화면 검증 지원자'],['__applicant_selection_track','수시'],['__applicant_selection_admission','일반전형'],['__applicant_selection_series','공학계열'],['__applicant_selection_unit','컴퓨터공학부'],['__applicant_selection_major','소프트웨어전공'],['ui-choice','오전반']])
    await query("INSERT INTO app_subm (id,applicant_name,email,status,field_key,answer_data) VALUES (?,'화면 검증 지원자','ui@example.test','submitted',?,?)",[meta.insertId,key,value]);
  const detailResponse=await call('/api/applicant-submissions/'+meta.insertId,null,login.cookie,'GET');
  assert.equal(detailResponse.status,200,JSON.stringify(detailResponse.body));
  const browser = await puppeteer.launch({headless:true, executablePath:process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const out = path.resolve('.tmp-admin-ui',auditOnly?'before':'after'); fs.mkdirSync(out,{recursive:true});
  const report = [], errors = [];
  const context = await browser.createBrowserContext();
  const i=login.cookie.indexOf('='); await context.setCookie({name:login.cookie.slice(0,i),value:login.cookie.slice(i+1),url:base});
  const page = await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1440,height:1000});
  const go=async url=>{await page.goto(base+url,{waitUntil:'networkidle0'}); await page.waitForSelector('#appShell:not(.auth-locked)');};
  const capture=async(name)=>{
    const metrics=await page.evaluate(()=>{
      const visible=n=>n.getClientRects().length && getComputedStyle(n).visibility!=='hidden';
      const nodes=[...document.querySelectorAll('#viewRoot input,#viewRoot select,#viewRoot textarea,#viewRoot button,#viewRoot label,#viewRoot p,.modal:not(.hidden) input,.modal:not(.hidden) select,.modal:not(.hidden) label,.modal:not(.hidden) button,dialog[open] input,dialog[open] select,dialog[open] button,dialog[open] label,dialog[open] p,.table-filter-menu-overlay input,.table-filter-menu-overlay label,.table-filter-menu-overlay button')].filter(visible);
      const counts={}, examples={};
      nodes.forEach(n=>{const size=getComputedStyle(n).fontSize;counts[size]=(counts[size]||0)+1;(examples[size]||=[]).length<8 && examples[size].push({tag:n.tagName,id:n.id,class:n.className,text:(n.textContent||n.placeholder||'').trim().slice(0,70)});});
      const spills=[...document.querySelectorAll('#viewRoot .panel-card,#viewRoot .section-header,#viewRoot .form-card,#viewRoot .form-grid,.modal:not(.hidden) .modal-header,.modal:not(.hidden) .field,.modal:not(.hidden) .modal-sheet')].filter(visible).filter(n=>n.scrollWidth>n.clientWidth+2).map(n=>({id:n.id,class:n.className,width:n.clientWidth,scroll:n.scrollWidth}));
      const details=[...document.querySelectorAll('#viewRoot *')].filter(visible).filter(n=>n.scrollWidth>n.clientWidth+2 && !n.closest('.table-wrap,.template-card-thumbnail-sheet,.template-editor-surface')).map(n=>({id:n.id,tag:n.tagName,class:n.className,width:n.clientWidth,scroll:n.scrollWidth,text:n.textContent.slice(0,70)}));
      const authored='.template-card-thumbnail-sheet,.template-preview-stage,.template-editor-surface,.notice-canvas-preview';
      const wrongFonts=nodes.filter(n=>n.matches('input,select,textarea,button,label,p')&&!n.closest(authored)&&!(n.closest('#viewRoot')&&!document.body.classList.contains('admin-ui'))&&!n.classList.contains('sr-only')&&!(n.matches('.icon-button,.table-filter-close')&&n.textContent.trim()==='×')&&getComputedStyle(n).fontSize!=='13.6px').map(n=>({id:n.id,class:n.className,size:getComputedStyle(n).fontSize,text:n.textContent.slice(0,50)}));
      const overlaps=[];
      document.querySelectorAll('.modal:not(.hidden) .examinee-detail-layout,.modal:not(.hidden) .upload-modal-body,#viewRoot .applicant-settings-layout').forEach(parent=>{
        const children=[...parent.children].filter(visible);
        for(let i=0;i<children.length;i++)for(let j=i+1;j<children.length;j++){
          const a=children[i].getBoundingClientRect(),b=children[j].getBoundingClientRect();
          if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>3&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>3)overlaps.push([children[i].className,children[j].className]);
        }
      });
      const wrongLanguages=[...document.querySelectorAll('[data-language-editor] [data-edit-language]')].filter(visible).filter(n=>n.dataset.editLanguage!==n.closest('[data-language-editor]').dataset.activeLanguage).map(n=>({language:n.dataset.editLanguage,active:n.closest('[data-language-editor]').dataset.activeLanguage,text:n.textContent.slice(0,50)}));
      return {counts,examples,spills,details,wrongFonts,overlaps,wrongLanguages,bodyOverflow:document.documentElement.scrollWidth>innerWidth+1};
    });
    report.push({name,...metrics});
    await page.screenshot({path:path.join(out,name+'.png')});
  };
  const language=async(key,locale)=>{await page.click(`[editor-key="${key}"] .language-menu-trigger`);await page.click(`[editor-key="${key}"] [data-language="${locale}"]`);};
  try {
    if(process.argv.includes('--filters')){
      for(const width of [1440,390])for(const url of ['/applicant-recruitment-management','/applicant-history','/accounts']){
        await page.setViewport({width,height:900});await go(url);await page.click('[data-grid-filter]');await page.waitForSelector('[data-grid-filter-menu-overlay]',{visible:true});await capture(url.slice(1)+'-filter-'+width);
        assert(await page.$eval('[data-grid-filter-menu-overlay]',n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}),'Filter stays within viewport');
      }
      fs.writeFileSync(path.join(out,'filters.json'),JSON.stringify(report,null,2));for(const row of report)assert.deepEqual(row.wrongFonts,[],row.name+': fonts');assert.deepEqual(errors,[]);console.log('PASS: grid filter popovers, text/control sizes and desktop/mobile placement');return;
    }
    if(process.argv.includes('--native')){
      const screens=async(name,selector)=>{
        for(const width of [1440,768,390]){await page.setViewport({width,height:900});await capture(name+'-'+width);assert(await page.$eval(selector,n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}),name+' fits');}
        await page.setViewport({width:1440,height:1000});
      };
      for(const kind of ['photos','documents']){
        await go('/applicant-history');await page.click('[data-open-modal=applicantSubmissionDownloadModal]');await page.click(`[data-applicant-archive-kind=${kind}]`);await page.waitForSelector('.applicant-archive-dialog[open]');await screens('archive-'+kind,'.applicant-archive-dialog');await page.click('[data-archive-close]');
      }
      await go('/applicant-documents');await page.click('[data-document-detail]');await page.waitForSelector('#documentManagementDetail[open]');await screens('document-detail','#documentManagementDetail');await page.click('#documentManagementDetail [data-document-close]');
      await page.waitForFunction(()=>!document.querySelector('#documentManagementDetail') && !!document.querySelector('[data-document-status-row]'));
      await page.$eval('[data-document-status-row]',n=>n.click());await page.waitForSelector('#documentStatusPopover');await capture('document-status-popover');await page.keyboard.press('Escape');
      await go('/admit-cards');await page.click('[data-grid-select-all]');await page.click('[data-open-modal=batchPrintDownloadModal]');await page.waitForSelector('#batchPrintDownloadModal:not(.hidden)');await screens('batch-download','#batchPrintDownloadModal .modal-sheet');await page.click('#batchPrintDownloadModal button[data-close-modal]');
      await go('/applicant-recruitment-management');await page.click('tr[data-grid-row-clickable=true]');await page.evaluate(()=>document.documentElement.dataset.theme='dark');await screens('recruitment-dark','#applicantRecruitmentUnitModal .modal-sheet');await page.click('#applicantRecruitmentUnitModal button[data-close-modal]');
      await go('/templates');await page.click('[data-template-edit]');await page.waitForFunction(()=>!!window.ApplyHubExamListEditor?.instance);await page.evaluate(()=>document.documentElement.dataset.theme='dark');await capture('editor-dark');await page.evaluate(()=>document.documentElement.dataset.theme='light');
      await services.authService.createAccount({id:'ui-new',name:'최초 관리자',role:config.superAdminRole});
      const temporary=await call('/api/auth/login',{id:'ui-new',password:initialPassword});const split=temporary.cookie.indexOf('=');await context.setCookie({name:temporary.cookie.slice(0,split),value:temporary.cookie.slice(split+1),url:base});
      await page.goto(base+'/login',{waitUntil:'networkidle0'});await page.waitForSelector('#passwordSetupModal:not(.hidden)');await screens('password-setup','#passwordSetupModal .modal-sheet');
      fs.writeFileSync(path.join(out,'native.json'),JSON.stringify(report,null,2));
      assert.deepEqual(errors,[]);for(const row of report){assert.deepEqual(row.spills,[],row.name+': overflow');assert.deepEqual(row.wrongFonts,[],row.name+': typography');assert.deepEqual(row.wrongLanguages,[],row.name+': initial language visibility');}
      console.log('PASS: native archive/document dialogs, status popover, batch download, forced password setup and dark editor/recruitment');return;
    }
    if(process.argv.includes('--detail')){
      for(const width of [1440,390]) {await page.setViewport({width,height:1000});for(const url of ['/system-backup-restore','/templates','/super-admin']){await go(url);await capture(url.slice(1)+'-'+width);await page.$eval('#viewRoot',n=>n.scrollTop=n.scrollHeight);await capture(url.slice(1)+'-bottom-'+width);}}
      fs.writeFileSync(path.join(out,'detail.json'),JSON.stringify(report,null,2));
      console.log(JSON.stringify(report.map(({name,spills,details})=>({name,spills,details})),null,2));return;
    }
    for(const route of config.viewRouteDefinitions) {await go(route.path);await capture(route.view);}
    await go('/applicant-recruitment-management');await page.click('tr[data-grid-row-clickable=true]');await page.waitForSelector('#applicantRecruitmentUnitModal:not(.hidden)');
    for(const locale of ['ko','en','mn']) {await language('recruitment-names',locale);await capture('recruitment-'+locale);}
    await page.setViewport({width:768,height:850});await capture('recruitment-768');
    await page.setViewport({width:390,height:844});await capture('recruitment-390');
    await page.setViewport({width:1440,height:1000});await go('/applicant-schedules');await page.click('tr[data-grid-row-clickable=true]');await page.waitForSelector('#applicantScheduleModal:not(.hidden)');await capture('schedule-modal');
    await page.setViewport({width:768,height:850});await capture('schedule-768');await page.setViewport({width:390,height:844});await capture('schedule-390');
    await page.setViewport({width:1440,height:1000});
    for(const tab of ['application','documents','signup','terms']){
      await go('/applicant-question-template-management?tab='+tab);
      if(tab==='application'||tab==='documents') {const open=await page.$('.form-template-thumbnail-open');if(open)await open.click();const field=await page.$(tab==='application'?`[data-applicant-field-select="${choiceField.id}"]`:'[data-applicant-field-select]');if(field)await field.click();}
      if(tab==='signup'){const field=await page.$('[data-signup-field-select]');if(field)await field.click();}
      if(tab==='terms') {await page.click('[data-term-select]');}
      await capture('question-'+tab);
      const key=await page.$eval('applyhub-language-menu[editor-key]',n=>n.getAttribute('editor-key')).catch(()=>null);
      if(key)for(const locale of ['en','mn']){await language(key,locale);await capture('question-'+tab+'-'+locale);}
    }
    await go('/login-notice');for(const locale of ['ko','en','mn']){await language('notice-editor',locale);await capture('notice-'+locale);}
    const modalCheck=async(name,trigger,modal)=>{
      await page.click(trigger);await page.waitForSelector(modal+':not(.hidden)');
      for(const width of [1440,768,390]){await page.setViewport({width,height:900});await capture(name+'-'+width);
        if(!auditOnly) assert(await page.$eval(modal+' .modal-sheet',n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}),name+' stays within viewport');
      }
      await page.click(modal+' button[data-close-modal]');await page.setViewport({width:1440,height:1000});
    };
    await go('/accounts');await modalCheck('account-create','[data-open-modal=accountCreateModal]','#accountCreateModal');
    await go('/applicant-recruitment-management');await modalCheck('recruitment-upload','[data-open-modal=applicantUnitUploadModal]','#applicantUnitUploadModal');
    await go('/applicant-history');await modalCheck('submission-download','[data-open-modal=applicantSubmissionDownloadModal]','#applicantSubmissionDownloadModal');
    await modalCheck('submission-detail','[data-applicant-submission-toggle]','#applicantSubmissionDetailModal');
    await go('/applicant-members');await page.click('[data-member-list-detail]');await page.waitForSelector('#memberDetailPanel');await capture('member-detail');
    await go('/system-backup-restore');await modalCheck('audit-log','[data-system-audit-log-action=open]','#systemAuditLogModal');
    await go('/templates');await modalCheck('template-preview','[data-template-preview]','#templatePreviewModal');
    await page.click('[data-template-edit]');await page.waitForFunction(()=>!!window.ApplyHubExamListEditor?.instance);await capture('template-editor');
    assert.equal(await page.$('[data-editor-recruitment], [data-editor-data-source]'), null);
    await page.setViewport({width:768,height:850});for(const route of config.viewRouteDefinitions){await go(route.path);await capture(route.view+'-768');}
    await page.setViewport({width:390,height:844});for(const route of config.viewRouteDefinitions){await go(route.path);await capture(route.view+'-390');}
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    assert.deepEqual(errors,[]);
    if(!auditOnly){for(const row of report){assert.equal(row.bodyOverflow,false,row.name+': body overflow');assert.deepEqual(row.spills,[],row.name+': containers overflow');assert.deepEqual(row.wrongFonts,[],row.name+': typography');assert.deepEqual(row.overlaps,[],row.name+': overlapping sections');assert.deepEqual(row.wrongLanguages,[],row.name+': language visibility');}}
    console.log('PASS: all admin routes, tabs, language editors, dialog sizes, typography, and desktop/tablet/mobile containment');
  } catch(error) {
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    await page.screenshot({path:path.join(out,'failure.png')});
    console.error('Browser errors:',errors);throw error;
  } finally {await browser.close();}
}
module.exports={runAdminUiChecks};
