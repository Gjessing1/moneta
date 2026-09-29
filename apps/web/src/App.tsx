import { useEffect } from 'react';
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
import { useThemePreference } from './theme';

export function App() {
  const route = useRoute();
  const [themePreference, setThemePreference] = useThemePreference();

  useEffect(
    function updateTitle() {
      document.title = `${titleOf(route)} – Moneta`;
    },
    [route],
  );

  // Search gives the phone's bottom edge to the search field and keyboard, so
  // the bottom bar steps aside there (frame.css).
  let frameClass = 'frame';
  if (route.name === 'search') {
    frameClass = 'frame frame--search';
  }

  return (
    <div className={frameClass}>
      <AppNav section={sectionOf(route)} />
      <main className="frame__main">
        {renderScreen(route, themePreference, setThemePreference)}
      </main>
    </div>
  );
}

function renderScreen(
  route: Route,
  themePreference: ThemePreference,
  setThemePreference: (preference: ThemePreference) => void,
) {
  switch (route.name) {
    case 'archive':
      return <ArchiveScreen view={route.view} />;
    case 'search':
      return <SearchScreen query={route.query} />;
    case 'capture':
      return <CaptureScreen />;
    case 'settings':
      return (
        <SettingsScreen themePreference={themePreference} onThemeChange={setThemePreference} />
      );
    case 'document':
      return <DocumentScreen key={route.id} id={route.id} />;
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
    case 'document':
      return 'Document';
    case 'notFound':
      return 'Not found';
  }
}
