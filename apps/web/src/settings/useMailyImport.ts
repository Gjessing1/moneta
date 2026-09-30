import { useEffect, useState } from 'react';
import type { MailyImportStatus } from '@moneta/core/maily-import';

export function useMailyImport(): {
  lastSuccessAt: string | null;
  lastError: string | null;
  loading: boolean;
} {
  const [status, setStatus] = useState<{
    lastSuccessAt: string | null;
    lastError: string | null;
    loading: boolean;
  }>({ lastSuccessAt: null, lastError: null, loading: true });
  useEffect(function loadStatus() {
    let cancelled = false;
    async function refresh() {
      try {
        const response = await fetch('/api/import/maily/status');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = (await response.json()) as MailyImportStatus;
        if (!cancelled) setStatus({ ...result, loading: false });
      } catch {
        if (!cancelled)
          setStatus({ lastSuccessAt: null, lastError: 'Status unavailable', loading: false });
      }
    }
    void refresh();
    const timer = setInterval(function poll() {
      void refresh();
    }, 60_000);
    return function cleanup() {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
  return status;
}
