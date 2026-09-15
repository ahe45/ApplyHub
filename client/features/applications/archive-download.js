(function (scope) {
  scope.createApplicantArchiveDownloadController = function ({ buildApiUrl, getGridRows, requestCloseModal }) {
    const naming = scope.AdmitCardApplicantArchive;
    let dialog, trigger, activeJob, timer, patternEditor, progressDialog, elapsedTimer, startedAt, busy = false;
    let progressJob = null, downloadedJob = null;
    let kind = 'documents', targetIds = [];
    const doc = scope.document;
    const field = name => dialog.querySelector(`[name="${name}"]`);
    const status = text => { dialog.querySelector('[data-archive-status]').textContent = text; };
    function renderProgress() {
      const total = Number(progressJob?.total || 0), completed = Number(progressJob?.completed || 0);
      const percent = total ? Math.min(99, Math.floor(completed / total * 100)) : 0;
      progressDialog.querySelector('[data-archive-progress-title]').textContent = total && completed >= total ? 'ZIP 파일 마무리 중' : '다운로드 파일 준비 중';
      progressDialog.querySelector('[data-archive-progress-percent]').textContent = total ? `${percent}%` : '준비 중';
      const bar = progressDialog.querySelector('[role=progressbar]');
      bar.classList.toggle('is-indeterminate', !total);
      if (total) bar.setAttribute('aria-valuenow', percent); else bar.removeAttribute('aria-valuenow');
      bar.firstElementChild.style.width = total ? `${percent}%` : '';
      progressDialog.querySelector('[data-archive-progress-count]').textContent = total ? `${completed.toLocaleString()}명 / ${total.toLocaleString()}명 · ${Number(progressJob.files || 0).toLocaleString()}개 파일` : '파일 목록을 확인하고 있습니다.';
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      progressDialog.querySelector('[data-archive-progress-time]').textContent = `경과 ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }
    function openProgress(reset = false) {
      if (!progressDialog) {
        progressDialog = doc.createElement('dialog');
        progressDialog.className = 'archive-progress-overlay';
        progressDialog.setAttribute('aria-labelledby', 'archive-progress-title');
        progressDialog.setAttribute('aria-describedby', 'archive-progress-count');
        progressDialog.innerHTML = `<div class="archive-progress-spinner" aria-hidden="true"></div>
          <div class="archive-progress-header"><strong id="archive-progress-title" data-archive-progress-title></strong><span data-archive-progress-percent></span></div>
          <div class="archive-progress-track" role="progressbar" aria-label="다운로드 파일 준비 진행률" aria-valuemin="0" aria-valuemax="100"><span></span></div>
          <div class="archive-progress-summary"><span id="archive-progress-count" data-archive-progress-count role="status" aria-live="polite"></span><span data-archive-progress-time></span></div>`;
        progressDialog.addEventListener('cancel', event => event.preventDefault());
        doc.body.appendChild(progressDialog);
      }
      if (reset) { startedAt = Date.now(); progressJob = null; }
      renderProgress();
      if (!progressDialog.open) progressDialog.showModal();
      scope.clearInterval(elapsedTimer);
      elapsedTimer = scope.setInterval(renderProgress, 1000);
    }
    function closeProgress() {
      scope.clearInterval(elapsedTimer);
      if (progressDialog?.open) progressDialog.close();
    }
    function options() {
      return { ...naming.defaults, scope: 'filtered', submissionIds: targetIds,
        groupByApplicant: kind === 'documents' && field('groupByApplicant').checked,
        documents: kind === 'documents', photos: kind === 'photos',
        folderPattern: field('folderPattern')?.value ?? naming.defaults.folderPattern,
        documentPattern: field('documentPattern')?.value ?? naming.defaults.documentPattern,
        photoPattern: field('photoPattern')?.value ?? naming.defaults.photoPattern };
    }
    function pattern(name, label, value, folder = false) {
      return scope.AdmitCardArchivePatternEditor.renderPattern(name, label, value, folder);
    }
    function toggle(name, label) {
      return `<label class="archive-switch-row"><span>${label}</span><span class="archive-switch"><input name="${name}" type="checkbox" role="switch" ${naming.defaults[name] ? 'checked' : ''}><span class="archive-switch-track" aria-hidden="true"></span></span></label>`;
    }
    function update() {
      const value = options();
      for (const [enabled, name] of [[value.groupByApplicant, 'folderPattern'], [value.documents, 'documentPattern'], [value.photos, 'photoPattern']]) {
        if (!field(name)) continue;
        dialog.querySelector(`[data-pattern="${name}"]`).hidden = !enabled;
        field(name).disabled = !enabled || busy;
        field(name).required = enabled;
      }
      patternEditor?.update();
    }
    function changed() {
      if (!busy) {
        dialog.querySelector('[data-archive-download]').hidden = true;
        dialog.querySelector('[data-archive-retry]').hidden = true;
        status('설정한 내용으로 ZIP 파일을 준비해 주세요.');
      }
      update();
    }
    function lock(value) {
      busy = value;
      dialog.querySelector('fieldset').disabled = value;
      dialog.querySelector('[data-archive-start]').disabled = value;
      dialog.querySelector('[data-archive-start]').textContent = value ? '파일 준비 중…' : '다운로드';
      update();
    }
    async function request(url, init) {
      const response = await scope.fetch(buildApiUrl(url), { credentials: 'same-origin', ...init });
      const body = await response.json();
      if (!response.ok) {
        const error = new Error(body.error || '다운로드 요청에 실패했습니다.');
        error.status = response.status; throw error;
      }
      return body;
    }
    function showJob(job) {
      if (job.status === 'ready') {
        closeProgress();
        lock(false);
        const download = dialog.querySelector('[data-archive-download]');
        download.href = buildApiUrl(`/api/applicant-submissions/archive-jobs/${job.id}/download`);
        download.hidden = false;
        status(`${job.completed}명 처리 완료 · ${job.files}개 파일${job.missing ? ` · 미등록 또는 누락 ${job.missing}건 제외` : ''}. 다운로드를 시작했습니다.`);
        if (downloadedJob !== job.id) { downloadedJob = job.id; download.click(); }
      } else if (job.status === 'failed') { closeProgress(); lock(false); status(job.message); }
      else {
        progressJob = job;
        renderProgress();
        status(`${job.completed} / ${job.total}명 처리 중 · ${job.files}개 파일 준비`);
        timer = scope.setTimeout(poll, 1200);
      }
    }
    async function poll() {
      if (!activeJob) return;
      try { showJob(await request(`/api/applicant-submissions/archive-jobs/${activeJob}`)); }
      catch (error) {
        closeProgress();
        if ([401, 403, 404].includes(error.status)) {
          activeJob = null; lock(false); status(error.message); return;
        }
        status(error.message + ' 상태 확인 버튼으로 다시 확인할 수 있습니다.');
        dialog.querySelector('[data-archive-retry]').hidden = false;
      }
    }
    async function start(event) {
      event.preventDefault();
      if (busy) return;
      let value;
      try {
        value = naming.normalizeOptions(options());
        if (!value.submissionIds.length) throw new Error('다운로드할 접수 이력이 없습니다.');
      } catch (error) { status(error.message); return; }
      scope.clearTimeout(timer);
      dialog.querySelector('[data-archive-download]').hidden = true;
      dialog.querySelector('[data-archive-retry]').hidden = true;
      lock(true); status('파일 목록을 확인하고 있습니다.'); openProgress(true);
      try {
        const job = await request('/api/applicant-submissions/archive-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
        activeJob = job.id;
        showJob(job);
      } catch (error) { closeProgress(); lock(false); status(error.message); }
    }
    async function open(button) {
      const nextKind = button.dataset.applicantArchiveKind;
      if (!['photos', 'documents'].includes(nextKind)) return;
      await requestCloseModal('applicantSubmissionDownloadModal');
      trigger = doc.querySelector('[data-open-modal="applicantSubmissionDownloadModal"]');
      if (!busy) {
        kind = nextKind;
        targetIds = getGridRows('applicantHistoryGrid').map(row => Number(row.id));
        scope.clearTimeout(timer);
        activeJob = null; downloadedJob = null;
        dialog?.remove();
        dialog = doc.createElement('dialog');
        dialog.className = 'applicant-archive-dialog';
        dialog.setAttribute('aria-labelledby', 'archive-title');
        const defaults = naming.defaults;
        dialog.innerHTML = `<form class="archive-form">
          <header><h2 id="archive-title">${kind === 'photos' ? '수험생 사진 다운로드' : '제출 서류 다운로드'}</h2><button type="button" class="icon-button" data-archive-close aria-label="닫기">×</button></header>
          <fieldset>
            ${kind === 'documents' ? `
            <section>${toggle('groupByApplicant', '수험생별 폴더로 구분')}
              ${pattern('folderPattern', '폴더명 규칙', defaults.folderPattern, true)}</section>
            <section>${pattern('documentPattern', '파일명 규칙', defaults.documentPattern)}</section>`
              : `<section>${pattern('photoPattern', '파일명 규칙', defaults.photoPattern)}</section>`}
          </fieldset>
          <p role="status" aria-live="polite" data-archive-status></p>
          <footer><button type="button" class="outline-button" data-archive-retry hidden>상태 확인</button><button type="submit" class="primary-button" data-archive-start>다운로드</button><a class="outline-button" data-archive-download download hidden>다시 다운로드</a></footer>
        </form>`;
        doc.body.appendChild(dialog);
        patternEditor = scope.AdmitCardArchivePatternEditor.create({ root: dialog, onChange: changed, isBusy: () => busy });
        dialog.addEventListener('submit', start);
        dialog.addEventListener('input', event => {
          if (!event.target.closest('[data-archive-editor]')) changed();
        });
        dialog.addEventListener('change', event => { if (event.target.name) changed(); });
        dialog.addEventListener('close', () => trigger?.focus());
        dialog.addEventListener('click', event => {
          if (event.target.closest('[data-archive-close]')) dialog.close();
          if (event.target.closest('[data-archive-retry]')) {
            dialog.querySelector('[data-archive-retry]').hidden = true;
            scope.clearTimeout(timer); openProgress(); poll();
          }
        });
      }
      update();
      if (!dialog.open) dialog.showModal();
    }
    doc.addEventListener('click', event => {
      const button = event.target.closest?.('[data-applicant-archive-kind]');
      if (button) open(button);
    });
  };
})(globalThis);
