// pdf.js, loaded only when a PDF is opened, so the archive's own bundle stays
// small. Phones' browsers and the Android WebView can't show a PDF inline, so
// Moneta draws the pages itself.
//
// The legacy build: the modern one relies on JavaScript only the newest
// Chromium ships, and the WebView on an older phone can lag behind.
import type * as PdfJsModule from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';

type PdfJs = typeof PdfJsModule;

let library: Promise<PdfJs> | null = null;

function loadLibrary(): Promise<PdfJs> {
  if (library === null) {
    library = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]).then(function configure([pdfjs, worker]) {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
    // A failed chunk load (flaky network) may be retried later.
    library.catch(function forget() {
      library = null;
    });
  }
  return library;
}

interface OpenPdf {
  task: Promise<PDFDocumentLoadingTask>;
  pdf: Promise<PDFDocumentProxy>;
}

// One parsed copy per original while its document is open; the inline pages
// and the full-screen view share it.
const open = new Map<string, OpenPdf>();

export function openPdf(url: string): Promise<PDFDocumentProxy> {
  let entry = open.get(url);
  if (entry === undefined) {
    const task = loadLibrary().then(function start(pdfjs) {
      // Forms stay flat and no script runs: an archived PDF is only looked at.
      return pdfjs.getDocument({ url, enableXfa: false });
    });
    const pdf = task.then(function parsed(loading) {
      return loading.promise;
    });
    entry = { task, pdf };
    open.set(url, entry);
    pdf.catch(function forget() {
      open.delete(url);
    });
  }
  return entry.pdf;
}

// Frees the parsed PDFs (and their worker memory) when the document closes.
export function closePdfs(): void {
  for (const entry of open.values()) {
    entry.task
      .then(function destroy(loading) {
        return loading.destroy();
      })
      .catch(function ignore() {
        // The library never loaded, so there is nothing to free.
      });
  }
  open.clear();
}
