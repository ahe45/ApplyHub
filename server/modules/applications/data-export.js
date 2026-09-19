const fs = require('fs');
const os = require('os');
const path = require('path');
const {pipeline, finished} = require('stream/promises');
const {once} = require('events');
const ExcelJS = require('exceljs');
const archiver = require('archiver');
const {getApplicantStatusLabel, findApplicantScheduleRecord} = require('../../../shared/domain/applicant-form');
const {printHistoryExportColumns, printHistorySummaryExportColumns} = require('../admit-cards/config');
let active = 0;

async function sendDataExport({service, query, body, response, buildContentDisposition, kind}) {
  if (active >= 2) throw Object.assign(new Error('다른 다운로드를 생성하고 있습니다. 잠시 후 다시 시도하세요.'), {statusCode:429});
  active++;
  let directory, output, archive;
  try {
    directory = await fs.promises.mkdtemp(path.join(os.tmpdir(),'applyhub-export-'));
    const filePath = path.join(directory, kind === 'photos' ? 'photos.zip' : 'export.xlsx');
    const requestedIds=Array.isArray(body.submissionIds)?body.submissionIds:Array.isArray(body.rows)?body.rows.map(row=>row.id):[];
    const ids = [...new Set(requestedIds.map(Number))].filter(id=>Number.isSafeInteger(id)&&id>0);
    if (kind !== 'print' && !ids.length) throw Object.assign(new Error('다운로드할 접수 이력이 없습니다.'),{statusCode:400});
    if (ids.length > 50000) throw Object.assign(new Error('한 번에 최대 50,000건을 다운로드할 수 있습니다.'),{statusCode:400});
    async function* submissions() {
      for (let offset=0;offset<ids.length;offset+=100) {
        const chunk=ids.slice(offset,offset+100);
        const byId=new Map((await service.getApplicantSubmissionsByIds(chunk)).map(row=>[Number(row.id),row]));
        for(const id of chunk) if(byId.has(id)) yield byId.get(id);
      }
    }
    if (kind === 'photos') {
      output=fs.createWriteStream(filePath); archive=archiver('zip',{store:true});
      const done=pipeline(archive,output); done.catch(()=>{});
      let count=0;
      for await (const row of submissions()) {
        let photo;
        try { photo=await service.getApplicantSubmissionPhoto(row.id,row); }
        catch(error) { if(error.status===404 || error.statusCode===404) continue; throw error; }
        const ready=once(archive,'entry');
        const name=String(row.examineeNo || row.id).replace(/[<>:"/\\|?*]/g,'_') + (photo.photoMime==='image/png'?'.png':'.jpg');
        archive.append(photo.photoBlob,{name}); await ready; count++;
      }
      if(!count) throw Object.assign(new Error('다운로드할 수험생 사진이 없습니다.'),{statusCode:400});
      await archive.finalize(); await done;
    } else {
      output=fs.createWriteStream(filePath);
      const done=finished(output);done.catch(()=>{});
      const workbook=new ExcelJS.stream.xlsx.WorkbookWriter({stream:output,useStyles:true,useSharedStrings:false});
      const sheet=(name,columns)=>{
        const result=workbook.addWorksheet(name,{views:[{state:'frozen',ySplit:1}]});
        result.columns=columns.map(column=>({...column,style:column.text===false?{}:{numFmt:'@'}}));
        result.getRow(1).font={bold:true};result.getRow(1).commit();return result;
      };
      if(kind==='print') {
        const filters={...body.filters,kind:'print'}, counts=new Map();
        const history=sheet('출력이력',printHistoryExportColumns);
        async function* pages(criteria) {
          let page=1;
          while(true) {
            const result=await service.submissionQuery.list({...criteria,page,pageSize:200},{includeOptions:false});
            for(const row of result.rows) yield row;
            if(page*result.pageSize>=result.total) break;
            page++;
          }
        }
        for await(const row of pages(filters)) {history.addRow(row).commit();counts.set(row.examineeNo,(counts.get(row.examineeNo)||0)+1);}
        history.commit();
        const summary=sheet('수험번호별 출력횟수',printHistorySummaryExportColumns);
        const columns={...filters.columns};delete columns.printedAt;
        for await(const row of pages({...filters,kind:'history',columns,sort:(filters.sort||[]).filter(rule=>rule.key!=='printedAt')})) {
          summary.addRow({...row,printCount:counts.get(row.examineeNo)||0}).commit();
          counts.delete(row.examineeNo);
        }
        for(const [examineeNo,printCount] of counts) summary.addRow({examineeNo,printCount}).commit();
        summary.commit();
      } else {
        const [maximum]=await query('SELECT COALESCE(MAX(n),0) AS n FROM (SELECT COUNT(*) AS n FROM app_subm GROUP BY id) counts');
        const fixed=[['접수번호','id',14],['이름','name',20],['이메일','email',28],['상태','statusLabel',12],['수험번호','examineeNo',18],['접수일시','createdAt',22],['최종수정','updatedAt',22]].map(([header,key,width])=>({header,key,width}));
        const columns=[...fixed,...Array.from({length:Number(maximum.n)},(_,i)=>({header:'질문'+(i+1),key:'answer'+(i+1),width:24}))];
        const target=sheet('접수이력',columns), schedules=await service.getApplicantSchedules();
        for await(const row of submissions()) {
          const record={...row,statusLabel:getApplicantStatusLabel(row.status,findApplicantScheduleRecord(schedules,row)||{})};
          (row.answerItems||[]).forEach((answer,i)=>{record['answer'+(i+1)]=['photo','file'].includes(answer.inputType)?(answer.value?.hasPhoto||answer.value?.hasFile?answer.value.fileName:'미등록'):Array.isArray(answer.value)?answer.value.join(', '):String(answer.value??'');});
          target.addRow(record).commit();
        }
        target.commit();
      }
      await workbook.commit(); await done;
    }
    const name=kind==='photos'?'접수 이력 수험생 사진.zip':kind==='print'?'수험표 출력 이력.xlsx':'접수 이력 데이터.xlsx';
    response.writeHead(200,{'Content-Type':kind==='photos'?'application/zip':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':buildContentDisposition('attachment',name),'Content-Length':(await fs.promises.stat(filePath)).size,'Cache-Control':'no-store'});
    await pipeline(fs.createReadStream(filePath),response);
  } finally {
    archive?.destroy();output?.destroy();
    if(output) await finished(output).catch(()=>{});
    if(directory) {await fs.promises.unlink(path.join(directory,kind==='photos'?'photos.zip':'export.xlsx')).catch(()=>{});await fs.promises.rmdir(directory).catch(()=>{});}
    active--;
  }
}
module.exports={sendDataExport};
