import { useEffect, useState } from 'react';
import { DOCUMENT_KINDS, DOCUMENT_SOURCES } from '@moneta/core/document';
import { formatMonth } from '@moneta/core/format';
import type { RecentBrowse } from '@moneta/core/routes';
import { fetchArchiveFacets, fetchArchiveMonths, type ArchiveMonth } from '../api';
import { navigate } from '../router';

const SOURCE_LABELS: Record<string, string> = {
  maily: 'Mail',
  camera: 'Camera',
  upload: 'Manual upload',
  share: 'Share',
};

export function RecentBrowseControls({ browse = {} }: { browse?: RecentBrowse }) {
  const [shops, setShops] = useState<string[]>([]);
  const [months, setMonths] = useState<ArchiveMonth[]>([]);
  const [monthIndex, setMonthIndex] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);

  useEffect(function loadShops() {
    let cancelled = false;
    fetchArchiveFacets()
      .then(function loaded(facets) {
        if (!cancelled) setShops(facets.shops.map((shop) => shop.name));
      })
      .catch(function unavailable() {
        // The list still works when suggestions are unavailable.
      });
    return function cancel() {
      cancelled = true;
    };
  }, []);

  useEffect(
    function loadMonths() {
      let cancelled = false;
      fetchArchiveMonths({ kind: browse.kind, source: browse.source, shop: browse.shop })
        .then(function loaded(result) {
          if (!cancelled) {
            setMonths(result);
            const selected = browse.sort === 'oldest' ? browse.from : browse.to;
            const index = selected
              ? result.findIndex((item) => item.month === selected.slice(0, 7))
              : -1;
            setMonthIndex(index >= 0 ? index : 0);
          }
        })
        .catch(function unavailable() {
          if (!cancelled) setMonths([]);
        });
      return function cancel() {
        cancelled = true;
      };
    },
    [browse.kind, browse.source, browse.shop, browse.from, browse.to, browse.sort],
  );

  useEffect(
    function followScroll() {
      if (months.length < 2) return;
      let frame = 0;
      function update() {
        frame = 0;
        const headings = document.querySelectorAll<HTMLElement>('.month__title');
        let visible: string | null = null;
        for (const heading of headings) {
          if (heading.getBoundingClientRect().top <= 180)
            visible = heading.id.slice('month-'.length);
          else break;
        }
        if (visible !== null) {
          const index = months.findIndex((item) => item.month === visible);
          if (index >= 0) setMonthIndex(index);
        }
      }
      function schedule() {
        if (frame === 0) frame = window.requestAnimationFrame(update);
      }
      window.addEventListener('scroll', schedule, { passive: true });
      return function stop() {
        window.removeEventListener('scroll', schedule);
        if (frame !== 0) window.cancelAnimationFrame(frame);
      };
    },
    [months],
  );

  function change(next: RecentBrowse) {
    const cleaned: RecentBrowse = {};
    if (next.sort) cleaned.sort = next.sort;
    if (next.kind) cleaned.kind = next.kind;
    if (next.source) cleaned.source = next.source;
    if (next.shop) cleaned.shop = next.shop;
    if (next.from) cleaned.from = next.from;
    if (next.to) cleaned.to = next.to;
    navigate({ name: 'archive', view: 'recent', browse: cleaned });
  }

  function jumpToMonth(index: number) {
    const month = months[index];
    if (!month) return;
    setScrubbing(false);
    const heading = document.getElementById(`month-${month.month}`);
    if (heading) {
      heading.scrollIntoView({ block: 'start' });
      return;
    }
    if (browse.sort === 'oldest') {
      change({ ...browse, from: `${month.month}-01`, to: undefined });
    } else {
      const end = new Date(
        Date.UTC(Number(month.month.slice(0, 4)), Number(month.month.slice(5, 7)), 0),
      )
        .toISOString()
        .slice(0, 10);
      change({ ...browse, to: end, from: undefined });
    }
  }

  return (
    <>
      <div className="recent-controls" aria-label="Browse recent documents">
        <label>
          <span>Order</span>
          <select
            value={browse.sort ?? 'newest'}
            onChange={(event) =>
              change({ ...browse, sort: event.target.value === 'oldest' ? 'oldest' : undefined })
            }
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <label>
          <span>Kind</span>
          <select
            value={browse.kind ?? ''}
            onChange={(event) =>
              change({
                ...browse,
                kind: DOCUMENT_KINDS.find((kind) => kind === event.target.value),
              })
            }
          >
            <option value="">All kinds</option>
            {DOCUMENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind.slice(0, 1).toUpperCase() + kind.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Source</span>
          <select
            value={browse.source ?? ''}
            onChange={(event) =>
              change({
                ...browse,
                source: DOCUMENT_SOURCES.find((source) => source === event.target.value),
              })
            }
          >
            <option value="">All sources</option>
            {DOCUMENT_SOURCES.map((source) => (
              <option key={source} value={source}>
                {SOURCE_LABELS[source] ?? source}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Shop</span>
          <select
            value={browse.shop ?? ''}
            onChange={(event) => change({ ...browse, shop: event.target.value || undefined })}
          >
            <option value="">All shops</option>
            {shops.map((shop) => (
              <option key={shop} value={shop}>
                {shop}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{browse.sort === 'oldest' ? 'Jump from' : 'From'}</span>
          <input
            type="date"
            value={browse.from ?? ''}
            max={browse.to}
            onChange={(event) => change({ ...browse, from: event.target.value || undefined })}
          />
        </label>
        <label>
          <span>{browse.sort === 'oldest' ? 'Through' : 'Jump to / through'}</span>
          <input
            type="date"
            value={browse.to ?? ''}
            min={browse.from}
            onChange={(event) => change({ ...browse, to: event.target.value || undefined })}
          />
        </label>
        {Object.keys(browse).length > 0 && (
          <button
            type="button"
            className="text-button"
            onClick={() => navigate({ name: 'archive', view: 'recent' })}
          >
            Clear
          </button>
        )}
      </div>
      {months.length > 1 && (
        <div className="recent-scrubber" aria-label="Timeline months">
          {scrubbing && (
            <span style={{ top: `${10 + (monthIndex / (months.length - 1)) * 80}%` }}>
              {formatMonth(months[monthIndex]?.month ?? months[0]!.month)}
            </span>
          )}
          <input
            aria-label="Jump to month"
            aria-valuetext={formatMonth(months[monthIndex]?.month ?? months[0]!.month)}
            type="range"
            min="0"
            max={months.length - 1}
            value={monthIndex}
            onChange={(event) => setMonthIndex(Number(event.target.value))}
            onFocus={() => setScrubbing(true)}
            onBlur={() => setScrubbing(false)}
            onPointerUp={(event) => jumpToMonth(Number(event.currentTarget.value))}
            onKeyUp={(event) => jumpToMonth(Number(event.currentTarget.value))}
          />
        </div>
      )}
    </>
  );
}
