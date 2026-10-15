const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const mysql=require('mysql2/promise');
const puppeteer=require('puppeteer-core');
const {getDbConfig}=require('../db');
const {createApplicationServices}=require('../server/app/services');
async function run(){
  const database='applyhub_translation_entry_test_'+Date.now();
  const admin=await mysql.createConnection(getDbConfig(false));
  let pool,child,browser;
  try {
    await admin.query('CREATE DATABASE `'+database+'` CHARACTER SET utf8mb4');
    const probe=http.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
    child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,DB_NAME:database,PORT:String(port),GOOGLE_TRANSLATE_API_KEY:'',SMTP_PASS:'production-entry-fixture-password'},stdio:['ignore','pipe','pipe'],windowsHide:true});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Production server startup timed out')),20000);child.stdout.on('data',data=>{if(String(data).includes('running at')){clearTimeout(timer);resolve();}});child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(new Error('Production server exited: '+code));});});
    pool=mysql.createPool({...getDbConfig(),database});
    const query=async(sql,params=[]) => (await pool.query(sql,params))[0];
    const services=createApplicationServices({fs,path,query,getPool:()=>pool,env:{DB_NAME:database},rootDir:path.resolve(__dirname,'..')});
    await services.authService.createAccount({id:'entry-super',name:'실행 경로 검증',role:services.superAdminRole});
    await query('UPDATE accounts SET password_temporary=0');
    const base='http://127.0.0.1:'+port;
    const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'entry-super',password:'1111'})});assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const response=await fetch(base+'/api/system-settings/translation',{headers:{Cookie:cookie}});assert.equal(response.status,200,'Real server.js must pass translation service to authenticated routes');const data=await response.json();assert.equal(data.hasApiKey,false);assert.equal(data.provider,'google');
    for(const [password,status] of [['wrong-password',403],['1111',200]]) {
      const secret=await fetch(base+'/api/system-settings/secrets/reveal',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({kind:'email',currentPassword:password})});
      assert.equal(secret.status,status);assert.equal(secret.headers.get('cache-control'),'no-store');
      if(status===200)assert.equal((await secret.json()).value,'production-entry-fixture-password');
    }
    browser=await puppeteer.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
    const page=await browser.newPage();await page.setViewport({width:1440,height:1000});await browser.setCookie({name:cookie.slice(0,cookie.indexOf('=')),value:cookie.slice(cookie.indexOf('=')+1),url:base});
    await page.setRequestInterception(true);
    page.on('request',request=>{
      if(new URL(request.url()).pathname==='/api/system-settings/email'&&request.method()==='GET')return request.respond({status:200,contentType:'application/json',body:JSON.stringify({host:'smtp.example.test',port:465,security:'tls',user:'fixture',from:'fixture@example.test',fromName:'테스트',hasPassword:false,passwordNeedsReset:true,source:'system'})});
      return request.continue();
    });
    await page.goto(base+'/super-admin',{waitUntil:'networkidle0'});await page.waitForSelector('applyhub-translation-settings input[name=apiKey]',{visible:true});
    assert.equal(await page.$eval('applyhub-email-settings [data-settings-status]',n=>n.textContent),'재입력 필요');
    assert(await page.$eval('.toast-warning',n=>n.textContent.includes('메일 비밀번호를 읽을 수 없습니다')));
    assert.equal(await page.$('applyhub-email-settings .system-settings-status'),null,'Warnings appear in a toast instead of a persistent paragraph');
    assert.equal(await page.$eval('applyhub-translation-settings input[name=apiKey]',n=>n.type),'password');
    await page.$eval('applyhub-translation-settings',n=>n.scrollIntoView({block:'center'}));
    const output=path.resolve('.tmp-translation');fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'production-api-settings.png')});
    console.log('PASS: real server.js authenticated settings endpoint and visible Google API key input');
  } finally {
    if(browser)await browser.close();
    if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}
    if(pool)await pool.end();
    await admin.query('DROP DATABASE IF EXISTS `'+database+'`');await admin.end();
  }
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
