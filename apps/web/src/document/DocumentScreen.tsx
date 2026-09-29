import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocumentDetail } from '@moneta/core/document';
import { describeDocumentView } from '@moneta/core/document-view';
import { fileUrl } from '../api';
import { EmptyState } from '../frame/EmptyState';
import { BackIcon } from '../icons';
import { BackLink, Link, navigate } from '../router';
import { DocumentActions } from './DocumentActions';
import { DocumentFacts } from './DocumentFacts';
import { OriginalPages, type PagesMode } from './OriginalPages';
import { OriginalViewer } from './OriginalViewer';
import { closePdfs } from './pdf';
import { SourceBlock } from './SourceBlock';
import { useDocument } from './useDocument';

// The device's zone: dates are stored in UTC and converted only here.
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

// One document: the original first, since that is what it is opened for, then
// the facts, where it came from, and download/share. `viewer` is the
// full-screen original (/d/:id/original), drawn over this screen.
export function DocumentScreen({ id, viewer }: { id: string; viewer: boolean }) {
  const state = useDocument(id);

  useEffect(function freePdfsOnLeave() {
    return closePdfs;
  }, []);

  if (state.status === 'ready') {
    return <DocumentBody detail={state.detail} viewer={viewer} />;
  }

  let body;
  if (state.status === 'loading') {
    body = (
      <p className="note" aria-live="polite">
        Loading…
      </p>
    );
  } else if (state.status === 'notFound') {
    body = (
      <EmptyState
        title="Document not found"
        action={
          <Link to={{ name: 'archive', view: 'recent' }} className="button">
            Back to the archive
          </Link>
        }
      >
        There is no document with the id {id} in the archive. The link may be incomplete.
      </EmptyState>
    );
  } else {
    body = (
      <EmptyState
        title="The document didn’t load"
        action={
          <button type="button" className="button" onClick={state.retry}>
            Try again
          </button>
        }
      >
        {state.error}
      </EmptyState>
    );
  }
  return (
    <div className="screen">
      <header className="screen-header screen-header--detail">
        <DocumentBackLink />
        <h1 className="screen-title screen-title--small">Document</h1>
      </header>
      {body}
    </div>
  );
}

function DocumentBody({ detail, viewer }: { detail: DocumentDetail; viewer: boolean }) {
  const { document: doc, files, mailUrl } = detail;
  const view = useMemo(
    function describe() {
      return describeDocumentView(doc, files, TIME_ZONE);
    },
    [doc, files],
  );
  // The page tapped to open the full-screen view, so it opens there.
  const [startAt, setStartAt] = useState<string | null>(null);

  const openViewer = useCallback(
    function openViewer(pageKey: string) {
      setStartAt(pageKey);
      navigate({ name: 'original', id: doc.id });
    },
    [doc.id],
  );
  const inline = useMemo(
    function inlineMode(): PagesMode {
      return { kind: 'inline', onOpen: openViewer };
    },
    [openViewer],
  );
  const urlOf = useCallback(
    function urlOf(position: number) {
      return fileUrl(doc.id, position);
    },
    [doc.id],
  );

  return (
    <article className="document">
      <header className="screen-header screen-header--detail document__header">
        <DocumentBackLink />
        <div className="document__titles">
          <h1 className="screen-title screen-title--small">{view.title}</h1>
          <p className="document__subtitle">{view.subtitle}</p>
        </div>
      </header>
      {view.deleted !== null && (
        <p className="document__deleted" role="status">
          {view.deleted}. It stays out of the archive until it is restored.
        </p>
      )}
      <section className="document__original" aria-label="Original">
        {files.length > 0 ? (
          <OriginalPages documentId={doc.id} files={files} mode={inline} />
        ) : (
          <p className="note">No original is stored for this document, only its facts.</p>
        )}
      </section>
      {view.facts.length > 0 && (
        <div className="document__facts">
          <DocumentFacts facts={view.facts} />
        </div>
      )}
      <div className="document__source">
        <SourceBlock
          source={doc.source}
          view={view.source}
          mailUrl={mailUrl}
          files={view.files}
          downloadUrl={urlOf}
        />
      </div>
      {files.length > 0 && (
        <div className="document__actions">
          <DocumentActions title={view.title} files={view.files} fileUrl={urlOf} />
        </div>
      )}
      {viewer && files.length > 0 && (
        <OriginalViewer documentId={doc.id} title={view.title} files={files} startAt={startAt} />
      )}
    </article>
  );
}

function DocumentBackLink() {
  return (
    <BackLink
      fallback={{ name: 'archive', view: 'recent' }}
      className="icon-button"
      aria-label="Back to the archive"
    >
      <BackIcon />
    </BackLink>
  );
}
