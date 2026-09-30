import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArchiveDocument } from '@moneta/core/document';
import type { ArchiveView } from '@moneta/core/routes';
import type { DocumentPage } from '@moneta/core/document-list';
import { describeError, fetchDocumentPage } from '../api';

export interface ArchiveListState {
  // 'loading' and 'error' describe the first page; later pages report through
  // loadingMore and moreError, so a failed scroll never hides what is loaded.
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  items: ArchiveDocument[];
  nextCursor: string | null;
  loadingMore: boolean;
  moreError: string | null;
}

// What was loaded last time, kept across screens: opening a document and
// going back shows the list at once, so the browser can restore the scroll
// position, and the first page is re-checked in the background.
let remembered: { items: ArchiveDocument[]; nextCursor: string | null } | null = null;

function initialState(view: ArchiveView): ArchiveListState {
  if (view === 'recent' && remembered !== null) {
    return { ...remembered, status: 'ready', error: null, loadingMore: false, moreError: null };
  }
  return {
    status: 'loading',
    error: null,
    items: [],
    nextCursor: null,
    loadingMore: false,
    moreError: null,
  };
}

// True when a fresh first page starts exactly like what is on screen, so the
// longer list already loaded is still right and can stay.
function startsWith(items: ArchiveDocument[], page: DocumentPage): boolean {
  if (page.nextCursor === null && items.length !== page.items.length) {
    return false;
  }
  return page.items.every(function same(doc, index) {
    const shown = items[index];
    return shown !== undefined && shown.id === doc.id && shown.updatedAt === doc.updatedAt;
  });
}

export function useArchiveList(
  view: ArchiveView,
  filter?: string,
): ArchiveListState & {
  loadMore: () => void;
  retry: () => void;
} {
  const [state, setState] = useState(function initial() {
    return initialState(view);
  });
  const [attempt, setAttempt] = useState(0);
  // Bumped whenever the list is replaced, so a later page that was requested
  // for the old list is dropped instead of appended to the new one.
  const generation = useRef(0);

  useEffect(
    function loadFirstPage() {
      let cancelled = false;
      fetchDocumentPage(null, null, listFilters(view, filter))
        .then(function show(page) {
          if (cancelled) {
            return;
          }
          setState(function merge(previous) {
            if (previous.status === 'ready' && startsWith(previous.items, page)) {
              return previous;
            }
            generation.current += 1;
            return {
              status: 'ready',
              error: null,
              items: page.items,
              nextCursor: page.nextCursor,
              loadingMore: false,
              moreError: null,
            };
          });
        })
        .catch(function fail(err: unknown) {
          if (cancelled) {
            return;
          }
          setState(function keepWhatIsShown(previous) {
            if (previous.status === 'ready') {
              return previous;
            }
            return { ...previous, status: 'error', error: describeError(err) };
          });
        });
      return function cancel() {
        cancelled = true;
      };
    },
    [attempt, view, filter],
  );

  useEffect(
    function remember() {
      if (view === 'recent' && state.status === 'ready') {
        remembered = { items: state.items, nextCursor: state.nextCursor };
      }
    },
    [state, view],
  );

  const { nextCursor, loadingMore } = state;
  const loadMore = useCallback(
    function loadMore() {
      if (nextCursor === null || loadingMore) {
        return;
      }
      const requestedFor = generation.current;
      setState(function markLoading(previous) {
        return { ...previous, loadingMore: true, moreError: null };
      });
      fetchDocumentPage(nextCursor, null, listFilters(view, filter))
        .then(function append(page) {
          if (generation.current !== requestedFor) {
            return;
          }
          setState(function addPage(previous) {
            return {
              ...previous,
              items: [...previous.items, ...page.items],
              nextCursor: page.nextCursor,
              loadingMore: false,
            };
          });
        })
        .catch(function fail(err: unknown) {
          setState(function showError(previous) {
            return { ...previous, loadingMore: false, moreError: describeError(err) };
          });
        });
    },
    [nextCursor, loadingMore, view, filter],
  );

  const retry = useCallback(function retry() {
    setState(function markLoading(previous) {
      if (previous.status === 'error') {
        return { ...previous, status: 'loading', error: null };
      }
      return previous;
    });
    setAttempt(function next(n) {
      return n + 1;
    });
  }, []);

  return { ...state, loadMore, retry };
}

function listFilters(view: ArchiveView, filter?: string) {
  if (view === 'shops' && filter) return { shop: filter };
  if (view === 'tags' && filter) return { tag: filter };
  if (view === 'starred') return { starred: true };
  if (view === 'bills') return { bills: true };
  return {};
}
