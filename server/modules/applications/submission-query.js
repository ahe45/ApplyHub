// A compact relational projection: never fetch full answer/file payloads for a list.
// Kept as a query (rather than a stale cache) so old backup restores remain valid.
const keys = ['birth', 'track', 'admission', 'series', 'unit', 'major'];
const quote = name => '`' + name + '`';
const systemValue = key => `COALESCE((SELECT TRIM(a.answer_data) FROM app_subm a LEFT JOIN app_form f ON f.field_key = a.field_key
  WHERE a.id = m.id AND (f.system_field_key = '${key}' OR a.field_key = '__applicant_selection_${key}')
  AND COALESCE(f.input_type, 'text') NOT IN ('photo','file') AND TRIM(COALESCE(a.answer_data,'')) <> ''
  ORDER BY COALESCE(f.sort_order,2147483647), a.field_key LIMIT 1),'') AS ${quote(key)}`;
const baseSummarySql = `SELECT m.id, m.member_id AS memberId, COALESCE(m.examinee_no,'') AS examineeNo,
  h.name, h.email, h.status, h.hasPassword,
  DATE_FORMAT(h.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt,
  DATE_FORMAT(h.updated_at,'%Y-%m-%d %H:%i:%s') AS updatedAt,
  COALESCE(m.field_overrides_json,'') AS fieldOverridesJson,
  ${keys.map(systemValue).join(',')},
  EXISTS(SELECT 1 FROM app_subm p JOIN app_form f ON f.field_key=p.field_key WHERE p.id=m.id AND f.input_type='photo'
    AND JSON_VALID(p.answer_data) AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(p.answer_data),p.answer_data,'{}'),'$.hasPhoto')),'false') IN ('true','1')) AS hasPhoto
  FROM app_meta m JOIN (SELECT id, MIN(applicant_name) AS name, MIN(email) AS email, MIN(status) AS status,
    MAX(password_hash IS NOT NULL AND password_hash <> '') AS hasPassword, MIN(created_at) AS created_at, MAX(updated_at) AS updated_at
    FROM app_subm GROUP BY id) h ON h.id=m.id`;

const summarySql = `SELECT applicant.*, CASE WHEN applicant.status <> 'promoted' AND COALESCE((SELECT NOW() >= s.applicant_schedule_start_at AND NOW() < s.applicant_schedule_end_at + INTERVAL 1 MINUTE FROM app_schedule s WHERE s.track_name=applicant.track AND s.admission_name=applicant.admission ORDER BY s.id LIMIT 1),0) THEN '접수 중' ELSE '접수 완료' END AS statusLabel FROM (${baseSummarySql}) applicant`;
const source = filters => filters.kind === 'print'
  ? `SELECT COALESCE(a.id,0) AS id,p.id AS historyId,p.examinee_no AS examineeNo,DATE_FORMAT(p.printed_at,'%Y-%m-%d %H:%i:%s') AS printedAt,${['name','email','status','statusLabel','hasPassword','createdAt','updatedAt','fieldOverridesJson','hasPhoto',...keys].map(key=>'a.'+quote(key)).join(',')} FROM print_log p LEFT JOIN (${summarySql}) a ON a.examineeNo=p.examinee_no`
  : summarySql;

function createSubmissionQuery({ query, getByIds }) {
  const columns = new Set(['id','name','email','examineeNo','status','statusLabel','historyId','printedAt','createdAt','updatedAt','hasPhoto',...keys]);
  function conditions(filters = {}, { excluded = '', recruitmentOnly = false } = {}) {
    const clauses = [], params = [];
    for (const key of ['track','admission','series','unit','major']) {
      if (key !== excluded && filters[key]) { clauses.push(`${quote(key)} = ?`); params.push(String(filters[key]).slice(0,100)); }
    }
    if (!recruitmentOnly) {
      for (const [key,column] of [['examineeNo','examineeNo'],['examineeName','name']]) {
        if (filters[key]) { clauses.push(`LOCATE(?, ${quote(column)}) > 0`); params.push(String(filters[key]).slice(0,100)); }
      }
      if (filters.search) { clauses.push('(LOCATE(?,LOWER(name)) > 0 OR LOCATE(?,LOWER(email)) > 0 OR LOCATE(?,LOWER(examineeNo)) > 0)'); params.push(...Array(3).fill(String(filters.search).toLowerCase().slice(0,100))); }
      for (const [key, values] of Object.entries(filters.columns || {})) {
        if (!columns.has(key) || (['printedAt','historyId'].includes(key) && filters.kind !== 'print') || !Array.isArray(values)) continue;
        if (!values.length) { clauses.push('0=1'); continue; }
        clauses.push(`${quote(key)} IN (${values.map(()=>'?').join(',')})`);
        params.push(...values.map(v => key === 'hasPhoto' ? (v === '등록' ? 1 : 0) : String(v)));
      }
      if (filters.date) { clauses.push('createdAt >= ? AND createdAt < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(filters.date,filters.date); }
      if (filters.missingDocuments) clauses.push(`EXISTS(SELECT 1 FROM app_form required_field WHERE required_field.form_scope='documents' AND required_field.active=1 AND required_field.required=1
        AND COALESCE(required_field.template_id,(SELECT id FROM app_form_template WHERE form_scope='documents' AND is_default=1 LIMIT 1)) = COALESCE((SELECT document_template_id FROM app_schedule WHERE track_name=summary.track AND admission_name=summary.admission ORDER BY id LIMIT 1),(SELECT id FROM app_form_template WHERE form_scope='documents' AND is_default=1 LIMIT 1))
        AND NOT EXISTS(SELECT 1 FROM app_subm answer WHERE answer.id=summary.id AND answer.field_key=required_field.field_key AND TRIM(COALESCE(answer.answer_data,'')) <> ''
          AND (required_field.input_type <> 'file' OR (JSON_VALID(answer.answer_data) AND JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(answer.answer_data),answer.answer_data,'{}'),'$.hasFile')) IN ('true','1')))))`);
    }
    return { where: clauses.length ? ' WHERE '+clauses.join(' AND ') : '', params };
  }
  function normalize(row) {
    let fieldOverrides = {}; try { fieldOverrides = JSON.parse(row.fieldOverridesJson || '{}'); } catch {}
    const { fieldOverridesJson, ...rest } = row;
    return {...rest,id:Number(row.id),hasPhoto:!!Number(row.hasPhoto),hasPassword:!!Number(row.hasPassword),fieldOverrides};
  }
  async function list(filters = {}, { details = false, includeOptions = true } = {}) {
    const {where,params}=conditions(filters);
    const from=` FROM (${source(filters)}) summary`;
    const [[count], configured] = await Promise.all([
      query(`SELECT COUNT(*) AS total${from}${where}`,params),
      includeOptions ? Promise.all(['track','admission','series','unit','major'].map(async key=>{
        const c=conditions(filters,{excluded:key,recruitmentOnly:true});
        const rows=await query(`SELECT DISTINCT ${quote(key)} AS value${from}${c.where}`,c.params);
        return [key,rows.map(row=>row.value).filter(Boolean).sort((a,b)=>a.localeCompare(b,'ko',{numeric:true}))];
      })) : [],
    ]);
    const pageSize=Math.max(1,Math.min(200,Math.floor(Number(filters.pageSize)||20)));
    const total=Number(count.total),page=Math.min(Math.max(1,Math.floor(Number(filters.page)||1)),Math.max(1,Math.ceil(total/pageSize)));
    const sorts=(Array.isArray(filters.sort)?filters.sort:[]).filter(rule=>columns.has(rule.key) && (filters.kind === 'print' || !['printedAt','historyId'].includes(rule.key))).map(rule=>`${quote(rule.key)} ${rule.direction === 'asc'?'ASC':'DESC'}`);
    const rows=await query(`SELECT *${from}${where} ORDER BY ${sorts.length?sorts.join(',')+',':''}${filters.kind==='print'?'printedAt DESC,historyId DESC':'updatedAt DESC,id DESC'} LIMIT ? OFFSET ?`,[...params,pageSize,(page-1)*pageSize]);
    let resultRows=rows.map(normalize);
    if(details && rows.length) {
      const detailsById=new Map((await getByIds(rows.map(row=>row.id))).map(row=>[Number(row.id),row]));
      resultRows=rows.map(row=>detailsById.get(Number(row.id))).filter(Boolean);
    }
    return {rows:resultRows,total,page,pageSize,filterOptions:Object.fromEntries(configured)};
  }
  async function selections(filters = {}) {
    const c=conditions(filters);
    return query(`SELECT DISTINCT track,admission,series,unit,major FROM (${source(filters)}) summary${c.where}`,c.params);
  }
  async function ids(filters = {}) {
    const c=conditions(filters);
    return (await query(`SELECT id FROM (${source(filters)}) summary${c.where} ORDER BY updatedAt DESC,id DESC`,c.params)).map(row=>Number(row.id));
  }
  async function references(filters = {}) {
    if (filters.kind === 'print') return [];
    const c=conditions(filters);
    const sorts=(Array.isArray(filters.sort)?filters.sort:[]).filter(rule=>columns.has(rule.key) && !['printedAt','historyId'].includes(rule.key)).map(rule=>quote(rule.key)+(rule.direction==='asc'?' ASC':' DESC'));
    return query(`SELECT id,examineeNo FROM (${source(filters)}) summary${c.where} ORDER BY ${sorts.length?sorts.join(',')+',':''}updatedAt DESC,id DESC`,c.params);
  }
  async function options(filters, key) {
    if (!columns.has(key) || (filters.kind !== 'print' && ['printedAt','historyId'].includes(key))) return [];
    const c=conditions({...filters,columns:{...filters.columns,[key]:undefined}});
    const rows=await query(`SELECT DISTINCT ${quote(key)} AS value FROM (${source(filters)}) summary${c.where}`,c.params);
    return rows.map(row=>key==='hasPhoto'?(Number(row.value)?'등록':'미등록'):String(row.value??'')).sort((a,b)=>a.localeCompare(b,'ko',{numeric:true}));
  }
  async function dashboard(filters = {}) {
    const c=conditions(filters), missing=conditions({...filters,missingDocuments:true});
    const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
    const [totals,missingRows,days,recent,required]=await Promise.all([
      query(`SELECT COUNT(*) AS total,COALESCE(SUM(LEFT(createdAt,10)=?),0) AS todayCount FROM (${source(filters)}) summary${c.where}`,[today,...c.params]),
      query(`SELECT COUNT(*) AS total FROM (${source(filters)}) summary${missing.where}`,missing.params),
      query(`SELECT LEFT(createdAt,10) AS date,COUNT(*) AS count FROM (${source(filters)}) summary${c.where}${c.where?' AND':' WHERE'} createdAt >= DATE_SUB(?,INTERVAL 6 DAY) GROUP BY LEFT(createdAt,10)`,[...c.params,today]),
      list({...filters,pageSize:5,sort:[{key:'createdAt',direction:'desc'}]},{includeOptions:true}),
      query("SELECT COUNT(*) AS total FROM app_form WHERE form_scope='documents' AND active=1 AND required=1"),
    ]);
    return {today,total:Number(totals[0].total),todayCount:Number(totals[0].todayCount),missingCount:Number(missingRows[0].total),hasRequiredDocuments:!!Number(required[0].total),
      days:Array.from({length:7},(_,i)=>{const date=new Date(Date.parse(today+'T00:00:00Z')-(6-i)*86400000).toISOString().slice(0,10);return {date,count:Number(days.find(row=>row.date===date)?.count||0)};}),
      recent:recent.rows,filterOptions:recent.filterOptions};
  }
  return {list,selections,ids,references,options,dashboard,conditions,summarySql,normalize};
}
module.exports = { createSubmissionQuery, summarySql };
