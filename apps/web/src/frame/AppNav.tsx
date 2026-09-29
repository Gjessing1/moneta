import type { Section } from '@moneta/core/routes';
import { ArchiveIcon, CameraIcon, SettingsIcon } from '../icons';
import { Link } from '../router';

// Bottom bar on the phone, side rail on wide screens (frame.css). Capture sits
// in the middle as the one bold control, because photographing a receipt is
// the action the phone is for.
export function AppNav({ section }: { section: Section | null }) {
  return (
    <nav className="app-nav" aria-label="Main">
      <span className="app-nav__brand" aria-hidden="true">
        M
      </span>
      <Link
        to={{ name: 'archive', view: 'recent' }}
        className="app-nav__item"
        current={section === 'archive'}
      >
        <ArchiveIcon />
        <span className="app-nav__label">Archive</span>
      </Link>
      <Link
        to={{ name: 'capture' }}
        className="app-nav__item app-nav__item--capture"
        current={section === 'capture'}
      >
        <span className="shutter" aria-hidden="true">
          <span className="shutter__ring">
            <CameraIcon size={20} strokeWidth={2} />
          </span>
        </span>
        <span className="app-nav__label">Capture</span>
      </Link>
      <Link to={{ name: 'settings' }} className="app-nav__item" current={section === 'settings'}>
        <SettingsIcon />
        <span className="app-nav__label">Settings</span>
      </Link>
    </nav>
  );
}
