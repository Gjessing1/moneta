import { describe, expect, it } from 'vitest';
import { parseRoute, routePath, sectionOf, type Route } from './routes.js';

describe('parseRoute', () => {
  it('maps each archive view to its path', () => {
    expect(parseRoute('/', '')).toEqual({ name: 'archive', view: 'recent' });
    expect(parseRoute('/shops', '')).toEqual({ name: 'archive', view: 'shops' });
    expect(parseRoute('/tags', '')).toEqual({ name: 'archive', view: 'tags' });
    expect(parseRoute('/starred', '')).toEqual({ name: 'archive', view: 'starred' });
    expect(parseRoute('/bills', '')).toEqual({ name: 'archive', view: 'bills' });
    expect(parseRoute('/warranty', '')).toEqual({ name: 'archive', view: 'starred' });
    expect(parseRoute('/shops', '?shop=Kiwi')).toEqual({
      name: 'archive',
      view: 'shops',
      filter: 'Kiwi',
    });
  });

  it('reads the search query', () => {
    expect(parseRoute('/search', '?q=oppvaskmaskin')).toEqual({
      name: 'search',
      query: 'oppvaskmaskin',
    });
    expect(parseRoute('/search', '')).toEqual({ name: 'search', query: '' });
    expect(parseRoute('/search', '?x=1&q=rema+1000')).toEqual({
      name: 'search',
      query: 'rema 1000',
    });
    expect(parseRoute('/search', '?q=100%')).toEqual({ name: 'search', query: '100%' });
  });

  it('opens a document by id', () => {
    expect(parseRoute('/d/4f1c2b', '')).toEqual({ name: 'document', id: '4f1c2b' });
    expect(parseRoute('/d/4f1c2b/original', '')).toEqual({ name: 'original', id: '4f1c2b' });
    expect(parseRoute('/d/4f1c2b/other', '')).toEqual({
      name: 'notFound',
      path: '/d/4f1c2b/other',
    });
  });

  it('forgives trailing and doubled slashes', () => {
    expect(parseRoute('/capture/', '')).toEqual({ name: 'capture' });
    expect(parseRoute('//settings', '')).toEqual({ name: 'settings' });
  });

  it('reports anything else as not found', () => {
    expect(parseRoute('/d/', '')).toEqual({ name: 'notFound', path: '/d' });
    expect(parseRoute('/nope', '')).toEqual({ name: 'notFound', path: '/nope' });
  });
});

describe('routePath', () => {
  it('round-trips through parseRoute', () => {
    const routes: Route[] = [
      { name: 'archive', view: 'recent' },
      { name: 'archive', view: 'starred' },
      { name: 'archive', view: 'tags', filter: 'jobb' },
      { name: 'search', query: '' },
      { name: 'search', query: 'rema 1000 & kiwi' },
      { name: 'capture' },
      { name: 'settings' },
      { name: 'document', id: 'a/b c' },
      { name: 'original', id: 'a/b c' },
    ];
    for (const route of routes) {
      const url = new URL(routePath(route), 'https://moneta.test');
      expect(parseRoute(url.pathname, url.search)).toEqual(route);
    }
  });
});

describe('sectionOf', () => {
  it('keeps search and documents under the archive', () => {
    expect(sectionOf({ name: 'search', query: 'x' })).toBe('archive');
    expect(sectionOf({ name: 'document', id: 'x' })).toBe('archive');
    expect(sectionOf({ name: 'original', id: 'x' })).toBe('archive');
    expect(sectionOf({ name: 'capture' })).toBe('capture');
    expect(sectionOf({ name: 'notFound', path: '/x' })).toBeNull();
  });
});
