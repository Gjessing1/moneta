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

export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const path = routePath(route);
  if (options.replace) {
    window.history.replaceState(null, '', path);
  } else {
    window.history.pushState(null, '', path);
    window.scrollTo(0, 0);
  }
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
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
