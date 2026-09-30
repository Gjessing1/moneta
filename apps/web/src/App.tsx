import { useEffect, useState } from 'react';
import { sectionOf, type Route } from '@moneta/core/routes';
import type { ThemePreference } from '@moneta/core/theme';
import { ArchiveScreen } from './archive/ArchiveScreen';
import { CaptureScreen } from './capture/CaptureScreen';
import { DocumentScreen } from './document/DocumentScreen';
import { AppNav } from './frame/AppNav';
import { EmptyState } from './frame/EmptyState';
import { Link, useRoute } from './router';
import { SearchScreen } from './search/SearchScreen';
import { SettingsScreen } from './settings/SettingsScreen';
import { RecentlyDeletedScreen } from './settings/RecentlyDeletedScreen';
import { useThemePreference } from './theme';
import { restoreDocument, describeError } from './api';
import { archiveChanged } from './archive/useArchiveList';

export function App() {
  const route = useRoute();
  const [themePreference, setThemePreference] = useThemePreference();
  const [undo, setUndo] = useState<{ ids: string[]; label: string } | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);

  useEffect(
    function expireUndo() {
      if (undo === null || undoError !== null) return;
      const timer = window.setTimeout(function clear() {
        setUndo(null);
      }, 10000);
      return function stop() {
        window.clearTimeout(timer);
      };
    },
    [undo, undoError],
  );

  function deleted(ids: string[], label: string) {
    archiveChanged();
    setUndo({ ids, label });
    setUndoError(null);
  }

  async function restore() {
    if (undo === null) return;
    try {
      for (const id of undo.ids) await restoreDocument(id);
      setUndo(null);
      archiveChanged();
    } catch (error) {
      setUndoError(describeError(error));
    }
  }

  useEffect(
    function updateTitle() {
      document.title = `${titleOf(route)} – Moneta`;
    },
    [route],
  );

  // Search gives the phone's bottom edge to the search field and keyboard, and
  // a document gives it to its download bar, so the bottom bar steps aside
  // there (frame.css).
  let frameClass = 'frame';
  if (route.name === 'search') {
    frameClass = 'frame frame--search';
  } else if (route.name === 'document' || route.name === 'original') {
    frameClass = 'frame frame--detail';
  }

  return (
    <div className={frameClass}>
      <AppNav section={sectionOf(route)} />
      <main className="frame__main">
        {renderScreen(route, themePreference, setThemePreference, deleted)}
      </main>
      {undo !== null && (
        <div className="undo-bar" role="status">
          <span>{undo.label}</span>
          <button type="button" className="text-button" onClick={restore}>
            Undo
          </button>
          {undoError !== null && <span role="alert">{undoError}</span>}
        </div>
      )}
    </div>
  );
}

function renderScreen(
  route: Route,
  themePreference: ThemePreference,
  setThemePreference: (preference: ThemePreference) => void,
  onDeleted: (ids: string[], label: string) => void,
) {
  switch (route.name) {
    case 'archive':
      return (
        <ArchiveScreen
          key={`${route.view}:${route.filter ?? ''}:${JSON.stringify(route.browse ?? {})}`}
          view={route.view}
          filter={route.filter}
          browse={route.browse}
          onDeleted={onDeleted}
        />
      );
    case 'search':
      return <SearchScreen query={route.query} />;
    case 'capture':
      return <CaptureScreen />;
    case 'settings':
      return (
        <SettingsScreen themePreference={themePreference} onThemeChange={setThemePreference} />
      );
    case 'recentlyDeleted':
      return <RecentlyDeletedScreen />;
    case 'document':
    case 'original':
      // One screen for both, keyed on the id, so opening the full-screen view
      // keeps what is loaded and drawn.
      return (
        <DocumentScreen
          key={route.id}
          id={route.id}
          viewer={route.name === 'original'}
          onDeleted={onDeleted}
        />
      );
    case 'notFound':
      return (
        <div className="screen">
          <EmptyState
            title="Page not found"
            action={
              <Link to={{ name: 'archive', view: 'recent' }} className="button">
                Go to the archive
              </Link>
            }
          >
            There is nothing at {route.path}.
          </EmptyState>
        </div>
      );
  }
}

function titleOf(route: Route): string {
  switch (route.name) {
    case 'archive':
      return 'Archive';
    case 'search':
      return 'Search';
    case 'capture':
      return 'Capture';
    case 'settings':
      return 'Settings';
    case 'recentlyDeleted':
      return 'Recently deleted';
    case 'document':
      return 'Document';
    case 'original':
      return 'Original';
    case 'notFound':
      return 'Not found';
  }
}
