import { useMemo, useSyncExternalStore, type MouseEvent, type ReactNode } from 'react';
import { parseRoute, routePath, type Route } from '@moneta/core/routes';

// A few history calls cover five routes; a router library would be the only
// dependency here that does less than it weighs.

// pushState fires no event of its own, so navigate() announces itself.
const NAVIGATE_EVENT = 'moneta:navigate';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAVIGATE_EVENT, onChange);
  return function unsubscribe() {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAVIGATE_EVENT, onChange);
  };
}

function currentUrl(): string {
  return window.location.pathname + window.location.search;
}

export function useRoute(): Route {
  const url = useSyncExternalStore(subscribe, currentUrl);
  return useMemo(
    function parse() {
      const parsed = new URL(url, window.location.origin);
      return parseRoute(parsed.pathname, parsed.search);
    },
    [url],
  );
}

// How many in-app pages lie behind this history entry. A back button uses it
// to step back (keeping the archive's scroll position, and matching Android's
// back button) only when the previous page is one of ours.
function historyDepth(): number {
  const state = window.history.state as { depth?: unknown } | null;
  if (typeof state?.depth === 'number') {
    return state.depth;
  }
  return 0;
}

export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const path = routePath(route);
  if (options.replace) {
    window.history.replaceState({ depth: historyDepth() }, '', path);
  } else {
    window.history.pushState({ depth: historyDepth() + 1 }, '', path);
    window.scrollTo(0, 0);
  }
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

// Back to the page the user came from, or to `fallback` when they arrived on
// this one directly (a shared link, a reload, the Android shortcut).
export function goBack(fallback: Route): void {
  if (historyDepth() > 0) {
    window.history.back();
  } else {
    navigate(fallback, { replace: true });
  }
}

// A back button that is still a real link to `fallback`, for a new tab or
// "copy link".
export function BackLink({
  fallback,
  className,
  children,
  'aria-label': ariaLabel,
}: {
  fallback: Route;
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (event.button !== 0 || modified || event.defaultPrevented) {
      return;
    }
    event.preventDefault();
    goBack(fallback);
  }

  return (
    <a
      href={routePath(fallback)}
      className={className}
      aria-label={ariaLabel}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}

interface LinkProps {
  to: Route;
  children: ReactNode;
  className?: string;
  current?: boolean;
  'aria-label'?: string;
}

// A real <a href> so long-press, middle-click and "copy link" keep working; only
// a plain left click is turned into an in-app navigation.
export function Link({ to, children, className, current, ...rest }: LinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (event.button !== 0 || modified || event.defaultPrevented) {
      return;
    }
    event.preventDefault();
    navigate(to);
  }

  let ariaCurrent: 'page' | undefined;
  if (current) {
    ariaCurrent = 'page';
  }

  return (
    <a
      href={routePath(to)}
      className={className}
      aria-current={ariaCurrent}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </a>
  );
}
