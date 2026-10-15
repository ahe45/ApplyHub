const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
async function run(){
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['/login','/applicant/signup','/account-recovery']){
  await page.goto('http://localhost:3000'+route,{waitUntil:'networkidle0'});
  assert(await page.$('script[src="/client/app/field-state.js"]'),route+' loads shared field state');
  await page.evaluate(()=>{const form=document.createElement('form');form.id='fieldStateFixture';form.innerHTML='<input name="text"><input name="number" type="number" value="0"><textarea name="textArea"></textarea><select name="select"><option value="">선택하세요</option><option value="yes">선택됨</option></select><select name="multiple" multiple><option value="a">A</option><option value="b">B</option></select><input name="check" type="checkbox"><div class="paper"><input name="paperValue"></div>';document.body.append(form);});
  const state=()=>page.evaluate(()=>Object.fromEntries([...document.querySelector('#fieldStateFixture').elements].filter(n=>n.name).map(n=>[n.name,n.getAttribute('data-field-empty')])));
  await page.waitForFunction(()=>document.querySelector('#fieldStateFixture input').hasAttribute('data-field-empty'));
  assert.deepEqual(await state(),{text:'true',number:'false',textArea:'true',select:'true',multiple:'true',check:null,paperValue:null});
  await page.type('#fieldStateFixture [name=text]','입력값');
  await page.evaluate(()=>{const f=document.querySelector('#fieldStateFixture');f.elements.textArea.value='자동 입력';f.elements.select.value='yes';f.elements.multiple.options[1].selected=true;});
  assert.deepEqual(await state(),{text:'false',number:'false',textArea:'false',select:'false',multiple:'false',check:null,paperValue:null});
  for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);const colors=await page.evaluate(()=>{const f=document.querySelector('#fieldStateFixture');return {filled:getComputedStyle(f.elements.text).backgroundColor,selected:getComputedStyle(f.elements.select).backgroundColor,empty:(()=>{f.elements.text.value='';return null;})()};});await page.waitForFunction(()=>document.querySelector('#fieldStateFixture [name=text]').dataset.fieldEmpty==='true');const empty=await page.$eval('#fieldStateFixture [name=text]',n=>getComputedStyle(n).backgroundColor);assert.notEqual(colors.filled,empty,route+' '+theme+' distinguishes empty values');assert.equal(colors.filled,colors.selected);await page.$eval('#fieldStateFixture [name=text]',n=>n.value='입력값');}
  await page.$eval('#fieldStateFixture',form=>form.reset());await page.waitForFunction(()=>document.querySelector('#fieldStateFixture [name=text]').dataset.fieldEmpty==='true');
  assert.deepEqual(await state(),{text:'true',number:'false',textArea:'true',select:'true',multiple:'true',check:null,paperValue:null});
  await page.evaluate(()=>{const f=document.querySelector('#fieldStateFixture');f.elements.select.innerHTML='<option value="ready">준비됨</option>';const input=document.createElement('input');input.name='late';input.value='동적';f.append(input);});
  await page.waitForFunction(()=>document.querySelector('#fieldStateFixture [name=late]').dataset.fieldEmpty==='false');assert.equal((await state()).select,'false');
 }
 assert.deepEqual(errors,[]);console.log('PASS: shared field backgrounds on admin, applicant and recovery pages; typing, programmatic values, zero, selects, multiselects, reset, dynamic controls and both themes');
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e.message);process.exitCode=1;});
