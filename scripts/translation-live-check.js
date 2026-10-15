require('dotenv').config({quiet:true});
const path=require('node:path');
const {query,getPool}=require('../db');
const {createTranslationService}=require('../server/modules/system/service/translation');
const {createTranslationSettingsService}=require('../server/modules/system/service/translation-settings');
const settings=createTranslationSettingsService({query,rootDir:path.resolve(__dirname,'..'),createHttpError:(statusCode,message,errorCode)=>Object.assign(new Error(message),{statusCode,errorCode})});
createTranslationService({query,settings}).translate({languages:['en','mn'],entries:[{id:'f0',text:'접수 기간'},{id:'f1',text:'수험번호 {수험번호}'}]},'connection-check')
  .then(result=>console.log(JSON.stringify({ok:true,translations:result.translations})))
  .catch(error=>{console.error(JSON.stringify({ok:false,code:error.errorCode,message:error.errorCode?error.message:'번역 연결을 확인하지 못했습니다.'}));process.exitCode=1;})
  .finally(()=>getPool().end());
