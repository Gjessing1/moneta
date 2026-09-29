import { useEffect, useState } from 'react';
import type { DocumentFact } from '@moneta/core/document-view';
import { CheckIcon, CopyIcon } from '../icons';

// How long the tick stays after a copy.
const COPIED_MS = 2000;

export function DocumentFacts({ facts }: { facts: DocumentFact[] }) {
  return (
    <dl className="list facts">
      {facts.map(function renderFact(fact) {
        let valueClass = 'facts__value';
        if (fact.strong) {
          valueClass = 'facts__value facts__value--strong';
        }
        return (
          <div key={fact.label} className="facts__row">
            <dt className="facts__label">{fact.label}</dt>
            <dd className={valueClass}>{fact.value}</dd>
            {fact.copy !== null && <CopyButton value={fact.copy} label={fact.label} />}
          </div>
        );
      })}
    </dl>
  );
}

// KID and account numbers are copied into the bank app; typing 13 digits off a
// screen is where payments go wrong.
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(
    function resetLater() {
      if (!copied) {
        return;
      }
      const timer = window.setTimeout(function reset() {
        setCopied(false);
      }, COPIED_MS);
      return function cancel() {
        window.clearTimeout(timer);
      };
    },
    [copied],
  );

  // Only secure origins get the clipboard; plain-http dev on a LAN address
  // has none, and a button that does nothing is worse than no button.
  if (typeof navigator.clipboard?.writeText !== 'function') {
    return null;
  }

  function copy() {
    navigator.clipboard
      .writeText(value)
      .then(function done() {
        setCopied(true);
      })
      .catch(function failed(err: unknown) {
        console.error('copy failed', err);
      });
  }

  return (
    <>
      <button
        type="button"
        className="icon-button facts__copy"
        aria-label={`Copy ${label}`}
        onClick={copy}
      >
        {copied ? (
          <CheckIcon size={18} strokeWidth={2.2} />
        ) : (
          <CopyIcon size={18} strokeWidth={1.9} />
        )}
      </button>
      <span className="visually-hidden" aria-live="polite">
        {copied ? `${label} copied` : ''}
      </span>
    </>
  );
}
