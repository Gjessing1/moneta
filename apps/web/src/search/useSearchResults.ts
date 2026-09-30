import { useCallback, useEffect, useState } from 'react';
import type { ArchiveDocument } from '@moneta/core/document';
import { describeError, fetchDocumentPage } from '../api';

interface SearchState {
  query: string;
  items: ArchiveDocument[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

export function useSearchResults(query: string) {
  const [state, setState] = useState<SearchState>({
    query: '',
    items: [],
    nextCursor: null,
    loading: false,
    loadingMore: false,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  const text = query.trim();

  useEffect(
    function search() {
      if (text === '') {
        return;
      }
      let cancelled = false;
      setState({
        query: text,
        items: [],
        nextCursor: null,
        loading: true,
        loadingMore: false,
        error: null,
      });
      const timer = window.setTimeout(function load() {
        fetchDocumentPage(null, text)
          .then(function show(page) {
            if (!cancelled) {
              setState({
                query: text,
                items: page.items,
                nextCursor: page.nextCursor,
                loading: false,
                loadingMore: false,
                error: null,
              });
            }
          })
          .catch(function fail(err: unknown) {
            if (!cancelled) {
              setState({
                query: text,
                items: [],
                nextCursor: null,
                loading: false,
                loadingMore: false,
                error: describeError(err),
              });
            }
          });
      }, 200);
      return function cancel() {
        cancelled = true;
        window.clearTimeout(timer);
      };
    },
    [text, attempt],
  );

  const loadMore = useCallback(
    function loadMore() {
      if (text === '' || state.nextCursor === null || state.loadingMore) {
        return;
      }
      const cursor = state.nextCursor;
      setState(function mark(previous) {
        return { ...previous, loadingMore: true, error: null };
      });
      fetchDocumentPage(cursor, text)
        .then(function append(page) {
          setState(function add(previous) {
            if (previous.query !== text) {
              return previous;
            }
            return {
              ...previous,
              items: [...previous.items, ...page.items],
              nextCursor: page.nextCursor,
              loadingMore: false,
            };
          });
        })
        .catch(function fail(err: unknown) {
          setState(function show(previous) {
            return previous.query === text
              ? { ...previous, loadingMore: false, error: describeError(err) }
              : previous;
          });
        });
    },
    [text, state.nextCursor, state.loadingMore],
  );

  const retry = useCallback(function retry() {
    setAttempt(function next(previous) {
      return previous + 1;
    });
  }, []);

  return {
    ...state,
    loading: state.loading || (text !== '' && state.query !== text),
    loadMore,
    retry,
  };
}
