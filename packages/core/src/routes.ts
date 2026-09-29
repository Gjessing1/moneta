// The web app's URLs. Deep links, the Android shell's shortcuts and the share
// target all open these paths, so they are part of the app's contract (A10):
// rename one only together with every native entry point that opens it.

// The archive's ways of arranging documents. Recent is the timeline; the others
// exist because a timeline can't find a purchase from two years ago.
export const ARCHIVE_VIEWS = ['recent', 'shops', 'tags', 'warranty'] as const;
export type ArchiveView = (typeof ARCHIVE_VIEWS)[number];

export type Route =
  | { name: 'archive'; view: ArchiveView }
  | { name: 'search'; query: string }
  | { name: 'capture' }
  | { name: 'settings' }
  | { name: 'document'; id: string }
  // The document's original full screen, for pinch zoom. A route of its own so
  // the back button (the browser's, and Android's through history) closes it.
  | { name: 'original'; id: string }
  | { name: 'notFound'; path: string };

// Top-level destinations, in navigation order.
export type Section = 'archive' | 'capture' | 'settings';

const ARCHIVE_VIEW_PATHS: Record<ArchiveView, string> = {
  recent: '/',
  shops: '/shops',
  tags: '/tags',
  warranty: '/warranty',
};

export function parseRoute(pathname: string, search: string): Route {
  const path = normalizePath(pathname);

  for (const view of ARCHIVE_VIEWS) {
    if (ARCHIVE_VIEW_PATHS[view] === path) {
      return { name: 'archive', view };
    }
  }
  if (path === '/search') {
    return { name: 'search', query: readQueryParam(search, 'q') };
  }
  if (path === '/capture') {
    return { name: 'capture' };
  }
  if (path === '/settings') {
    return { name: 'settings' };
  }

  const documentMatch = /^\/d\/([^/]+)(\/original)?$/.exec(path);
  if (documentMatch?.[1]) {
    const id = decodeURIComponent(documentMatch[1]);
    if (documentMatch[2] !== undefined) {
      return { name: 'original', id };
    }
    return { name: 'document', id };
  }
  return { name: 'notFound', path };
}

export function routePath(route: Route): string {
  switch (route.name) {
    case 'archive':
      return ARCHIVE_VIEW_PATHS[route.view];
    case 'search':
      if (route.query === '') {
        return '/search';
      }
      return `/search?q=${encodeURIComponent(route.query)}`;
    case 'capture':
      return '/capture';
    case 'settings':
      return '/settings';
    case 'document':
      return `/d/${encodeURIComponent(route.id)}`;
    case 'original':
      return `/d/${encodeURIComponent(route.id)}/original`;
    case 'notFound':
      return route.path;
  }
}

// Which navigation entry is highlighted. Search and a single document belong to
// the archive: they are ways into it, not places of their own.
export function sectionOf(route: Route): Section | null {
  switch (route.name) {
    case 'archive':
    case 'search':
    case 'document':
    case 'original':
      return 'archive';
    case 'capture':
      return 'capture';
    case 'settings':
      return 'settings';
    case 'notFound':
      return null;
  }
}

// Trailing slashes and doubled slashes come from hand-typed or shared links;
// treat them as the same page rather than a 404.
function normalizePath(pathname: string): string {
  const collapsed = pathname.replace(/\/{2,}/g, '/');
  if (collapsed.length > 1 && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1);
  }
  if (collapsed === '') {
    return '/';
  }
  return collapsed;
}

// core has no DOM or Node typings, so no URLSearchParams. Form-encoded "+" is
// a space, as browsers write it when a search form is submitted.
function readQueryParam(search: string, name: string): string {
  const pairs = search.replace(/^\?/, '').split('&');
  for (const pair of pairs) {
    const separator = pair.indexOf('=');
    let key = pair;
    let value = '';
    if (separator !== -1) {
      key = pair.slice(0, separator);
      value = pair.slice(separator + 1);
    }
    if (decodeQueryPart(key) === name) {
      return decodeQueryPart(value);
    }
  }
  return '';
}

function decodeQueryPart(part: string): string {
  try {
    return decodeURIComponent(part.replace(/\+/g, ' '));
  } catch {
    // A malformed escape (a hand-edited link) is kept as typed.
    return part;
  }
}
