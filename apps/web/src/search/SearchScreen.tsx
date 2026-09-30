import { useState, type ChangeEvent, type FormEvent } from 'react';
import { RecentList } from '../archive/RecentList';
import { EmptyState } from '../frame/EmptyState';
import { ClearIcon, SearchIcon } from '../icons';
import { Link, navigate } from '../router';
import { useSearchResults } from './useSearchResults';

export function SearchScreen({ query }: { query: string }) {
  // Local state keeps typing smooth; the URL follows so a search can be
  // reloaded, shared and reached with the back button.
  const [text, setText] = useState(query);
  const search = useSearchResults(text);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setText(event.target.value);
    navigate({ name: 'search', query: event.target.value }, { replace: true });
  }

  function handleClear() {
    setText('');
    navigate({ name: 'search', query: '' }, { replace: true });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Hides the phone keyboard so the results are visible.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  const trimmed = text.trim();
  let results;
  if (trimmed === '') {
    results = (
      <EmptyState title="Find anything you have filed">
        Search shop names, what you bought, and notes.
      </EmptyState>
    );
  } else if (search.loading) {
    results = (
      <p className="note" role="status">
        Searching…
      </p>
    );
  } else if (search.error !== null && search.items.length === 0) {
    results = (
      <EmptyState
        title="Search could not be loaded"
        action={
          <button type="button" className="button" onClick={search.retry}>
            Try again
          </button>
        }
      >
        {search.error}
      </EmptyState>
    );
  } else if (search.items.length > 0) {
    results = (
      <RecentList
        docs={search.items}
        hasMore={search.nextCursor !== null}
        loadingMore={search.loadingMore}
        moreError={search.error}
        onLoadMore={search.loadMore}
      />
    );
  } else {
    results = (
      <EmptyState title="No matches">
        Nothing in the archive matches “{trimmed}”. Try a shop name, what you bought, or a note.
      </EmptyState>
    );
  }

  return (
    <div className="screen screen--search">
      <header className="screen-header">
        <h1 className="screen-title">Search</h1>
      </header>
      {results}
      <form role="search" className="search-dock search-dock--form" onSubmit={handleSubmit}>
        <label className="search-field">
          <SearchIcon size={20} strokeWidth={1.9} />
          <input
            type="search"
            className="search-field__input"
            aria-label="Search the archive"
            placeholder="Search"
            maxLength={200}
            enterKeyHint="search"
            autoFocus
            value={text}
            onChange={handleChange}
          />
          {text !== '' && (
            <button
              type="button"
              className="icon-button"
              aria-label="Clear the search"
              onClick={handleClear}
            >
              <ClearIcon size={18} strokeWidth={2} />
            </button>
          )}
        </label>
        <Link to={{ name: 'archive', view: 'recent' }} className="text-button">
          Cancel
        </Link>
      </form>
    </div>
  );
}
