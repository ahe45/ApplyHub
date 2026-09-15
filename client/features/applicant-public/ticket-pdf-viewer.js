/* Render PDF pages ourselves so mobile browsers need no native PDF plug-in. */
(function () {
  let libraryPromise;
  const pendingPdfs = new Map();

  function acquirePdf(url) {
    let entry = pendingPdfs.get(url);
    if (!entry) {
      const controller = new AbortController();
      entry = { controller, users: 0, timer: null };
      entry.promise = fetch(url, { signal: controller.signal, credentials: 'same-origin', cache: 'no-store' })
        .then(response => {
          if (!response.ok) throw new Error('PDF_UNAVAILABLE');
          return response.arrayBuffer();
        }).catch(error => {
          if (pendingPdfs.get(url) === entry) pendingPdfs.delete(url);
          throw error;
        });
      pendingPdfs.set(url, entry);
    }
    clearTimeout(entry.timer);
    entry.users++;
    let released = false;
    return {
      promise: entry.promise,
      release() {
        if (released) return;
        released = true;
        if (--entry.users === 0) {
          // Share an in-flight request across immediate UI replacements only.
          entry.timer = setTimeout(() => {
            if (pendingPdfs.get(url) === entry) pendingPdfs.delete(url);
            entry.controller.abort();
          }, 100);
        }
      },
    };
  }
  function loadLibrary() {
    if (!libraryPromise) {
      libraryPromise = import('/node_modules/pdfjs-dist/legacy/build/pdf.min.mjs?v=6.3.289').then(pdfjs => {
        pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs?v=6.3.289';
        return pdfjs;
      }).catch(error => { libraryPromise = null; throw error; });
    }
    return libraryPromise;
  }

  class TicketPdfViewer extends HTMLElement {
    connectedCallback() {
      this.load();
    }

    disconnectedCallback() {
      this.dispose();
    }

    dispose() {
      this.runId = (this.runId || 0) + 1;
      this.renderTask?.cancel();
      this.renderTask = null;
      this.pdfRequest?.release();
      this.pdfRequest = null;
      this.loadingTask?.destroy().catch(() => {});
      this.loadingTask = null;
      this.querySelectorAll('canvas').forEach(canvas => { canvas.width = canvas.height = 0; });
    }

    async load() {
      this.dispose();
      const runId = this.runId;
      const isCurrent = () => this.isConnected && this.runId === runId;
      this.replaceChildren();
      this.setAttribute('aria-busy', 'true');
      const status = document.createElement('p');
      status.className = 'ticket-pdf-status';
      status.setAttribute('role', 'status');
      status.textContent = '수험표를 불러오는 중입니다.';
      this.append(status);
      try {
        const request = acquirePdf(this.getAttribute('src'));
        this.pdfRequest = request;
        // Start PDF generation/download while the renderer is loading.
        const [pdfjs, data] = await Promise.all([
          loadLibrary(),
          request.promise,
        ]);
        if (!isCurrent()) return;
        const loadingTask = pdfjs.getDocument({
          data: data.slice(0),
          cMapUrl: '/node_modules/pdfjs-dist/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/node_modules/pdfjs-dist/standard_fonts/',
          wasmUrl: '/node_modules/pdfjs-dist/wasm/',
          isEvalSupported: false,
        });
        this.loadingTask = loadingTask;
        request.release();
        this.pdfRequest = null;
        const pdf = await loadingTask.promise;
        if (!isCurrent()) return;
        for (let number = 1; number <= pdf.numPages; number++) {
          const page = await pdf.getPage(number);
          if (!isCurrent()) return;
          const original = page.getViewport({ scale: 1 });
          // Keep text crisp while bounding canvas memory on high-DPI phones.
          const width = Math.min(1600, Math.max(1, this.clientWidth) * Math.min(devicePixelRatio || 1, 2));
          const scale = Math.min(width / original.width, Math.sqrt(4000000 / (original.width * original.height)));
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', `수험표 ${number} / ${pdf.numPages} 페이지`);
          canvas.hidden = true;
          this.append(canvas);
          this.renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport, background: '#ffffff' });
          await this.renderTask.promise;
          if (!isCurrent()) return;
          this.renderTask = null;
          canvas.hidden = false;
          if (number === 1) {
            status.remove();
            // Let the first page paint before rendering any remaining pages.
            await new Promise(resolve => requestAnimationFrame(resolve));
            if (!isCurrent()) return;
          }
          page.cleanup();
        }
        status.remove();
        this.setAttribute('aria-busy', 'false');
      } catch (error) {
        if (!isCurrent()) return;
        this.dispose();
        this.replaceChildren(status);
        this.setAttribute('aria-busy', 'false');
        status.textContent = '수험표를 표시하지 못했습니다. 다시 시도하거나 위의 다운로드 버튼으로 PDF를 확인해 주세요.';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'ghost-button';
        retry.textContent = '다시 시도';
        retry.addEventListener('click', () => this.load(), { once: true });
        this.append(retry);
      }
    }
  }

  customElements.define('ticket-pdf-viewer', TicketPdfViewer);
})();
