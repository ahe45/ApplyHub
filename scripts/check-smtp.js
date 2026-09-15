const path = require('node:path');
const {query, getPool} = require('../db');
const {createEmailSettingsService} = require('../server/modules/system/service/email-settings');
const service = createEmailSettingsService({query, rootDir: path.resolve(__dirname, '..'),
  createHttpError: (statusCode, message, errorCode) => Object.assign(new Error(message), {statusCode, errorCode})});
service.checkEmailSettings().then(result => console.log(result.message + ' 메일은 발송하지 않았습니다.'))
  .catch(error => {console.error(error.errorCode ? error.message : '메일 설정 점검에 실패했습니다. 서버와 데이터베이스 설정을 확인하세요.'); process.exitCode = 1;})
  .finally(() => getPool().end());
