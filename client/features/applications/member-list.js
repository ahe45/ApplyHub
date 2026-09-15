(function (scope) {
  const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const api = path => scope.AdmitCardApiClient.apiRequest(`/api/applicant-members${path}`);
  let data = null, selected = null, owner = '', redraw = null, search = '', status = '', page = 1, busy = false, error = '', revision = 0;
  let initialMemberId = '';
  const date = value => value ? new Date(value).toLocaleString('ko-KR', { hour12: false }) : '-';
  const birth = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1년 $2월 $3일') : '-';
  function update() { if (document.getElementById('memberListView')) redraw?.(); }
  async function load() {
    const ticket = ++revision;
    busy = true; error = ''; selected = null; update();
    try {
      const result = await api(`?${new URLSearchParams({ search, status, page })}`);
      if (ticket !== revision) return;
      data = result; page = result.page;
      if (initialMemberId) {
        const id = initialMemberId; initialMemberId = '';
        const member = await api(`/${id}`);
        if (ticket === revision) selected = member;
      }
    } catch (e) { if (ticket === revision) { error = e.message; data = null; } }
    finally { if (ticket === revision) { busy = false; update(); } }
  }
  function detail() {
    if (!selected) return '';
    const field = (title, text) => `<div class="member-detail-field"><dt>${esc(title)}</dt><dd>${esc(text || '-')}</dd></div>`;
    const answerValue = answer => answer.inputType === 'birthdate' ? birth(answer.value) : answer.inputType === 'nationality' ? scope.AdmitCardApplicantFormConfig?.findApplicantNationalityOption(answer.value)?.label || answer.value : answer.value;
    return `<article class="form-card member-detail" id="memberDetailPanel" tabindex="-1">
      <div class="section-header"><div><h3>회원정보</h3><p>가입 시 입력한 정보와 약관 동의 내역입니다.</p></div><button type="button" class="ghost-button" data-member-list-close>닫기</button></div>
      <dl class="member-detail-grid">${field('이름', selected.name)}${field('이메일', selected.email)}${field('이메일 인증', selected.emailVerified ? '인증 완료' : '미인증')}${field('가입일', date(selected.createdAt))}
      ${selected.answers.map(answer => answer.isFile ? `<div class="member-detail-field"><dt>${esc(answer.label)}</dt><dd><a href="/api/applicant-members/${selected.id}/files/${encodeURIComponent(answer.key)}" download>${esc(answer.fileName)}</a></dd></div>` : field(answer.label, answerValue(answer))).join('')}</dl>
      <div class="inline-actions">${selected.submissionId ? `<button class="ghost-button" type="button" data-applicant-submission-toggle="${selected.submissionId}">접수 상세 보기</button><span>수험번호: ${esc(selected.examineeNo || '미부여')}</span>` : '<p class="muted">아직 원서를 접수하지 않은 회원입니다.</p>'}</div>
      <h4>약관 동의 내역</h4>${selected.terms.length ? selected.terms.map(term => `<details class="member-term"><summary>${esc(term.title)} · ${term.required ? '필수' : '선택'} · ${term.agreed ? '동의' : '미동의'}</summary><p>${esc(term.text)}</p></details>`).join('') : '<p class="muted">저장된 약관 동의 내역이 없습니다.</p>'}
    </article>`;
  }
  function render(rerender, userId) {
    redraw = rerender;
    if (owner !== userId) {
      owner = userId; data = null; selected = null; search = ''; status = ''; page = 1; busy = false; error = ''; revision++;
      const requested = new URLSearchParams(location.search).get('member') || '';
      initialMemberId = /^\d+$/.test(requested) ? requested : '';
    }
    if (!document.getElementById('memberListView') && !busy) { busy = true; queueMicrotask(load); }
    const pages = Math.max(1, Math.ceil((data?.total || 0) / 20));
    return `<section class="view-stack" id="memberListView"><article class="form-card">
      <div class="section-header"><div><h3>회원 목록</h3><p>접수 여부와 관계없이 가입한 회원을 조회합니다.</p></div><button type="button" class="ghost-button" data-member-list-refresh ${busy ? 'disabled' : ''}>새로고침</button></div>
      <form class="member-list-filters" data-member-list-search><label class="field"><span>이름·이메일</span><input name="search" type="search" maxlength="100" placeholder="이름 또는 이메일 검색" value="${esc(search)}" /></label><label class="field"><span>접수 여부</span><select name="status"><option value="">전체</option><option value="submitted" ${status === 'submitted' ? 'selected' : ''}>접수 완료</option><option value="unsubmitted" ${status === 'unsubmitted' ? 'selected' : ''}>미접수</option></select></label><button class="primary-button" type="submit" ${busy ? 'disabled' : ''}>조회</button></form>
      <p class="muted" role="status">${busy ? '불러오는 중…' : `총 ${data?.total || 0}명`}</p>${error ? `<p class="member-list-error" role="alert">${esc(error)}</p>` : ''}
      <div class="member-list-table-wrap"><table class="member-list-table"><thead><tr>${['이름', '이메일', '생년월일', '연락처', '가입일', '접수 여부', '상세'].map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>
      ${(data?.rows || []).map(row => `<tr><td>${esc(row.name)}</td><td>${esc(row.email)}</td><td>${esc(birth(row.birth))}</td><td>${esc(row.phone || '-')}</td><td>${esc(date(row.createdAt))}</td><td><span class="member-list-status ${row.submissionId ? 'is-submitted' : ''}">${row.submissionId ? '접수 완료' : '미접수'}</span></td><td><button class="ghost-button" type="button" data-member-list-detail="${row.id}" ${busy ? 'disabled' : ''} aria-label="${esc(row.name)} 회원정보 보기">회원정보</button></td></tr>`).join('') || `<tr><td colspan="7">${busy ? '회원 목록을 불러오고 있습니다.' : error ? '조회하지 못했습니다. 새로고침해 주세요.' : '조회된 회원이 없습니다.'}</td></tr>`}
      </tbody></table></div><div class="member-list-pagination"><button class="ghost-button" type="button" data-member-list-page="${page - 1}" ${busy || page <= 1 ? 'disabled' : ''}>이전</button><span>${page} / ${pages}</span><button class="ghost-button" type="button" data-member-list-page="${page + 1}" ${busy || page >= pages ? 'disabled' : ''}>다음</button></div>
      </article>${detail()}</section>`;
  }
  document.addEventListener('submit', event => {
    if (!event.target.matches('[data-member-list-search]')) return;
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.target); search = String(form.get('search') || '').trim(); status = String(form.get('status') || ''); page = 1; void load();
  });
  document.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button?.closest('#memberListView') || busy) return;
    if (button.hasAttribute('data-member-list-refresh')) { await load(); return; }
    if (button.hasAttribute('data-member-list-page')) { page = Number(button.dataset.memberListPage); await load(); return; }
    if (button.hasAttribute('data-member-list-close')) { selected = null; update(); return; }
    if (button.hasAttribute('data-member-list-detail')) {
      const ticket = ++revision; busy = true; error = ''; update();
      try { const result = await api(`/${button.dataset.memberListDetail}`); if (ticket === revision) selected = result; }
      catch (e) { if (ticket === revision) error = e.message; }
      finally { if (ticket === revision) { busy = false; update(); document.getElementById('memberDetailPanel')?.focus(); } }
    }
  });
  scope.AdmitCardMemberList = { render };
})(globalThis);
