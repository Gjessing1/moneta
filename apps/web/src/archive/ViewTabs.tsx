import type { ArchiveView } from '@moneta/core/routes';
import { Link } from '../router';

const VIEWS: { view: ArchiveView; label: string }[] = [
  { view: 'recent', label: 'Recent' },
  { view: 'shops', label: 'Shops' },
  { view: 'tags', label: 'Tags' },
  { view: 'warranty', label: 'Warranty' },
];

// Each view has its own URL, so a view survives reloads and can be linked to.
// That makes these links, not ARIA tabs.
export function ViewTabs({ view }: { view: ArchiveView }) {
  return (
    <nav className="segmented" aria-label="Arrange the archive">
      {VIEWS.map(function renderView(entry) {
        return (
          <Link
            key={entry.view}
            to={{ name: 'archive', view: entry.view }}
            className="segmented__option"
            current={entry.view === view}
          >
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}
