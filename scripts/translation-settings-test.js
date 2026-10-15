const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createTranslationSettingsService} = require('../server/modules/system/service/translation-settings');
const {createTranslationService} = require('../server/modules/system/service/translation');
async function run() {
  const rootDir=fs.mkdtempSync(path.join(os.tmpdir(),'applyhub-translation-settings-'));
  const records=new Map();
  const query=async(sql,params)=>{
    if(sql.startsWith('SELECT')) return records.has(params[0])?[{setting_value:records.get(params[0])}]:[];
    assert(sql.startsWith('INSERT INTO system_set'));records.set(params[0],params[1]);return {affectedRows:1};
  };
  const createHttpError=(statusCode,message,errorCode)=>Object.assign(new Error(message),{statusCode,errorCode});
  const key='AIza'+'x'.repeat(35),replacement='AIza'+'y'.repeat(35);
  const dependencies={query,rootDir,createHttpError,env:{GOOGLE_TRANSLATE_API_KEY:key}};
  const settings=createTranslationSettingsService(dependencies);
  const keyPath=path.join(rootDir,'.private','translation.key');
  try {
    assert.equal((await settings.getSettings()).source,'environment');
    assert.equal(await settings.getApiKey(),key);
    await settings.updateSettings({apiKey:replacement});
    assert.equal(await settings.getApiKey(),replacement);
    assert(!JSON.stringify(await settings.getSettings()).includes(replacement));
    assert(![...records.values()].join('').includes(replacement));
    assert.equal(fs.statSync(keyPath).size,32);
    const fresh=createTranslationSettingsService({...dependencies,env:{}});
    assert.equal(await fresh.getApiKey(),replacement,'Key survives a fresh instance without any environment credential');
    await fresh.updateSettings({apiKey:''});assert.equal(await fresh.getApiKey(),replacement);
    const before=records.get('googleTranslationApiSettings');
    assert.equal(await fresh.resolveApiKey({apiKey:key}),key);
    assert.equal(records.get('googleTranslationApiSettings'),before,'Unsaved connection checks do not change settings');
    for(const invalid of [null,[],{}, {apiKey:'bad'}, {apiKey:'x'.repeat(257)}, {apiKey:'bad\nkey'}]) await assert.rejects(()=>fresh.updateSettings(invalid),e=>e.statusCode===400);
    let usedKey='';
    const translator=createTranslationService({settings:fresh,fetchImpl:async(url,options)=>{usedKey=options.headers['X-goog-api-key'];const body=JSON.parse(options.body);return {ok:true,json:async()=>({data:{translations:body.q.map(text=>({translatedText:text}))}})};}});
    await translator.checkSettings({apiKey:key},'check');assert.equal(usedKey,key);
    await translator.translate({languages:['en'],entries:[{id:'f0',text:'안내'}]},'translate');assert.equal(usedKey,replacement);
    fs.unlinkSync(keyPath);
    assert.equal((await fresh.getSettings()).keyNeedsReset,true);
    await assert.rejects(()=>fresh.getApiKey(),e=>e.errorCode==='TRANSLATION_KEY_UNAVAILABLE');
    await fresh.updateSettings({apiKey:key});assert.equal(await fresh.getApiKey(),key);
    console.log('PASS: encrypted API storage, no plaintext output, restart persistence, blank-key retention, unsaved tests and missing-key recovery');
  } finally {
    if(fs.existsSync(keyPath))fs.unlinkSync(keyPath);
    if(fs.existsSync(path.dirname(keyPath)))fs.rmdirSync(path.dirname(keyPath));
    fs.rmdirSync(rootDir);
  }
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
