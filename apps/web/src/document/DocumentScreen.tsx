import { EmptyState } from '../frame/EmptyState';
import { BackIcon } from '../icons';
import { Link } from '../router';

// The route exists now so deep links and the Android shell can open /d/:id.
// There is no document API to load from yet, so every id reads as missing.
export function DocumentScreen({ id }: { id: string }) {
  return (
    <div className="screen">
      <header className="screen-header screen-header--detail">
        <Link
          to={{ name: 'archive', view: 'recent' }}
          className="icon-button"
          aria-label="Back to the archive"
        >
          <BackIcon />
        </Link>
        <h1 className="screen-title screen-title--small">Document</h1>
      </header>
      <EmptyState
        title="Document not found"
        action={
          <Link to={{ name: 'archive', view: 'recent' }} className="button">
            Back to the archive
          </Link>
        }
      >
        There is no document with the id {id} in the archive. It may have been deleted, or the link
        is incomplete.
      </EmptyState>
    </div>
  );
}
