import type { ArchiveView } from '@moneta/core/routes';
import { EmptyState } from '../frame/EmptyState';
import { SearchIcon } from '../icons';
import { Link } from '../router';
import { ViewTabs } from './ViewTabs';

export function ArchiveScreen({ view }: { view: ArchiveView }) {
  return (
    <div className="screen">
      <header className="screen-header screen-header--archive">
        <h1 className="screen-title">Archive</h1>
        <Link to={{ name: 'search', query: '' }} className="search-dock search-dock--link">
          <SearchIcon size={20} strokeWidth={1.9} />
          <span className="search-dock__placeholder">Search shops, items, amounts, text</span>
        </Link>
      </header>
      <ViewTabs view={view} />
      <ArchiveEmpty view={view} />
    </div>
  );
}

function ArchiveEmpty({ view }: { view: ArchiveView }) {
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
        <EmptyState title="No shops yet">
          Every shop and sender you have documents from, the ones you use most at the top.
        </EmptyState>
      );
    case 'tags':
      return (
        <EmptyState title="No tags yet">
          Tag documents with words like bolig, bil or jobb to find them together later.
        </EmptyState>
      );
    case 'warranty':
      return (
        <EmptyState title="Nothing under warranty">
          Mark a purchase as a warranty item and it stays here, by what you bought, until the
          warranty ends.
        </EmptyState>
      );
  }
}
