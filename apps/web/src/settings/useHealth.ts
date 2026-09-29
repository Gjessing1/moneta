import { useEffect, useState } from 'react';
import { describeVersion, type HealthReport } from '@moneta/core';

// The running version, as /api/health reports it (A5), ready to show.
export function useHealth(): string {
  const [text, setText] = useState('Checking…');

  useEffect(function loadHealth() {
    let cancelled = false;
    fetch('/api/health')
      .then(function readBody(res) {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json() as Promise<HealthReport>;
      })
      .then(function show(report) {
        if (!cancelled) {
          setText(describeVersion(report));
        }
      })
      .catch(function showError(err: unknown) {
        if (!cancelled) {
          setText(`Server unreachable (${String(err)})`);
        }
      });
    return function cancel() {
      cancelled = true;
    };
  }, []);

  return text;
}
