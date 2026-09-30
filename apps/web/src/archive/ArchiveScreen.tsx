import { useEffect, useState } from 'react';
import type { ArchiveView } from '@moneta/core/routes';
import { fetchArchiveFacets, describeError, type ArchiveFacet } from '../api';
import { EmptyState } from '../frame/EmptyState';
import { SearchIcon } from '../icons';
import { Link } from '../router';
import { RecentList } from './RecentList';
import { useArchiveList } from './useArchiveList';
import { ViewTabs } from './ViewTabs';

export function ArchiveScreen({ view, filter }: { view: ArchiveView; filter?: string }) {
  const list = useArchiveList(view, filter);
  const [facets, setFacets] = useState<{ shops: ArchiveFacet[]; tags: ArchiveFacet[] } | null>(
    null,
  );
  const [facetsError, setFacetsError] = useState<string | null>(null);
  const [facetsAttempt, setFacetsAttempt] = useState(0);

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
