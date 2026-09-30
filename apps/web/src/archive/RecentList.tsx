import { useEffect, useMemo, useRef } from 'react';
import { groupByMonth, type ArchiveRow } from '@moneta/core/archive-list';
import type { ArchiveDocument, DocumentSource } from '@moneta/core/document';
import { SourceIcon } from '../icons';
import { Link } from '../router';

interface RecentListProps {
  docs: ArchiveDocument[];
  hasMore: boolean;
  loadingMore: boolean;
  moreError: string | null;
  onLoadMore: () => void;
  selected?: ReadonlySet<string>;
  onSelect?: (id: string) => void;
}

// The device's zone: dates are stored in UTC and converted only here.
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Starts loading the next page this far before the end comes into view, so
// scrolling at a normal pace never reaches a spinner.
const PRELOAD_MARGIN = '1200px';

export function RecentList({
  docs,
  hasMore,
  loadingMore,
  moreError,
  onLoadMore,
  selected,
  onSelect,
}: RecentListProps) {
  const groups = useMemo(
    function group() {
      return groupByMonth(docs, TIME_ZONE);
    },
    [docs],
  );

  return (
    <div className="recent">
      {groups.map(function renderGroup(group) {
        const headingId = `month-${group.key}`;
        return (
          <section key={group.key} className="month" aria-labelledby={headingId}>
            <h2 id={headingId} className="month__title">
              {group.label}
            </h2>
            <ul className="list doc-list">
              {group.rows.map(function renderRow(row) {
                return (
                  <DocumentRow
                    key={row.id}
                    row={row}
                    selected={selected?.has(row.id) ?? false}
                    onSelect={onSelect}
                  />
                );
              })}
            </ul>
          </section>
        );
      })}
      {hasMore && <MoreLoader loading={loadingMore} error={moreError} onLoadMore={onLoadMore} />}
    </div>
  );
}

function DocumentRow({
  row,
  selected,
  onSelect,
}: {
  row: ArchiveRow;
  selected: boolean;
  onSelect?: (id: string) => void;
}) {
  return (
    <li>
      {onSelect && (
        <button
          type="button"
          className="doc-row__select"
          aria-label={`${selected ? 'Deselect' : 'Select'} ${row.title}`}
          aria-pressed={selected}
          onClick={() => onSelect(row.id)}
        >
          {selected ? (
            <span className="doc-row__badge doc-row__badge--selected" aria-hidden="true">
              ✓
            </span>
          ) : (
            <SourceBadge source={row.source} />
          )}
        </button>
      )}
      <Link
        to={{ name: 'document', id: row.id }}
        className={onSelect ? 'doc-row' : 'doc-row doc-row--with-badge'}
      >
        {!onSelect && <SourceBadge source={row.source} />}
        <span className="doc-row__text">
          {/* The amount shares the title's line, so the detail below gets the
              row's full width on a narrow phone. */}
          <span className="doc-row__line">
            <span className="doc-row__title">
              {row.title}
              {row.purchasedItem !== null && (
                <span className="doc-row__item"> · {row.purchasedItem}</span>
              )}
            </span>
            {row.amount !== null && <span className="doc-row__amount">{row.amount}</span>}
          </span>
          <span className="doc-row__detail">{row.detail}</span>
        </span>
      </Link>
    </li>
  );
}

// The row's detail line names the source in words; the badge repeats it for
// scanning, so it is hidden from screen readers.
function SourceBadge({ source }: { source: DocumentSource }) {
  return (
    <span className="doc-row__badge" aria-hidden="true">
      <SourceIcon source={source} size={18} strokeWidth={1.9} />
    </span>
  );
}

function MoreLoader({
  loading,
  error,
  onLoadMore,
}: {
  loading: boolean;
  error: string | null;
  onLoadMore: () => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(
    function watchEnd() {
      const element = sentinel.current;
      if (element === null || error !== null) {
        return;
      }
      const observer = new IntersectionObserver(
        function onIntersect(entries) {
          const visible = entries.some(function isVisible(entry) {
            return entry.isIntersecting;
          });
          if (visible) {
            onLoadMore();
          }
        },
        { rootMargin: PRELOAD_MARGIN },
      );
      observer.observe(element);
      return function stopWatching() {
        observer.disconnect();
      };
    },
    [error, onLoadMore],
  );

  if (error !== null) {
    return (
      <div className="list-end" role="alert">
        <p className="note">{error}</p>
        <button type="button" className="button" onClick={onLoadMore}>
          Try again
        </button>
      </div>
    );
  }
  return (
    <div ref={sentinel} className="list-end" aria-live="polite">
      {loading && <p className="note">Loading older documents…</p>}
    </div>
  );
}
