(function (scope) {
  const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const labels = { submitted: '제출완료', missing: '미제출', incomplete: '미비' };
  const api = (path = '', options) => scope.AdmitCardApiClient.apiRequest(`/api/applicant-document-status${path}`, options);
  const filterLabels = { track: '모집시기', admission: '전형', series: '계열', unit: '모집단위', major: '전공' };
  const emptyFilters = () => ({ track: '', admission: '', series: '', unit: '', major: '', examineeNo: '', examineeName: '' });
  let owner, redraw, data = null, selected = null, filters = emptyFilters(), page = 1, busy = false, error = '', notice = '', revision = 0, searchTimer;
  const filterId = key => 'documentFilter-' + key;
  let statusPopover = null;
  function closeStatusPopover({ restoreFocus = false } = {}) {
    if (!statusPopover) return;
    const { element, trigger } = statusPopover;
    statusPopover = null;
    trigger.setAttribute('aria-expanded', 'false');
    element.remove();
    if (restoreFocus && trigger.isConnected) trigger.focus({ preventScroll: true });
  }
  const update = () => {
    if (!document.getElementById('documentManagementView')) return;
    closeStatusPopover();
    const table = document.querySelector('.document-management-grid .table-wrap');
    const scroll = table ? { left: table.scrollLeft, top: table.scrollTop } : null;
    const active = document.activeElement;
    const focus = active?.matches('[data-document-filter]') ? { id: active.id, start: active.selectionStart, end: active.selectionEnd } : null;
    redraw?.();
    const nextTable = document.querySelector('.document-management-grid .table-wrap');
    if (nextTable && scroll) { nextTable.scrollLeft = scroll.left; nextTable.scrollTop = scroll.top; }
    if (focus) { const input = document.getElementById(focus.id); input?.focus(); if (typeof focus.start === 'number') input?.setSelectionRange(focus.start, focus.end); }
  };
  const select = result => { selected = result; };

  async function saveStatus(submissionId, fieldId, status) {
    closeStatusPopover();
    await run(async () => {
      const result = await api(`/${submissionId}`, { method: 'PUT', body: JSON.stringify({ documents: [{ fieldId, status }] }) });
      return () => {
        const row = data?.rows.find(row => row.id === result.id);
        if (row) row.documents = result.documents;
        if (selected?.id === result.id) selected = result;
        notice = '서류 제출 상태를 저장했습니다.';
      };
    });
    document.querySelector(`[data-document-status-row="${submissionId}"][data-document-status-id="${fieldId}"]`)?.focus({ preventScroll: true });
  }

  function openStatusPopover(trigger) {
    if (statusPopover?.trigger === trigger) { closeStatusPopover({ restoreFocus: true }); return; }
    closeStatusPopover();
    const submissionId = Number(trigger.dataset.documentStatusRow);
    const fieldId = Number(trigger.dataset.documentStatusId);
    const row = data?.rows.find(row => row.id === submissionId);
    const item = row?.documents.find(item => item.fieldId === fieldId);
    if (!item) return;
    const element = document.createElement('div');
    element.id = 'documentStatusPopover';
    element.className = 'document-status-popover';
    element.setAttribute('popover', 'auto');
    element.setAttribute('role', 'menu');
    element.setAttribute('aria-label', `${row.name} ${item.questionText} 제출 상태`);
    element.innerHTML = `<p class="document-status-popover-title">${esc(item.questionText)}</p>${Object.entries(labels).map(([value, label]) => `<button class="document-status-option" type="button" role="menuitemradio" aria-checked="${item.status === value}" data-document-status-option="${value}"><span class="document-status-cell is-${value}">${label}</span><span aria-hidden="true">${item.status === value ? '✓' : ''}</span></button>`).join('')}`;
    statusPopover = { element, trigger };
    document.getElementById('documentManagementView').append(element);
    trigger.setAttribute('aria-expanded', 'true');
    element.addEventListener('toggle', event => {
      if (event.newState === 'closed' && statusPopover?.element === element) closeStatusPopover();
    });
    element.addEventListener('click', event => {
      const option = event.target.closest('[data-document-status-option]');
      if (!option || busy) return;
      if (option.dataset.documentStatusOption === item.status) closeStatusPopover({ restoreFocus: true });
      else void saveStatus(submissionId, fieldId, option.dataset.documentStatusOption);
    });
    element.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); closeStatusPopover({ restoreFocus: true }); return;
      }
      const options = [...element.querySelectorAll('button')];
      const index = options.indexOf(document.activeElement);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options[next].focus();
      }
    });
    element.showPopover();
    const anchor = trigger.getBoundingClientRect();
    const panel = element.getBoundingClientRect();
    element.style.left = `${Math.max(8, Math.min(anchor.left, innerWidth - panel.width - 8))}px`;
    element.style.top = `${Math.max(8, Math.min(anchor.bottom + panel.height + 8 <= innerHeight ? anchor.bottom + 6 : anchor.top - panel.height - 6, innerHeight - panel.height - 8))}px`;
    statusPopover.anchor = { left: anchor.left, top: anchor.top, viewportWidth: innerWidth, viewportHeight: innerHeight };
    element.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true });
  }
  async function run(work) {
    const ticket = ++revision;
    busy = true; error = ''; notice = ''; update();
    try { const result = await work(); if (ticket === revision) result?.(); }
    catch (e) { if (ticket === revision) error = e.message || '요청을 처리하지 못했습니다.'; }
    finally { if (ticket === revision) { busy = false; update(); } }
  }
  async function load() {
    return run(async () => {
      const result = await api(`?${new URLSearchParams({ ...filters, page })}`);
      return () => { data = result; page = result.page; selected = null; };
    });
  }
  function detail() {
    if (!selected) return '';
    return `<dialog class="modal-sheet document-management-dialog" id="documentManagementDetail" aria-modal="true" aria-labelledby="documentManagementDetailTitle">
      <div class="modal-header"><div><h3 id="documentManagementDetailTitle">${esc(selected.name)} · 제출 서류</h3><p class="muted">${esc(selected.examineeNo || '수험번호 미부여')} · ${esc(selected.email)}</p></div><button class="icon-button" type="button" data-document-close aria-label="닫기" autofocus>×</button></div>
      <div class="document-management-dialog-body">
      <div class="document-management-items">${selected.documents.map(item => `<div class="document-management-item">
        <div><strong>${esc(item.questionText)}</strong><span class="muted">${item.required ? '필수' : '선택'}</span>
          <p>${item.hasFile ? `<a href="/api/applicant-submissions/${selected.id}/files/${encodeURIComponent(item.fieldKey)}" download>${esc(item.fileName || '첨부파일 다운로드')}</a>` : '<span class="muted">첨부된 파일이 없습니다.</span>'}</p></div>
      </div>`).join('') || '<p class="muted">서류제출에 설정된 서류 항목이 없습니다.</p>'}</div>
      <p class="muted">제출 상태는 그리드의 상태 배지를 눌러 변경할 수 있습니다.</p>
      </div>
      <div class="document-management-dialog-footer"><button class="ghost-button" type="button" data-document-close>닫기</button></div>
    </dialog>`;
  }
  function showDetailDialog() {
    const dialog = document.getElementById('documentManagementDetail');
    if (!dialog || dialog.open || !selected) return;
    const submissionId = selected.id;
    dialog.addEventListener('close', () => {
      if (!dialog.isConnected) return;
      selected = null;
      update();
      document.querySelector(`[data-document-detail="${submissionId}"]`)?.focus({ preventScroll: true });
    }, { once: true });
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') event.stopPropagation();
    });
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    dialog.showModal();
  }
  function render(rerender, userId) {
    redraw = rerender;
    closeStatusPopover();
    if (owner !== userId) { owner = userId; data = selected = null; filters = emptyFilters(); clearTimeout(searchTimer); page = 1; busy = false; error = notice = ''; revision++; }
    if (!document.getElementById('documentManagementView') && !busy) { busy = true; queueMicrotask(load); }
    if (selected) queueMicrotask(showDetailDialog);
    const pages = Math.max(1, Math.ceil((data?.total || 0) / (data?.pageSize || 20)));
    const documents = data?.documents || [];
    const rows = data?.rows || [];
    const baseColumns = [['examineeNo', '수험번호'], ['name', '이름'], ...Object.entries(filterLabels), ['email', '이메일']];
    const columnWidths = [50, 120, 100, 110, 120, 100, 140, 140, 230, ...documents.map(() => 100), 90];
    const options = key => ['', ...new Set([...(data?.filterOptions?.[key] || []), filters[key]].filter(Boolean))].map(value => `<option value="${esc(value)}" ${filters[key] === value ? 'selected' : ''}>${esc(value || '전체')}</option>`).join('');
    return `<section class="view-stack lookup-view-stack document-management-view" id="documentManagementView">
      <article class="form-card lookup-filter-card">
        <div class="section-header"><div class="menu-section-copy"><h3>서류 제출 관리</h3><p>상태 배지를 눌러 서류별 제출 상태를 바로 변경할 수 있습니다.</p></div></div>
        <form data-document-search>
          <div class="search-grid five">${Object.entries(filterLabels).map(([key, label]) => `<div class="field"><label for="${filterId(key)}">${label}</label><select id="${filterId(key)}" name="${key}" data-document-filter="${key}">${options(key)}</select></div>`).join('')}</div>
          <div class="search-grid four lookup-search-grid-actions">
            <div class="field"><label for="${filterId('examineeNo')}">수험번호</label><input id="${filterId('examineeNo')}" data-document-filter="examineeNo" name="examineeNo" maxlength="100" value="${esc(filters.examineeNo)}" placeholder="수험번호 전체 또는 일부를 입력하세요"></div>
            <div class="field"><label for="${filterId('examineeName')}">이름</label><input id="${filterId('examineeName')}" data-document-filter="examineeName" name="examineeName" maxlength="100" value="${esc(filters.examineeName)}" placeholder="이름 전체 또는 일부를 입력하세요"></div>
            <div class="lookup-filter-actions" aria-label="서류 제출 관리 검색"><button class="primary-button" type="submit" ${busy ? 'disabled' : ''}>조회</button><button class="outline-button" type="button" data-document-reset>초기화</button><button class="ghost-button" type="button" data-document-refresh ${busy ? 'disabled' : ''}>새로고침</button></div>
          </div>
        </form>
      </article>
      <div class="table-view-mount"><article class="table-card result-grid-card document-management-grid">
        <div class="document-management-grid-status" role="status">${busy ? '불러오는 중…' : `총 ${data?.total || 0}명`}${error ? `<span class="member-list-error" role="alert">${esc(error)}</span>` : ''}${notice ? `<span>${esc(notice)}</span>` : ''}</div>
        <div class="table-wrap"><table aria-label="서류 제출 현황" style="min-width:${columnWidths.reduce((sum, width) => sum + width, 0)}px"><colgroup>${columnWidths.map(width => `<col style="width:${width}px">`).join('')}</colgroup><thead><tr><th scope="col">번호</th>${baseColumns.map(([, label]) => `<th scope="col">${label}</th>`).join('')}${documents.map(item => `<th scope="col" data-document-column="${item.index}">${esc(item.label)}</th>`).join('')}<th scope="col">관리</th></tr></thead>
        <tbody class="table-body">${rows.map((row, index) => `<tr class="${selected?.id === row.id ? 'is-selected' : ''}"><td>${(page - 1) * (data.pageSize || 20) + index + 1}</td>${baseColumns.map(([key]) => `<td title="${esc(row[key] || '')}">${esc(row[key] || (key === 'examineeNo' ? '미부여' : '-'))}</td>`).join('')}${documents.map(column => { const item = row.documents[column.index]; if (!item) return '<td class="muted" title="해당 전형의 제출 서류가 아닙니다.">—</td>'; return `<td><button class="document-status-cell is-${esc(item?.status || 'missing')}" type="button" data-document-status-row="${row.id}" data-document-status-id="${item.fieldId}" aria-haspopup="menu" aria-expanded="false" aria-controls="documentStatusPopover" title="${esc(item.questionText)}" aria-label="${esc(row.name + ' ' + item.questionText + ' 제출 상태 변경')}" ${busy ? 'disabled' : ''}>${esc(item?.statusLabel || labels.missing)}</button></td>`; }).join('')}<td><button class="ghost-button" type="button" data-document-detail="${row.id}" aria-label="${esc(row.name)} 서류 관리" ${busy ? 'disabled' : ''}>관리</button></td></tr>`).join('') || `<tr class="table-empty-row"><td class="table-empty-cell" colspan="${baseColumns.length + documents.length + 2}">${busy ? '불러오는 중…' : '조회된 접수자가 없습니다.'}</td></tr>`}</tbody></table></div>
        <div class="member-list-pagination"><button class="ghost-button" type="button" data-document-page="${page - 1}" ${busy || page <= 1 ? 'disabled' : ''}>이전</button><span>${page} / ${pages}</span><button class="ghost-button" type="button" data-document-page="${page + 1}" ${busy || page >= pages ? 'disabled' : ''}>다음</button></div>
      </article></div>${detail()}</section>`;
  }
  document.addEventListener('change', event => {
    const filter = event.target.closest('select[data-document-filter]');
    if (filter?.closest('#documentManagementView')) {
      filters[filter.dataset.documentFilter] = filter.value;
      const keys = Object.keys(filterLabels);
      keys.slice(keys.indexOf(filter.dataset.documentFilter) + 1).forEach(key => { filters[key] = ''; });
      page = 1; clearTimeout(searchTimer); void load(); return;
    }
  });
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!form.matches('[data-document-search]')) return;
    event.preventDefault();
    if (form.hasAttribute('data-document-search')) { clearTimeout(searchTimer); Object.assign(filters, Object.fromEntries(new FormData(form))); page = 1; void load(); }
  });
  document.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button?.closest('#documentManagementView')) return;
    if (button.hasAttribute('data-document-reset')) { filters = emptyFilters(); page = 1; clearTimeout(searchTimer); await load(); return; }
    if (busy) return;
    if (button.hasAttribute('data-document-status-row')) { openStatusPopover(button); return; }
    if (button.hasAttribute('data-document-refresh')) { await load(); return; }
    if (button.hasAttribute('data-document-page')) { page = Number(button.dataset.documentPage); await load(); return; }
    if (button.hasAttribute('data-document-close')) { document.getElementById('documentManagementDetail')?.close(); return; }
    if (button.hasAttribute('data-document-detail')) {
      await run(async () => { const result = await api(`/${button.dataset.documentDetail}`); return () => select(result); });
    }
  });
  function closeMovedStatusPopover() {
    if (!statusPopover?.anchor) return;
    const rect = statusPopover.trigger.getBoundingClientRect();
    if (!statusPopover.trigger.isConnected || rect.left !== statusPopover.anchor.left || rect.top !== statusPopover.anchor.top
      || innerWidth !== statusPopover.anchor.viewportWidth || innerHeight !== statusPopover.anchor.viewportHeight) closeStatusPopover();
  }
  window.addEventListener('resize', closeMovedStatusPopover);
  document.addEventListener('scroll', event => {
    if (statusPopover && !statusPopover.element.contains(event.target)) closeMovedStatusPopover();
  }, true);
  document.addEventListener('input', event => {
    const input = event.target.closest('input[data-document-filter]');
    if (!input?.closest('#documentManagementView')) return;
    filters[input.dataset.documentFilter] = input.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { if (document.getElementById('documentManagementView')) { page = 1; void load(); } }, 300);
  });
  scope.AdmitCardDocumentManagement = { render };
})(globalThis);
