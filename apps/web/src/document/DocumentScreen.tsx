import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocumentDetail } from '@moneta/core/document';
import { describeDocumentView } from '@moneta/core/document-view';
import { deleteDocument, describeError, fileUrl, restoreDocument, saveDocument } from '../api';
import { EmptyState } from '../frame/EmptyState';
import { BackIcon } from '../icons';
import { BackLink, Link, navigate } from '../router';
import { DocumentActions } from './DocumentActions';
import { DocumentEditForm } from './DocumentEditForm';
import { DocumentFacts } from './DocumentFacts';
import { OriginalPages, type PagesMode } from './OriginalPages';
import { OriginalViewer } from './OriginalViewer';
import { closePdfs } from './pdf';
import { SourceBlock } from './SourceBlock';
import { useDocument } from './useDocument';
import { archiveChanged } from '../archive/useArchiveList';

// The device's zone: dates are stored in UTC and converted only here.
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

// One document: facts for quick lookup, then the original, provenance and
// download/share. `viewer` is the full-screen original (/d/:id/original),
// drawn over this screen.
export function DocumentScreen({
  id,
  viewer,
  onDeleted,
}: {
  id: string;
  viewer: boolean;
  onDeleted: (ids: string[], label: string) => void;
}) {
  const state = useDocument(id);

  useEffect(function freePdfsOnLeave() {
    return closePdfs;
  }, []);

  if (state.status === 'ready') {
    return <DocumentBody detail={state.detail} viewer={viewer} onDeleted={onDeleted} />;
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

function DocumentBody({
  detail,
  viewer,
  onDeleted,
}: {
  detail: DocumentDetail;
  viewer: boolean;
  onDeleted: (ids: string[], label: string) => void;
}) {
  const [current, setCurrent] = useState(detail);
  const [editing, setEditing] = useState(false);
  const [starError, setStarError] = useState<string | null>(null);
  const [savingStar, setSavingStar] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { document: doc, files, mailUrl } = current;
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
        {!viewer && doc.deletedAt === null && !editing && (
          <>
            <button
              type="button"
              className="text-button document__star-link"
              disabled={savingStar}
              aria-pressed={doc.starred}
              onClick={async function toggleStar() {
                setSavingStar(true);
                setStarError(null);
                try {
                  setCurrent(await saveDocument(doc.id, { starred: !doc.starred }));
                } catch (error) {
                  setStarError(describeError(error));
                } finally {
                  setSavingStar(false);
                }
              }}
            >
              {doc.starred ? '★ Starred' : '☆ Star'}
            </button>
            <button
              type="button"
              className="text-button document__edit-link"
              onClick={function startEdit() {
                setEditing(true);
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="text-button document__delete-link"
              disabled={deleting}
              onClick={async function remove() {
                if (!window.confirm(`Move “${view.title}” to Recently deleted?`)) return;
                setDeleting(true);
                setStarError(null);
                try {
                  await deleteDocument(doc.id);
                  onDeleted([doc.id], 'Document deleted');
                  navigate({ name: 'archive', view: 'recent' }, { replace: true });
                } catch (error) {
                  setStarError(describeError(error));
                  setDeleting(false);
                }
              }}
            >
              Delete
            </button>
          </>
        )}
      </header>
      {starError !== null && (
        <p className="document-edit__error" role="alert">
          {starError}
        </p>
      )}
      {view.deleted !== null && (
        <p className="document__deleted" role="status">
          {view.deleted}. It stays out of the archive until it is restored.{' '}
          <button
            type="button"
            className="text-button"
            onClick={async function restore() {
              try {
                setCurrent(await restoreDocument(doc.id));
                archiveChanged();
              } catch (error) {
                setStarError(describeError(error));
              }
            }}
          >
            Restore
          </button>
        </p>
      )}
      {editing && (
        <div className="document__facts">
          <h2 className="document__section-title">Edit details</h2>
          <DocumentEditForm
            document={doc}
            onSaved={function saved(savedDetail) {
              setCurrent(savedDetail);
              setEditing(false);
            }}
            onCancel={function cancel() {
              setEditing(false);
            }}
          />
        </div>
      )}
      {!editing && (
        <section className="document__facts" aria-labelledby="document-details-title">
          <h2 id="document-details-title" className="document__section-title">
            Details
          </h2>
          {view.facts.length > 0 ? (
            <DocumentFacts facts={view.facts} />
          ) : (
            <div className="document__empty-details list">
              <p>No details have been added yet.</p>
              {doc.deletedAt === null && (
                <button
                  type="button"
                  className="text-button"
                  onClick={function startEdit() {
                    setEditing(true);
                  }}
                >
                  Add details
                </button>
              )}
            </div>
          )}
          {doc.tags.length > 0 && (
            <div className="document__tags">
              {doc.tags.map(function tag(name) {
                return (
                  <Link
                    key={name}
                    to={{ name: 'archive', view: 'tags', filter: name }}
                    className="document__tag"
                  >
                    {name}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}
      <section className="document__original" aria-label="Original">
        <h2 className="document__section-title">Original</h2>
        {files.length > 0 ? (
          <OriginalPages documentId={doc.id} files={files} mode={inline} />
        ) : (
          <p className="note">No original is stored for this document, only its facts.</p>
        )}
      </section>
      <div className="document__source">
        <SourceBlock
          source={doc.source}
          view={view.source}
          mailUrl={mailUrl}
          files={view.files}
          downloadUrl={urlOf}
        />
      </div>
      {files.length > 0 && !editing && (
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
