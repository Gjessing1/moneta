import { useEffect, useState } from 'react';
import { documentTitle } from '@moneta/core/archive-list';
import type { ArchiveDocument } from '@moneta/core/document';
import { deleteDocumentNow, describeError, fetchDocumentPage, restoreDocument } from '../api';
import { archiveChanged } from '../archive/useArchiveList';
import { EmptyState } from '../frame/EmptyState';
import { Link } from '../router';

export function RecentlyDeletedScreen() {
  const [items, setItems] = useState<ArchiveDocument[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load(after: string | null) {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchDocumentPage(after, null, { deleted: true });
      setItems(function append(previous) {
        return after === null ? page.items : [...previous, ...page.items];
      });
      setCursor(page.nextCursor);
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setLoading(false);
    }
  }

  useEffect(function firstPage() {
    void load(null);
  }, []);

  async function restore(id: string) {
    setBusy(id);
    setError(null);
    try {
      await restoreDocument(id);
      setItems(function without(previous) {
        return previous.filter(function keep(item) {
          return item.id !== id;
        });
      });
      archiveChanged();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete “${title}” permanently? This cannot be undone.`)) return;
    setBusy(id);
    setError(null);
    try {
      await deleteDocumentNow(id);
      setItems(function without(previous) {
        return previous.filter(function keep(item) {
          return item.id !== id;
        });
      });
      archiveChanged();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h1 className="screen-title">Recently deleted</h1>
      </header>
      <p className="note">Documents here are removed permanently after 30 days.</p>
      {error !== null && (
        <div role="alert" className="document-edit__error">
          <p>{error}</p>
          {items.length === 0 && (
            <button
              type="button"
              className="button"
              onClick={function retry() {
                void load(null);
              }}
            >
              Try again
            </button>
          )}
        </div>
      )}
      {!loading && items.length === 0 && cursor === null && error === null && (
        <EmptyState title="Nothing recently deleted">
          Deleted documents will appear here for 30 days.
        </EmptyState>
      )}
      <ul className="list deleted-list">
        {items.map(function row(doc) {
          const title = documentTitle(doc);
          return (
            <li key={doc.id} className="deleted-row">
              <div>
                <Link to={{ name: 'document', id: doc.id }}>{title}</Link>
                <p className="note">
                  Deleted {new Date(doc.deletedAt as string).toLocaleDateString()}
                </p>
              </div>
              <div className="deleted-row__actions">
                <button
                  type="button"
                  className="button"
                  disabled={busy !== null}
                  onClick={function restoreOne() {
                    void restore(doc.id);
                  }}
                >
                  Restore
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy !== null}
                  onClick={function deleteOne() {
                    void remove(doc.id, title);
                  }}
                >
                  Delete now
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {loading && <p className="note">Loading…</p>}
      {cursor !== null && !loading && (
        <button
          type="button"
          className="button"
          onClick={function more() {
            void load(cursor);
          }}
        >
          Load more
        </button>
      )}
    </div>
  );
}
