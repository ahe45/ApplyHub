(function (scope) {
  let editor = null;
  let loadPromise = null;
  let controls = [];
  let mountVersion = 0;
  let lastOptions = null;
  let dependencies = null;
  let baseline = '';
  const baseUrl = '/client/examlist-editor/runtime/';

  function loadAssets() {
    if (!loadPromise) {
      loadPromise = (async () => {
        for (const href of ['/client/examlist-editor/styles/scoped.css', '/styles/features/examlist-editor.css']) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = href;
          document.head.append(link);
          await new Promise((resolve, reject) => { link.onload = resolve; link.onerror = reject; });
        }
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = baseUrl + 'loader.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.append(script);
        });
        await scope.ExamListTemplateEditorRuntimeLoader.load({ baseUrl, includePreset: false });
        const host = '/client/examlist-editor/host/client/features/template-editor/';
        const [text, objects, scroll, tagPanel, tagConfig, tagView, generated, dateRenderer, dateOptions, canvasZoom] = await Promise.all([
          import(host + 'editor-text-controls.js'),
          import(host + 'object-toolbar-controls.js'),
          import(host + 'object-interaction-scroll.js'),
          import(host + 'data-tags-panel.js'),
          import(host + 'data-tags-config.js'),
          import(host + 'data-tags-view-options.js'),
          import(host + 'generated-object-source-control.js'),
          import(host + 'data-tag-format-renderer.js'),
          import(host + 'data-tag-format-options.js'),
          import(host + 'canvas-zoom.js'),
        ]);
        // Preserve each code's selected data source and use the server's real SVG generator.
        scope.ExamListTemplateGeneratedObjects = scope.AdmitCardTemplateGeneratedObjects;
        return { text, objects, scroll, tagPanel, tagConfig, tagView, generated, dateRenderer, dateOptions, canvasZoom };
      })().catch(error => { loadPromise = null; throw error; });
    }
    return loadPromise;
  }

  function destroy() {
    mountVersion++;
    controls.splice(0).forEach(dispose => dispose?.());
    editor?.destroy();
    editor = null;
    scope.ApplyHubExamListEditor.instance = null;
  }

  async function open(options) {
    destroy();
    const version = mountVersion;
    lastOptions = options;
    const { state, card } = options;
    const page = document.getElementById('templateEditorPage');
    const root = page.querySelector('.applyhub-editor-body');
    root.innerHTML = `
      <div class="template-editor-shell applyhub-editor-shell">
        <div class="template-editor-grid examlist-template-editor-body template-editor-runtime-shell" id="templateEditorRuntimeHost">
          <aside class="editor-toolbar-column template-editor-toolbar-column editor-tools-column">
            <div class="editor-toolbar" id="templateEditorToolbarHost" role="toolbar" aria-label="양식 편집 도구"><p>편집기를 불러오고 있습니다.</p></div>
          </aside>
          <aside class="template-tag-panel" aria-label="데이터 태그"><div class="editor-tag-panel-block"><div class="template-tag-panel-heading"><p class="template-tag-caption">수험표 데이터 태그</p></div><div class="template-tag-strip editor-tag-catalog" id="templateTagStrip"></div></div></aside>
          <section class="template-editor-page editor-canvas-column" data-template-editor-canvas="true" data-template-editor-canvas-zoom="1" data-template-editor-canvas-zoom-mode="manual" style="--template-editor-canvas-zoom:1" aria-label="수험표 캔버스">
            <div class="template-editor-canvas-zoom-controls"><div class="template-editor-canvas-zoom-toolbar">
              <button class="template-editor-canvas-zoom-button" data-applyhub-zoom="out" data-template-editor-canvas-zoom-direction="-1" type="button" aria-label="축소">−</button>
              <button class="template-editor-canvas-zoom-value" data-applyhub-zoom="reset" data-template-editor-canvas-zoom-label type="button" aria-label="100%로 초기화">100%</button>
              <button class="template-editor-canvas-zoom-button" data-applyhub-zoom="in" data-template-editor-canvas-zoom-direction="1" type="button" aria-label="확대">+</button>
              <button class="template-editor-canvas-zoom-value" data-applyhub-zoom="fit" data-action="fit-template-editor-canvas-zoom" type="button">맞춤</button>
            </div></div>
            <div class="editor-paper-scale-box" data-template-editor-canvas-scale-box><div id="templateEditorSurface" data-editor-document-surface class="template-editor-surface editor-paper editor-document-surface editable" contenteditable="true" spellcheck="false"></div></div>
          </section>
          <aside class="template-page-properties-column" aria-label="페이지 속성 및 저장">
            <div class="template-page-properties-panel" id="templatePagePropertiesPanel" aria-label="페이지 속성"></div>
            <div class="editor-toolbar-footer template-editor-toolbar-footer"><button class="ghost-button" data-applyhub-editor-preview type="button">미리보기</button><button class="primary-button" data-save-template-editor="true" type="button" disabled>저장</button></div>
          </aside>
        </div>
      </div>
      <div id="templateEditorStatus" hidden></div>`;
    page.dataset.examlistEditor = 'true';
    const previous = state.templateEditor;
    state.templateEditor = { activeTemplateId: card.id, name: card.name, description: card.description, version: card.version, draftHtml: card.contentHtml,
      canvasZoom: previous?.activeTemplateId === card.id ? previous.canvasZoom ?? 1 : 1,
      canvasZoomMode: previous?.activeTemplateId === card.id ? previous.canvasZoomMode || 'manual' : 'manual' };
    const status = root.querySelector('#templateEditorStatus');
    let lastWarning = '';
    const statusObserver = new MutationObserver(() => {
      if (status.textContent.includes('영역 안에서 편집 중입니다.')) { status.textContent = ''; return; }
      if (status.classList.contains('warning') && status.textContent && status.textContent !== lastWarning) {
        lastWarning = status.textContent;
        scope.AdmitCardSettingsFeedback.notify(lastWarning, 'warning');
      } else if (!status.classList.contains('warning')) lastWarning = '';
    });
    statusObserver.observe(status, { childList: true, attributes: true, characterData: true, subtree: true });
    controls.push(() => statusObserver.disconnect());
    try {
      const [assets, context] = await Promise.all([loadAssets(), options.apiRequest(`/api/templates/${encodeURIComponent(card.id)}/editor-context`)]);
      const { text, objects, scroll, tagPanel, tagConfig, tagView, generated, dateRenderer, dateOptions, canvasZoom } = assets;
      if (version !== mountVersion) return;
      const surface = root.querySelector('#templateEditorSurface');
      const toolbar = root.querySelector('#templateEditorToolbarHost');
      const tagKeys = { examineeNo: 'candidate.examNo', name: 'candidate.name', birth: 'candidate.birthDate', track: 'candidate.admissionRoundName', admission: 'candidate.admissionTypeName', series: 'candidate.seriesName', unit: 'candidate.departmentName', major: 'candidate.majorName', examineePhoto: 'candidate.photo', currentDate: 'currentDate' };
      const sample = context.previewRecord;
      options.getPreviewData = () => sample;
      options.context = context;
      const tags = context.tags.map(tag => {
        const key = tag.key || tagKeys[tag.examineeKey];
        const group = tagConfig.dataTagAccordionGroups.find(group => group.keys.includes(key));
        return { ...tag, key, type: tag.type || (tag.examineeKey === 'examineePhoto' ? 'image' : ['birth', 'currentDate'].includes(tag.examineeKey) ? 'date' : 'text'), example: scope.ApplyHubTemplateData.getTagValue(sample, tag) || tag.label, iconMarkup: tagConfig.renderDataTagIcon(tag.group === 'signup' ? 'user' : group?.icon || 'book') };
      });
      editor = scope.ExamListTemplateEditorRuntime.createTemplateEditor({
        root: root.querySelector('#templateEditorRuntimeHost'),
        surface, toolbarHost: toolbar, tagHost: root.querySelector('#templateTagStrip'),
        pagePropertiesHost: root.querySelector('#templatePagePropertiesPanel'), statusElement: status,
        idPrefix: 'templateEditor', tags, initialHtml: card.contentHtml,
        generatedObjectSourceKey: 'examineeNo',
        previewPhotoPath: '/client/assets/template-preview-photo.png',
        getSchoolLogoDataUrl: () => String(state.superAdmin?.savedSnapshot?.logoImageUrl ?? state.superAdmin?.logoImageUrl ?? '').trim(),
        getPreviewData: options.getPreviewData,
        getTemplateEditorTagDisplay: ({ definition, label, iconMarkup, formatValue }) => {
          const view = tagView.getDataTagViewOptions();
          const example = definition?.type === 'date' || ['birth', 'currentDate'].includes(definition?.examineeKey) ? scope.ApplyHubTemplateData.formatDate(definition.example, formatValue) : definition?.example;
          return { text: view.showSampleData && definition?.examineeKey !== 'examineePhoto' ? example || label : label, iconMarkup: view.showIcons ? iconMarkup : '', hideIcons: !view.showIcons, sampleDisplay: view.showSampleData, title: label };
        },
        buildPhotoUrl: record => record.hasPhoto && record.submissionId ? `/api/applicant-submissions/${record.submissionId}/photo` : '',
        onChange: html => { state.templateEditor.draftHtml = html; },
      });
      scope.ApplyHubExamListEditor.instance = editor;
      baseline = options.baseline || editor.getHtml();
      tagPanel.renderGroupedDataTagPanel(root.querySelector('#templateTagStrip'), tags, true);
      const updateTagView = () => { if (editor) editor.setHtml(editor.getHtml(), { resetHistory: false }); };
      window.addEventListener(tagView.dataTagViewOptionsEventName, updateTagView);
      const onDirty = () => { state.templateEditor.draftHtml = editor?.getHtml() || ''; };
      controls.push(
        () => window.removeEventListener(tagView.dataTagViewOptionsEventName, updateTagView),
        text.bindFontSizeStepper({ editor, surfaceElement: surface, toolbarHost: toolbar }),
        text.bindLineHeightControl({ editor, surfaceElement: surface, toolbarHost: toolbar }),
        objects.bindObjectSizeControls({ editor, onDirty, selectedPage: {}, surfaceElement: surface, toolbarHost: toolbar }),
        objects.bindObjectAlignmentControls({ editor, surfaceElement: surface, toolbarHost: toolbar }),
        scroll.bindObjectInteractionScroll({ editor, surfaceElement: surface }),
        generated.bindGeneratedObjectSourceControl({ editor, surfaceElement: surface, tagDefinitions: tags, toolbarHost: toolbar }),
        bindDateFormats(root, tags, dateRenderer, dateOptions),
      );
      const canvas = root.querySelector('[data-template-editor-canvas]');
      const zoomOptions = { rootElement: canvas, onAfterApply: () => { editor?.updateImageSelectionOverlay(); editor?.updateTableObjectOverlay(); } };
      let resizeFrame = 0;
      const paperSizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => canvasZoom.applyTemplateEditorCanvasZoomFromState({ appState: state, ...zoomOptions, recomputeFit: true }));
      });
      paperSizeObserver.observe(surface);
      paperSizeObserver.observe(canvas);
      controls.push(() => { paperSizeObserver.disconnect(); cancelAnimationFrame(resizeFrame); });
      const wheelZoom = event => canvasZoom.handleTemplateEditorCanvasZoomWheel(event, state, zoomOptions);
      canvas.addEventListener('wheel', wheelZoom, { passive: false });
      controls.push(() => canvas.removeEventListener('wheel', wheelZoom));
      const sourcePicker = document.querySelector('.examlist-generated-object-source-modal');
      if (sourcePicker) {
        root.append(sourcePicker);
        const cancelPicker = event => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          sourcePicker.classList.add('hidden');
          sourcePicker.setAttribute('aria-hidden', 'true');
        };
        sourcePicker.addEventListener('keydown', cancelPicker);
        controls.push(() => sourcePicker.removeEventListener('keydown', cancelPicker));
      }
      root.querySelector('[data-save-template-editor]').disabled = false;
      bindActions(root, options, canvasZoom, zoomOptions);
      canvasZoom.applyTemplateEditorCanvasZoomFromState({ appState: state, ...zoomOptions, recomputeFit: true });
      if (!options.baseline) baseline = editor.getHtml();
    } catch (error) {
      if (version === mountVersion) {
        status.textContent = `편집기를 불러오지 못했습니다. ${error.message}`;
        scope.AdmitCardSettingsFeedback.notify(status.textContent, 'error');
      }
    }
  }

  function bindDateFormats(root, tags, renderer, formatOptions) {
    let overlay = null;
    let token = null;
    let modalState = null;
    const close = () => { overlay?.remove(); overlay = null; token = null; editor?.setInteractionDisabled(false); };
    const openFormat = event => {
      const target = event.target.closest('[data-template-tag-value]');
      const definition = tags.find(tag => tag.token === target?.dataset.templateTagValue);
      if (!target || !(definition?.type === 'date' || ['birth', 'currentDate'].includes(definition?.examineeKey))) return;
      event.preventDefault();
      token = target;
      modalState = { isOpen: true, isSupported: true, formatType: 'date', draftFormat: target.dataset.templateTagFormat || '', tagKey: definition.token, tagLabel: definition.label };
      const host = document.createElement('div');
      host.innerHTML = renderer.renderDataTagFormatModal({ dataTagFormatModal: modalState });
      overlay = host.firstElementChild;
      root.append(overlay);
      editor.setInteractionDisabled(true);
      const update = event => {
        const field = event.target.closest('[data-data-tag-format-field]');
        if (!field) return;
        modalState.draftFormat = field.value;
        const error = formatOptions.getDataTagFormatInputError('date', field.value);
        overlay.querySelector('[data-data-tag-format-field="format"]').value = field.value;
        overlay.querySelector('[data-data-tag-format-preview-value]').textContent = error || formatOptions.renderDataTagFormatPreview('date', field.value);
        overlay.querySelector('[data-action="save-data-tag-format-modal"]').disabled = !!error;
      };
      overlay.addEventListener('change', update);
      overlay.addEventListener('input', update);
      overlay.addEventListener('click', event => {
        event.stopPropagation();
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (action === 'save-data-tag-format-modal') {
          if (formatOptions.getDataTagFormatInputError('date', modalState.draftFormat)) return;
          token.dataset.templateTagFormat = modalState.draftFormat;
          token.dataset.templateTagFormatType = 'date';
          editor.setInteractionDisabled(false);
          editor.sync();
          close();
        } else if (action === 'close-data-tag-format-modal' || event.target === overlay) close();
      });
      overlay.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } });
      overlay.querySelector('input,select')?.focus();
    };
    root.addEventListener('dblclick', openFormat);
    return () => { close(); root.removeEventListener('dblclick', openFormat); };
  }

  function bindActions(root, options, canvasZoom, zoomOptions) {
    let saving = false;
    const listener = async event => {
      if (event.target.closest('[data-save-template-editor]')) {
        if (saving || !editor) return;
        const html = editor.getHtml();
        if (editor.state.templateEditor.hasOverflow) {
          root.querySelector('#templateEditorStatus').textContent = '용지 영역을 초과했습니다. 내용이나 용지 설정을 조정한 뒤 저장하세요.';
          scope.AdmitCardSettingsFeedback.notify(root.querySelector('#templateEditorStatus').textContent, 'warning');
          return;
        }
        saving = true;
        event.target.disabled = true;
        try {
          const updated = await options.apiRequest(`/api/templates/${encodeURIComponent(options.card.id)}`, {
            method: 'PUT', body: JSON.stringify({ name: options.card.name, description: options.card.description, version: options.card.version, contentHtml: html }),
          });
          options.updateTemplateCard(options.card.id, updated);
          options.card = updated;
          baseline = editor.getHtml();
          root.querySelector('#templateEditorStatus').textContent = '양식을 저장했습니다.';
          scope.AdmitCardSettingsFeedback.notify('양식을 저장했습니다.');
        } catch (error) {
          root.querySelector('#templateEditorStatus').textContent = error.message;
          scope.AdmitCardSettingsFeedback.notify(error.message, 'error');
        } finally { saving = false; event.target.disabled = false; }
      } else if (event.target.closest('[data-applyhub-editor-preview]')) {
        options.openPreview(options.card.id, editor.getHtml());
      } else if (event.target.closest('[data-applyhub-zoom]')) {
        const action = event.target.closest('[data-applyhub-zoom]').dataset.applyhubZoom;
        if (action === 'fit') canvasZoom.fitTemplateEditorCanvasZoom(options.state, zoomOptions);
        else if (action === 'reset') canvasZoom.resetTemplateEditorCanvasZoom(options.state, zoomOptions);
        else canvasZoom.stepTemplateEditorCanvasZoom(options.state, action === 'in' ? 1 : -1, zoomOptions);
      }
    };
    root.addEventListener('click', listener);
    controls.push(() => root.removeEventListener('click', listener));
    const escape = event => {
      if (event.key !== 'Escape' || event.defaultPrevented || !event.target.closest('#templateEditorRuntimeHost')) return;
      const panels = Array.from(root.querySelectorAll('.template-toolbar-combo-menu:not(.hidden), .template-toolbar-color-panel:not(.hidden), .template-toolbar-icon-select-menu:not(.hidden), .template-toolbar-table-insert-panel:not(.hidden)')).filter(panel => panel.getClientRects().length);
      event.preventDefault();
      if (panels.length) {
        panels.forEach(panel => panel.classList.add('hidden'));
        root.querySelectorAll('[aria-expanded="true"]').forEach(control => control.setAttribute('aria-expanded', 'false'));
      }
    };
    root.addEventListener('keydown', escape);
    controls.push(() => root.removeEventListener('keydown', escape));
  }

  function renderPage() {
    const id = decodeURIComponent(location.pathname.split('/')[2] || '');
    const card = dependencies?.state.templateCards.find(card => card.id === id);
    if (!card) return '<article class="form-card"><h3>양식을 찾을 수 없습니다.</h3><a class="ghost-button" href="/templates">양식 목록으로</a></article>';
    const draft = editor && lastOptions?.card.id === id ? editor.getHtml() : card.contentHtml;
    const savedBaseline = editor && lastOptions?.card.id === id ? baseline : '';
    queueMicrotask(() => { if (document.getElementById('templateEditorPage')) void open({ ...dependencies, card: { ...card, contentHtml: draft }, baseline: savedBaseline }); });
    const escape = value => String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    return `<section id="templateEditorPage" class="template-editor-page-view">
      <header class="template-editor-page-header"><h2>수험표 양식 - ${escape(card.name)}</h2></header>
      <div class="applyhub-editor-body"><p>편집기를 불러오고 있습니다.</p></div></section>`;
  }
  window.addEventListener('beforeunload', event => { if (editor && editor.getHtml() !== baseline) { event.preventDefault(); event.returnValue = ''; } });
  scope.ApplyHubExamListEditor = { configure: options => { dependencies = options; }, renderPage, open, destroy, instance: null,
    getHtml: () => editor?.getHtml() || '', preview: () => lastOptions?.openPreview(lastOptions.card.id, editor?.getHtml()) };
})(globalThis);
