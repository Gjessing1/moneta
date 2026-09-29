import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { DocumentFile } from '@moneta/core/document';
import { ClearIcon, ZoomInIcon, ZoomOutIcon } from '../icons';
import { goBack } from '../router';
import { OriginalPages, type PagesMode } from './OriginalPages';
import { ZoomPane, type ZoomControls } from './ZoomPane';

const VIEWER_MODE: PagesMode = { kind: 'viewer' };
const BUTTON_ZOOM = 1.5;
const KEY_PAN = 80;

// The original full screen, over everything, for reading the small print.
// It is its own route (/d/:id/original), so back closes it.
export function OriginalViewer({
  documentId,
  title,
  files,
  startAt,
}: {
  documentId: string;
  title: string;
  files: readonly DocumentFile[];
  startAt: string | null;
}) {
  const zoom = useRef<ZoomControls>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  function close() {
    goBack({ name: 'document', id: documentId });
  }

  // The page behind can't scroll or take focus while this is open.
  useEffect(function takeOver() {
    const root = document.getElementById('root');
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root?.setAttribute('inert', '');
    closeRef.current?.focus();
    return function giveBack() {
      document.body.style.overflow = overflow;
      root?.removeAttribute('inert');
    };
  }, []);

  useEffect(
    function listenForKeys() {
      function onKey(event: KeyboardEvent) {
        const controls = zoom.current;
        if (event.key === 'Escape') {
          goBack({ name: 'document', id: documentId });
        } else if (controls === null) {
          return;
        } else if (event.key === '+' || event.key === '=') {
          controls.zoomBy(BUTTON_ZOOM);
        } else if (event.key === '-') {
          controls.zoomBy(1 / BUTTON_ZOOM);
        } else if (event.key === 'ArrowUp') {
          controls.panBy(0, KEY_PAN);
        } else if (event.key === 'ArrowDown') {
          controls.panBy(0, -KEY_PAN);
        } else if (event.key === 'ArrowLeft') {
          controls.panBy(KEY_PAN, 0);
        } else if (event.key === 'ArrowRight') {
          controls.panBy(-KEY_PAN, 0);
        } else {
          return;
        }
        event.preventDefault();
      }
      window.addEventListener('keydown', onKey);
      return function stop() {
        window.removeEventListener('keydown', onKey);
      };
    },
    [documentId],
  );

  return createPortal(
    <div className="viewer" role="dialog" aria-modal="true" aria-label={`${title}, original`}>
      <div className="viewer__bar">
        <button
          ref={closeRef}
          type="button"
          className="viewer__button"
          aria-label="Close the full-screen view"
          onClick={close}
        >
          <ClearIcon />
        </button>
        <span className="viewer__title">{title}</span>
        <button
          type="button"
          className="viewer__button"
          aria-label="Zoom out"
          onClick={function zoomOut() {
            zoom.current?.zoomBy(1 / BUTTON_ZOOM);
          }}
        >
          <ZoomOutIcon />
        </button>
        <button
          type="button"
          className="viewer__button"
          aria-label="Zoom in"
          onClick={function zoomIn() {
            zoom.current?.zoomBy(BUTTON_ZOOM);
          }}
        >
          <ZoomInIcon />
        </button>
      </div>
      <ZoomPane ref={zoom} startAt={startAt} label="Pinch or double-tap to zoom">
        <OriginalPages documentId={documentId} files={files} mode={VIEWER_MODE} />
      </ZoomPane>
    </div>,
    document.body,
  );
}
