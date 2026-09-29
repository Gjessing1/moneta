import { useEffect, useState } from 'react';
import { describeVersion, type HealthReport } from '@moneta/core';

export function App() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [error, setError] = useState('');

  useEffect(function loadHealth() {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json() as Promise<HealthReport>;
      })
      .then(setHealth)
      .catch((err: unknown) => setError(String(err)));
  }, []);

  let status = 'Connecting…';
  if (error !== '') {
    status = `Backend unreachable: ${error}`;
  } else if (health) {
    status = describeVersion(health);
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>Moneta</h1>
      <p>{status}</p>
    </main>
  );
}
