import { useEffect, useState } from 'react';
import type { ArchiveView } from '@moneta/core/routes';
import { deleteDocument, fetchArchiveFacets, describeError, type ArchiveFacet } from '../api';
import { EmptyState } from '../frame/EmptyState';
import { SearchIcon } from '../icons';
import { Link } from '../router';
import { RecentList } from './RecentList';
import { useArchiveList } from './useArchiveList';
import { ViewTabs } from './ViewTabs';

export function ArchiveScreen({
  view,
  filter,
  onDeleted,
}: {
  view: ArchiveView;
  filter?: string;
  onDeleted: (ids: string[], label: string) => void;
}) {
  const list = useArchiveList(view, filter);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function toggleSelected(id: string) {
    setSelected(function toggle(previous) {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    const ids = [...selected];
    if (
      ids.length === 0 ||
      !window.confirm(
        `Move ${ids.length} document${ids.length === 1 ? '' : 's'} to Recently deleted?`,
      )
    )
      return;
    setDeleting(true);
    setDeleteError(null);
    const deleted: string[] = [];
    try {
      for (const id of ids) {
        await deleteDocument(id);
        deleted.push(id);
      }
      setSelected(new Set());
      setSelecting(false);
    } catch (error) {
      setDeleteError(describeError(error));
      setSelected(
        new Set(
          ids.filter(function remaining(id) {
            return !deleted.includes(id);
          }),
        ),
      );
    } finally {
      if (deleted.length > 0)
        onDeleted(deleted, `${deleted.length} document${deleted.length === 1 ? '' : 's'} deleted`);
      setDeleting(false);
    }
  }
  const [facets, setFacets] = useState<{ shops: ArchiveFacet[]; tags: ArchiveFacet[] } | null>(
    null,
  );
  const [facetsError, setFacetsError] = useState<string | null>(null);
  const [facetsAttempt, setFacetsAttempt] = useState(0);

  useEffect(function refreshFacetsAfterChange() {
    function refresh() {
      setFacets(null);
      setFacetsAttempt(function next(n) {
        return n + 1;
      });
    }
    window.addEventListener('moneta:documents-changed', refresh);
    return function stop() {
      window.removeEventListener('moneta:documents-changed', refresh);
    };
  }, []);

  useEffect(
    function loadFacets() {
      if ((view !== 'shops' && view !== 'tags') || filter) return;
      let cancelled = false;
      fetchArchiveFacets()
        .then(function loaded(result) {
          if (!cancelled) setFacets(result);
        })
        .catch(function failed(error: unknown) {
          if (!cancelled) setFacetsError(describeError(error));
        });
      return function cancel() {
        cancelled = true;
      };
    },
    [view, filter, facetsAttempt],
  );

  let content;
  if ((view === 'shops' || view === 'tags') && !filter) {
    if (facetsError !== null) {
      content = (
        <EmptyState
          title="Could not load the list"
          action={
            <button
              type="button"
              className="button"
              onClick={function retry() {
                setFacetsError(null);
                setFacetsAttempt(facetsAttempt + 1);
              }}
            >
              Try again
            </button>
          }
        >
          {facetsError}
        </EmptyState>
      );
    } else if (facets === null) {
      content = <p className="note list-status">Loading…</p>;
    } else {
      const entries = facets[view];
      content =
        entries.length === 0 ? (
          <ArchiveEmpty view={view} />
        ) : (
          <FacetList view={view} entries={entries} />
        );
    }
  } else if (list.status === 'loading') {
    content = <p className="note list-status">Loading the archive…</p>;
  } else if (list.status === 'error') {
    content = (
      <EmptyState
        title="The archive could not be loaded"
        action={
          <button type="button" className="button" onClick={list.retry}>
            Try again
          </button>
        }
      >
        {list.error}
      </EmptyState>
    );
  } else if (list.items.length === 0) {
    content = <ArchiveEmpty view={view} filter={filter} />;
  } else {
    content = (
      <RecentList
        docs={list.items}
        hasMore={list.nextCursor !== null}
        loadingMore={list.loadingMore}
        moreError={list.moreError}
        onLoadMore={list.loadMore}
        selecting={selecting}
        selected={selected}
        onSelect={toggleSelected}
      />
    );
  }

  return (
    <div className="screen">
      <header className="screen-header screen-header--archive">
        <h1 className="screen-title">Archive</h1>
        <Link to={{ name: 'search', query: '' }} className="search-dock search-dock--link">
          <SearchIcon size={20} strokeWidth={1.9} />
          <span className="search-dock__placeholder">Search shops, items, notes</span>
        </Link>
      </header>
      <ViewTabs view={view} />
      {list.status === 'ready' &&
        list.items.length > 0 &&
        ((view !== 'shops' && view !== 'tags') || filter) && (
          <div className="archive-selection">
            {selecting ? (
              <>
                <span>{selected.size} selected</span>
                <button
                  type="button"
                  className="button"
                  disabled={selected.size === 0 || deleting}
                  onClick={deleteSelected}
                >
                  Delete selected
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={function cancel() {
                    setSelecting(false);
                    setSelected(new Set());
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="text-button"
                onClick={function start() {
                  setSelecting(true);
                }}
              >
                Select documents
              </button>
            )}
          </div>
        )}
      {deleteError !== null && (
        <p role="alert" className="document-edit__error">
          {deleteError}
        </p>
      )}
      {filter && (view === 'shops' || view === 'tags') && (
        <h2 className="archive-filter-title">{filter}</h2>
      )}
      {content}
    </div>
  );
}

function FacetList({ view, entries }: { view: 'shops' | 'tags'; entries: ArchiveFacet[] }) {
  return (
    <ul className="list facet-list">
      {entries.map(function render(entry) {
        return (
          <li key={entry.name}>
            <Link to={{ name: 'archive', view, filter: entry.name }} className="facet-row">
              <span>{entry.name}</span>
              <span className="num">{entry.count}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ArchiveEmpty({ view, filter }: { view: ArchiveView; filter?: string }) {
  switch (view) {
    case 'recent':
      return (
        <EmptyState
          title="Nothing filed yet"
          action={
            <Link to={{ name: 'capture' }} className="button button--primary">
              Photograph a receipt
            </Link>
          }
        >
          Receipts you photograph and invoices maily finds in your mail show up here, newest first.
        </EmptyState>
      );
    case 'shops':
      return (
        <EmptyState title={filter ? 'No documents from this shop' : 'No shops yet'}>
          Add a shop or sender to a document to find it here.
        </EmptyState>
      );
    case 'tags':
      return (
        <EmptyState title={filter ? 'No documents with this tag' : 'No tags yet'}>
          Add tags while editing a document to find related purchases together.
        </EmptyState>
      );
    case 'starred':
      return (
        <EmptyState title="Nothing starred yet">
          Star a document to keep it close at hand.
        </EmptyState>
      );
    case 'bills':
      return (
        <EmptyState title="No bills without an attachment">
          Invoices found in mail without a document attachment appear here once imported from maily.
        </EmptyState>
      );
  }
}
