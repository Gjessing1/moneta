import { useState } from 'react';
import type { StoredFileView } from '@moneta/core/document-view';
import { DownloadIcon, SendOnIcon } from '../icons';

// Download the originals, or hand them to another app through the system share
// sheet (mail them to the accountant, drop them in a chat).
export function DocumentActions({
  title,
  files,
  fileUrl,
}: {
  title: string;
  files: StoredFileView[];
  fileUrl: (position: number) => string;
}) {
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [first] = files;
  if (first === undefined) {
    return null;
  }

  async function share() {
    setShareError(null);
    setSharing(true);
    try {
      const shared: File[] = [];
      for (const file of files) {
        const res = await fetch(fileUrl(file.position));
        if (!res.ok) {
          throw new Error(`The server answered ${res.status}`);
        }
        const blob = await res.blob();
        shared.push(new File([blob], file.downloadName, { type: file.contentType }));
      }
      await navigator.share({ files: shared, title });
    } catch (err) {
      // Closing the share sheet is a choice, not a failure.
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        console.error('share failed', err);
        setShareError('The original could not be shared. Download it instead.');
      }
    } finally {
      setSharing(false);
    }
  }

  let download;
  if (files.length === 1) {
    download = (
      <a
        className="button button--primary document-actions__download"
        href={fileUrl(first.position)}
        download={first.downloadName}
      >
        <DownloadIcon size={20} strokeWidth={2} />
        Download original
      </a>
    );
  } else {
    download = (
      <button
        type="button"
        className="button button--primary document-actions__download"
        onClick={function downloadAll() {
          downloadEach(files, fileUrl);
        }}
      >
        <DownloadIcon size={20} strokeWidth={2} />
        Download {files.length} originals
      </button>
    );
  }

  return (
    <div className="document-actions">
      <div className="document-actions__row">
        {download}
        {canShareFiles() && (
          <button
            type="button"
            className="button document-actions__share"
            aria-label="Share the original"
            disabled={sharing}
            onClick={function start() {
              void share();
            }}
          >
            <SendOnIcon size={22} strokeWidth={1.9} />
          </button>
        )}
      </div>
      {shareError !== null && (
        <p className="note" role="alert">
          {shareError}
        </p>
      )}
    </div>
  );
}

// Only where the system can take files: Android's Chrome, not desktop Linux,
// and not the Android WebView until the shell adds a share bridge.
function canShareFiles(): boolean {
  if (typeof navigator.canShare !== 'function') {
    return false;
  }
  try {
    const probe = new File(['%PDF'], 'probe.pdf', { type: 'application/pdf' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

// One save per original. Chrome asks once whether the site may save several.
function downloadEach(files: StoredFileView[], fileUrl: (position: number) => string): void {
  for (const file of files) {
    const link = document.createElement('a');
    link.href = fileUrl(file.position);
    link.download = file.downloadName;
    document.body.append(link);
    link.click();
    link.remove();
  }
}
