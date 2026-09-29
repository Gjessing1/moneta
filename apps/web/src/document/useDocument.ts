import { useCallback, useEffect, useState } from 'react';
import type { DocumentDetail } from '@moneta/core/document';
import { ApiError, describeError, fetchDocument } from '../api';

export type DocumentState =
  | { status: 'loading' }
  | { status: 'ready'; detail: DocumentDetail }
  | { status: 'notFound' }
  | { status: 'error'; error: string };

export function useDocument(id: string): DocumentState & { retry: () => void } {
  const [state, setState] = useState<DocumentState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(
    function load() {
      let cancelled = false;
      fetchDocument(id)
        .then(function show(detail) {
          if (!cancelled) {
            setState({ status: 'ready', detail });
          }
        })
        .catch(function fail(err: unknown) {
          if (cancelled) {
            return;
          }
          if (err instanceof ApiError && err.status === 404) {
            setState({ status: 'notFound' });
          } else {
            setState({ status: 'error', error: describeError(err) });
          }
        });
      return function cancel() {
        cancelled = true;
      };
    },
    [id, attempt],
  );

  const retry = useCallback(function retry() {
    setState({ status: 'loading' });
    setAttempt(function next(n) {
      return n + 1;
    });
  }, []);

  return { ...state, retry };
}
