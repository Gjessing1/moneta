// The web app's URLs. Deep links, the Android shell's shortcuts and the share
// target all open these paths, so they are part of the app's contract (A10):
// rename one only together with every native entry point that opens it.

// The archive's ways of arranging documents. Recent is the timeline; the others
// exist because a timeline can't find a purchase from two years ago.
import {
  isCalendarDate,
  isDocumentKind,
  isDocumentSource,
  type DocumentKind,
  type DocumentSource,
} from './document.js';

export const ARCHIVE_VIEWS = ['recent', 'shops', 'tags', 'starred', 'bills'] as const;
export type ArchiveView = (typeof ARCHIVE_VIEWS)[number];

export interface RecentBrowse {
  sort?: 'oldest';
  kind?: DocumentKind;
  source?: DocumentSource;
  shop?: string;
  from?: string;
  to?: string;
}

export type Route =
  | { name: 'archive'; view: ArchiveView; filter?: string; browse?: RecentBrowse }
  | { name: 'search'; query: string }
  | { name: 'capture' }
  | { name: 'settings' }
  | { name: 'recentlyDeleted' }
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
  starred: '/starred',
  bills: '/bills',
};

export function parseRoute(pathname: string, search: string): Route {
  const path = normalizePath(pathname);

  if (path === '/warranty') return { name: 'archive', view: 'starred' };

  for (const view of ARCHIVE_VIEWS) {
    if (ARCHIVE_VIEW_PATHS[view] === path) {
      if (view === 'recent') {
        const browse: RecentBrowse = {};
        if (readQueryParam(search, 'sort') === 'oldest') browse.sort = 'oldest';
        const kind = readQueryParam(search, 'kind');
        if (isDocumentKind(kind)) browse.kind = kind;
        const source = readQueryParam(search, 'source');
        if (isDocumentSource(source)) browse.source = source;
        const shop = readQueryParam(search, 'shop').trim();
        if (shop.length > 0 && shop.length <= 500) browse.shop = shop;
        const from = readQueryParam(search, 'from');
        if (isCalendarDate(from)) browse.from = from;
        const to = readQueryParam(search, 'to');
        if (isCalendarDate(to)) browse.to = to;
        if (browse.from && browse.to && browse.from > browse.to) delete browse.from;
        if (Object.keys(browse).length > 0) return { name: 'archive', view, browse };
      }
      if (view === 'shops' || view === 'tags') {
        const filter = readQueryParam(search, view === 'shops' ? 'shop' : 'tag');
        if (filter !== '') return { name: 'archive', view, filter };
      }
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
  if (path === '/settings/deleted') {
    return { name: 'recentlyDeleted' };
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
      if (route.view === 'recent' && route.browse) {
        const params: string[] = [];
        for (const key of ['sort', 'kind', 'source', 'shop', 'from', 'to'] as const) {
          const value = route.browse[key];
          if (value) params.push(`${key}=${encodeURIComponent(value)}`);
        }
        return params.length > 0 ? `/?${params.join('&')}` : '/';
      }
      if (route.filter && (route.view === 'shops' || route.view === 'tags')) {
        return `${ARCHIVE_VIEW_PATHS[route.view]}?${route.view === 'shops' ? 'shop' : 'tag'}=${encodeURIComponent(route.filter)}`;
      }
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
    case 'recentlyDeleted':
      return '/settings/deleted';
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
    case 'recentlyDeleted':
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
