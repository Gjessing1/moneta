import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { DocumentFile } from '@moneta/core/document';
import { fileTypeLabel } from '@moneta/core/document-view';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { fileUrl } from '../api';
import { openPdf } from './pdf';

// Every page of every original, in order: PDF pages drawn by pdf.js, photos as
// images. Used twice: inline on the document (each page opens the full-screen
// view) and inside that view, drawn sharper for zooming.
export type PagesMode = { kind: 'inline'; onOpen: (pageKey: string) => void } | { kind: 'viewer' };

// Photos a browser can draw. HEIC is stored as it came from the phone, but
// only Safari can show it.
const DRAWABLE_IMAGES = ['image/jpeg', 'image/png', 'image/webp'];

// Pixels drawn per CSS pixel, on top of the screen's own density: the
// full-screen view is drawn sharper so zooming in stays legible.
const INLINE_DETAIL = 1;
const VIEWER_DETAIL = 2.5;
// A canvas past ~16M pixels fails or stalls on phones; stay well under.
const MAX_CANVAS_PIXELS = 12_000_000;
// Pages this far off screen are drawn ahead, so scrolling rarely meets a blank.
const DRAW_AHEAD = '1200px';

export function OriginalPages({
  documentId,
  files,
  mode,
}: {
  documentId: string;
  files: readonly DocumentFile[];
  mode: PagesMode;
}) {
  return (
    <div className={`pages pages--${mode.kind}`}>
      {files.map(function renderFile(file) {
        return <OriginalFile key={file.id} documentId={documentId} file={file} mode={mode} />;
      })}
    </div>
  );
}

function OriginalFile({
  documentId,
  file,
  mode,
}: {
  documentId: string;
  file: DocumentFile;
  mode: PagesMode;
}) {
  const url = fileUrl(documentId, file.position);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const type = fileTypeLabel(file.contentType);
  const markFailed = useCallback(function markFailed() {
    setFailed(true);
  }, []);

  let body: ReactNode;
  if (failed) {
    body = <Unshowable url={url} file={file} />;
  } else if (file.contentType === 'application/pdf') {
    body = (
      <PdfFile
        url={url}
        position={file.position}
        mode={mode}
        onPages={setPageCount}
        onFail={markFailed}
      />
    );
  } else if (DRAWABLE_IMAGES.includes(file.contentType)) {
    body = (
      <Page pageKey={pageKey(file.position, 0)} label={`${type} ${file.position + 1}`} mode={mode}>
        <img className="page__image" src={url} alt="" draggable={false} onError={markFailed} />
      </Page>
    );
  } else {
    body = <Unshowable url={url} file={file} />;
  }

  let caption = type;
  if (pageCount !== null) {
    caption = `${type}, ${pageCount} ${plural(pageCount, 'page')}`;
  }
  return (
    <figure className="original">
      {body}
      {mode.kind === 'inline' && !failed && (
        <figcaption className="original__caption">
          <span>{caption}</span>
          <span aria-hidden="true">Tap to zoom</span>
        </figcaption>
      )}
    </figure>
  );
}

function PdfFile({
  url,
  position,
  mode,
  onPages,
  onFail,
}: {
  url: string;
  position: number;
  mode: PagesMode;
  onPages: (count: number) => void;
  onFail: () => void;
}) {
  const [pdf, setPdf] = useState<{ doc: PDFDocumentProxy; sizes: PageSize[] } | null>(null);

  useEffect(
    function load() {
      let cancelled = false;
      openPdf(url)
        .then(async function measure(doc) {
          // Every page's shape up front, so the column has its final height
          // before anything is drawn and the view doesn't jump.
          const sizes: PageSize[] = [];
          for (let n = 1; n <= doc.numPages; n++) {
            const page = await doc.getPage(n);
            const viewport = page.getViewport({ scale: 1 });
            sizes.push({ width: viewport.width, height: viewport.height });
          }
          if (!cancelled) {
            setPdf({ doc, sizes });
            onPages(sizes.length);
          }
        })
        .catch(function fail(err: unknown) {
          if (!cancelled) {
            console.error('could not open the PDF', err);
            onFail();
          }
        });
      return function cancel() {
        cancelled = true;
      };
    },
    [url, onPages, onFail],
  );

  if (pdf === null) {
    return <div className="page page--loading" aria-label="Loading the PDF" />;
  }
  return (
    <>
      {pdf.sizes.map(function renderPage(size, index) {
        return (
          <Page
            key={index}
            pageKey={pageKey(position, index)}
            label={`Page ${index + 1} of ${pdf.sizes.length}`}
            mode={mode}
            aspect={size}
          >
            <PdfCanvas doc={pdf.doc} pageNumber={index + 1} size={size} mode={mode} />
          </Page>
        );
      })}
    </>
  );
}

interface PageSize {
  width: number;
  height: number;
}

function PdfCanvas({
  doc,
  pageNumber,
  size,
  mode,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  size: PageSize;
  mode: PagesMode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const near = useNearScreen(canvasRef);
  const [drawnWidth, setDrawnWidth] = useState(0);
  const cssWidth = useWidth(canvasRef);

  let detail = INLINE_DETAIL;
  if (mode.kind === 'viewer') {
    detail = VIEWER_DETAIL;
  }

  useEffect(
    function draw() {
      const canvas = canvasRef.current;
      // Redraw only when the page got noticeably wider, not on every pixel of
      // a window resize.
      if (canvas === null || !near || cssWidth === 0 || cssWidth < drawnWidth * 1.2) {
        return;
      }
      let scale = (cssWidth * window.devicePixelRatio * detail) / size.width;
      const maxScale = Math.sqrt(MAX_CANVAS_PIXELS / (size.width * size.height));
      scale = Math.min(scale, maxScale);

      let task: { cancel: () => void } | null = null;
      let cancelled = false;
      doc
        .getPage(pageNumber)
        .then(function render(page) {
          if (cancelled) {
            return;
          }
          const viewport = page.getViewport({ scale });
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const rendering = page.render({ canvas, viewport });
          task = rendering;
          return rendering.promise.then(function drawn() {
            setDrawnWidth(cssWidth);
          });
        })
        .catch(function ignoreCancel(err: unknown) {
          if (!(err instanceof Error && err.name === 'RenderingCancelledException')) {
            console.error('could not draw a PDF page', err);
          }
        });
      return function cancel() {
        cancelled = true;
        task?.cancel();
      };
    },
    [doc, pageNumber, size, near, cssWidth, drawnWidth, detail],
  );

  return <canvas ref={canvasRef} className="page__canvas" />;
}

// One page. Inline it is a button that opens the full-screen view there.
function Page({
  pageKey: key,
  label,
  mode,
  aspect,
  children,
}: {
  pageKey: string;
  label: string;
  mode: PagesMode;
  aspect?: PageSize;
  children: ReactNode;
}) {
  let style: { aspectRatio: string } | undefined;
  if (aspect !== undefined) {
    style = { aspectRatio: `${aspect.width} / ${aspect.height}` };
  }
  if (mode.kind === 'inline') {
    return (
      <button
        type="button"
        className="page"
        style={style}
        aria-label={`${label}, open full screen`}
        onClick={function open() {
          mode.onOpen(key);
        }}
      >
        {children}
      </button>
    );
  }
  return (
    <div className="page" style={style} data-page={key} role="img" aria-label={label}>
      {children}
    </div>
  );
}

function Unshowable({ url, file }: { url: string; file: DocumentFile }) {
  let reason = 'This file type can’t be shown here.';
  if (file.contentType === 'image/heic' || file.contentType === 'image/heif') {
    reason = 'This photo is in HEIC format, which this browser can’t show.';
  } else if (file.contentType === 'application/pdf') {
    reason = 'This PDF could not be opened here.';
  }
  return (
    <div className="page page--unshowable">
      <p>{reason}</p>
      <a className="button" href={url} download={file.fileName ?? ''}>
        Download it to view
      </a>
    </div>
  );
}

export function pageKey(position: number, page: number): string {
  return `${position}:${page}`;
}

function plural(count: number, word: string): string {
  if (count === 1) {
    return word;
  }
  return `${word}s`;
}

// True once the element comes within DRAW_AHEAD of the screen. It stays true:
// a drawn page is kept rather than thrown away and drawn again.
function useNearScreen(ref: RefObject<Element | null>): boolean {
  const [near, setNear] = useState(false);
  useEffect(
    function watch() {
      const element = ref.current;
      if (element === null || near) {
        return;
      }
      const observer = new IntersectionObserver(
        function onChange(entries) {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setNear(true);
            }
          }
        },
        { rootMargin: DRAW_AHEAD },
      );
      observer.observe(element);
      return function stop() {
        observer.disconnect();
      };
    },
    [ref, near],
  );
  return near;
}

function useWidth(ref: RefObject<Element | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(
    function watch() {
      const element = ref.current;
      if (element === null) {
        return;
      }
      const observer = new ResizeObserver(function onResize(entries) {
        for (const entry of entries) {
          setWidth(Math.round(entry.contentRect.width));
        }
      });
      observer.observe(element);
      return function stop() {
        observer.disconnect();
      };
    },
    [ref],
  );
  return width;
}
