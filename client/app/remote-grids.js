(function(scope) {
  let state, apiRequest, renderView, generation = 0;
  const entries = new Map(), facets = new Map();
  const supported = key => ['applicantHistoryGrid','admitCardLookupGrid','printHistoryGrid'].includes(key);
  const redraw = () => queueMicrotask(() => renderView?.());
  function configure(options) {
    ({state,apiRequest,renderView}=options);
    invalidate();
  }
  function invalidate() {
    generation++;
    for (const entry of entries.values()) entry.controller?.abort();
    entries.clear();facets.clear();
  }
  function requestFor(key) {
    const table=state.tableSettings[key];
    if (Number(table.pageSize) < 1 || Number(table.pageSize) > 200) table.pageSize=200;
    const history=key==='applicantHistoryGrid' ? scope.AdmitCardDashboardData.readHistoryFilter(scope.location?.search||'') : null;
    return {...state.headerFilters,...(key==='admitCardLookupGrid'?state.lookupFilters:{}),...(history||{}),
      date:history?.mode==='today'?history.date:undefined,missingDocuments:history?.mode==='documents',
      kind:key==='printHistoryGrid'?'print':key==='admitCardLookupGrid'?'ticket':'history',page:table.page,pageSize:table.pageSize,columns:table.filters,sort:table.sortRules};
  }
  function fetchEntry(key,body,onResult) {
    if (!apiRequest || state.bootstrap.isLoading) return entries.get(key);
    const signature=JSON.stringify(body), previous=entries.get(key);
    if(previous?.signature===signature)return previous;
    previous?.controller?.abort();
    const entry={signature,controller:new AbortController(),data:previous?.data,pending:true};entries.set(key,entry);
    apiRequest('/api/applicant-submissions/list',{method:'POST',body:signature,signal:entry.controller.signal}).then(data=>{
      if(entries.get(key)!==entry)return;
      entry.data=data;entry.pending=false;onResult?.(data);redraw();
    }).catch(error=>{
      if(entries.get(key)!==entry || error.name==='AbortError')return;
      entry.pending=false;state.bootstrap.error=error.message;redraw();
    });
    return entry;
  }
  function rows(key) {
    if(!supported(key)||!state)return null;
    const result=fetchEntry(key,requestFor(key),data=>{
      state.tableSettings[key].page=data.page;
      if(key==='applicantHistoryGrid')state.applicantManager.submissions=data.rows;
    });
    const schedules=state.applicantManager?.schedules||[];
    return (result?.data?.rows||[]).map(row=>{
      const schedule=scope.AdmitCardApplicantFormConfig.findApplicantScheduleRecord(schedules,row);
      return {...row,submissionId:row.id,statusLabel:scope.AdmitCardApplicantFormConfig.getApplicantStatusLabel(row.status,schedule||{})};
    });
  }
  function meta(key) {return supported(key)&&state ? entries.get(key)?.data||{total:0,page:1,pageSize:20}:null;}
  function references(key) {return entries.get(key)?.data?.references||[];}
  function filterOptions(key,column) {
    if(!supported(key)||!state)return null;
    const body={...requestFor(key),optionsKey:column};delete body.page;delete body.pageSize;
    const id=JSON.stringify(body);
    if(!facets.has(id)) {
      const currentGeneration=generation;
      facets.set(id,[]);
      apiRequest('/api/applicant-submissions/list',{method:'POST',body:id}).then(data=>{if(generation!==currentGeneration)return;facets.set(id,data.values);redraw();}).catch(error=>{state.bootstrap.error=error.message;});
    }
    return facets.get(id);
  }
  function headerOptions(key) {
    if(!state)return null;
    if (!['dashboard','applicantHistory','admitCardLookup','printHistory'].includes(state.currentView)) return null;
    const grid=state.currentView==='printHistory'?'printHistoryGrid':state.currentView==='applicantHistory'?'applicantHistoryGrid':'admitCardLookupGrid';
    const data=entries.get(state.currentView==='dashboard'?'dashboard':grid)?.data;
    return [...new Set([...(data?.filterOptions?.[key]||[]),state.headerFilters?.[key],state.lookupFilters?.[key]].filter(Boolean))];
  }
  function dashboard() {
    if(!state)return null;
    return fetchEntry('dashboard',{...state.headerFilters,kind:'dashboard'})?.data||null;
  }
  scope.AdmitCardRemoteGrids={configure,invalidate,rows,meta,references,filterOptions,headerOptions,dashboard,supported,requestFor};
})(globalThis);
