const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const data = require('../client/features/dashboard/data');

const now = Date.parse('2026-09-15T09:30:00+09:00');
function fixture() {
  const fields = [
    {fieldKey:'document', questionText:'졸업 증명서', inputType:'file', formScope:'documents', active:true, required:true},
    {fieldKey:'optional', inputType:'file', formScope:'documents', active:true, required:false},
    {fieldKey:'old', inputType:'file', formScope:'documents', active:false, required:true},
    {fieldKey:'applicationFile', inputType:'file', formScope:'application', active:true, required:true},
  ];
  const submissions = Array.from({length:8}, (_,index) => ({
    id:index+1, name:['김민서','이준호','박서연','정수빈','최지우','한도윤','윤하린','다른전형'][index],
    email:'test@example.test', status:'submitted', examineeNo:`26090000${index+1}`,
    track:'9월', admission:index===7 ? '편입학' : '신입학', series:'인문', unit:'인문학부', major:'',
    createdAt:`2026-09-${index<2 ? '15' : String(15-index).padStart(2,'0')} 09:00:00`,
    // Updating documents today must not count as a new application.
    updatedAt:'2026-09-15 09:20:00',
    answerMap: index%2 ? {document:{hasFile:true,fileName:`doc-${index}.pdf`}} : {}, answerItems:[], hasPhoto:false,
  }));
  const schedules = [
    {id:1,trackName:'9월',admissionName:'신입학', applicantScheduleStartAt:'2026-09-01T09:00',applicantScheduleEndAt:'2026-09-16T18:00',
      documentSubmissionScheduleStartAt:'2026-09-10T09:00',documentSubmissionScheduleEndAt:'2026-09-20T18:00',
      admitCardLookupScheduleStartAt:'2026-09-21T09:00',admitCardLookupScheduleEndAt:'2026-09-30T18:00'},
    {id:2,trackName:'9월',admissionName:'편입학',applicantScheduleStartAt:'2026-10-01T09:00',applicantScheduleEndAt:'2026-10-20T18:00'},
  ];
  return {fields,submissions,schedules,recruitmentUnits:schedules.map(s=>({...s,seriesName:'인문'}))};
}
function verifyData() {
  const manager = fixture(), filters = {track:'9월',admission:'신입학',series:'인문'};
  const result = data.buildDashboardData(manager,filters,now);
  assert.equal(result.total,7); assert.equal(result.todayCount,2); assert.equal(result.missingCount,4);
  assert.deepEqual(result.days.map(d=>d.count),[1,1,1,1,1,0,2]);
  assert.equal(result.recent.length,5); assert.deepEqual(result.recent.map(r=>r.id),[2,1,3,4,5]);
  assert.equal(result.schedule.id,1); assert.equal(result.scheduleCount,1);
  assert.deepEqual(result.schedule.periods.map(p=>p.status),['open','open','upcoming']);
  for (const [mode,count] of [['all',7],['today',2],['documents',4]]) {
    const filter = data.readHistoryFilter(new URL(data.historyUrl(mode,filters,result.today),'http://test').search);
    assert.equal(data.filterHistoryRows(manager.submissions,manager.fields,filter).length,count);
  }
  assert.equal(data.buildDashboardData({...manager,fields:[]},filters,now).missingCount,0);
  assert.equal(data.buildDashboardData(manager,{admission:'없음'},now).total,0);
  assert.equal(data.buildDashboardData(manager,{admission:'없음'},now).schedule,null);
  assert.equal(data.koreaDate(Date.parse('2026-09-14T15:00:00Z')),'2026-09-15');
  const type={key:'applicantSchedule',label:'원서접수'};
  assert.equal(data.schedulePeriod(manager.schedules[0],type,Date.parse('2026-09-16T18:00:59+09:00')).status,'open');
  assert.equal(data.schedulePeriod(manager.schedules[0],type,Date.parse('2026-09-16T18:01:00+09:00')).status,'ended');
  assert.equal(data.schedulePeriod({},type,now).status,'unset');
  console.log('PASS: dashboard counts, document scope, date boundaries, schedules and matching history filters');
}

async function verifyDashboard(page, base) {
  verifyData();
  const bootstrap = await page.evaluate(async () => (await fetch('/api/bootstrap')).json());
  let manager = fixture();
  const handler = request => {
    if (new URL(request.url()).pathname === '/api/bootstrap') return request.respond({status:200,contentType:'application/json',body:JSON.stringify({
      ...bootstrap, serverDate:'2026-09-15', serverTime:now, applicantManager:{...bootstrap.applicantManager,...manager},
      examinees:manager.submissions.map(row=>({...row,examineeNo:row.examineeNo})),
    })});
    return request.continue();
  };
  await page.setRequestInterception(true); page.on('request',handler);
  const artifacts = path.resolve(__dirname,'../.tmp-dashboard-check'); fs.mkdirSync(artifacts,{recursive:true});
  const go = async () => {await page.goto(base+'/dashboard',{waitUntil:'networkidle2'});await page.waitForSelector('.dashboard-metric');};
  try {
    await go();
    for (const theme of ['light','dark']) {
      await page.evaluate(theme=>{localStorage.setItem('applyhub.theme',theme);},theme);
      for (const width of [1440,768,390]) {
        await page.setViewport({width,height:1000}); await go();
        assert.equal(await page.$$eval('.dashboard-metric',nodes=>nodes.length),3);
        assert.equal(await page.$$eval('.dashboard-day',nodes=>nodes.length),7);
        assert.equal(await page.$$eval('.dashboard-recent-table tbody tr',nodes=>nodes.length),5);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
        assert.equal(await page.$eval('.dashboard-day:nth-child(6) .dashboard-day-bar',node=>node.getBoundingClientRect().height),0);
        await page.screenshot({path:path.join(artifacts,`${theme}-${width}.png`),fullPage:true});
      }
    }
    await page.setViewport({width:1440,height:1000}); await go();
    // Exercise the actual common-filter change event before following a metric link.
    await page.select('#headerAdmission','신입학');
    await page.waitForFunction(()=>document.querySelector('[data-dashboard-metric="all"]').textContent==='7건');
    for(const [mode,expected] of [['today',2],['documents',4],['all',7]]) {
      await Promise.all([page.waitForNavigation({waitUntil:'networkidle2'}),page.click(`.dashboard-metric[href*="dashboard=${mode}"]`)]);
      await page.waitForSelector('.dashboard-history-filter');
      assert.equal(await page.evaluate(()=>getGridRows('applicantHistoryGrid').length),expected);
      assert(new URL(page.url()).searchParams.get('admission')==='신입학');
      await go();
    }
    await page.click('.dashboard-recent-table tbody tr:first-child td:nth-child(3)');
    await page.waitForSelector('#applicantSubmissionDetailModal:not(.hidden)');
    assert((await page.$eval('#applicantSubmissionDetailModal',node=>node.textContent)).includes('이준호'));
    await go();
    await Promise.all([page.waitForNavigation({waitUntil:'networkidle2'}),page.click('.dashboard-metric[href*="dashboard=today"]')]);
    await page.waitForSelector('.dashboard-history-filter a');
    await Promise.all([page.waitForNavigation({waitUntil:'networkidle2'}),page.click('.dashboard-history-filter a')]);
    await page.waitForSelector('.applicant-history-view');
    assert.equal(await page.evaluate(()=>getGridRows('applicantHistoryGrid').length),8);
    manager={fields:[],submissions:[],schedules:[],recruitmentUnits:[]}; await go();
    assert.equal(await page.$eval('[data-dashboard-metric="all"]',node=>node.textContent),'0건');
    assert.equal(await page.$$eval('.dashboard-empty',nodes=>nodes.length),2);
    console.log('PASS: dashboard light/dark responsive layouts, zero bars, filters, metric navigation, details and empty states');
  } finally {
    page.off('request',handler); await page.setRequestInterception(false);
    await page.evaluate(()=>{localStorage.removeItem('applyhub.theme');localStorage.removeItem('applyhub.dashboardFilters');});
  }
}
if(require.main===module) verifyData();
module.exports={verifyDashboard};
