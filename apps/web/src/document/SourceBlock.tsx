import type { DocumentSource } from '@moneta/core/document';
import type { SourceView, StoredFileView } from '@moneta/core/document-view';
import { DownloadIcon, ExternalIcon, SourceIcon, StoredIcon } from '../icons';

// D5: where the document came from, and that Moneta holds its own copy of the
// original, so it stays readable whatever happens to the mail.
export function SourceBlock({
  source,
  view,
  mailUrl,
  files,
  downloadUrl,
}: {
  source: DocumentSource;
  view: SourceView;
  mailUrl: string | null;
  files: StoredFileView[];
  downloadUrl: (position: number) => string;
}) {
  const origin = (
    <>
      <span className="source__icon">
        <SourceIcon source={source} size={20} strokeWidth={1.9} />
      </span>
      <span className="source__text">
        <span className="source__title">{view.title}</span>
        {view.lines.map(function renderLine(line) {
          return (
            <span key={line} className="source__line">
              {line}
            </span>
          );
        })}
      </span>
    </>
  );

  let stored = 'Original stored in Moneta';
  if (files.length > 1) {
    stored = 'Originals stored in Moneta';
  }

  return (
    <section className="list source" aria-label="Source">
      {mailUrl === null ? (
        <div className="source__row">{origin}</div>
      ) : (
        <a
          className="source__row source__row--link"
          href={mailUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {origin}
          <span className="source__open">
            Open in maily
            <ExternalIcon size={14} strokeWidth={2.3} />
          </span>
        </a>
      )}
      {files.length > 0 && (
        <div className="source__row">
          <span className="source__icon source__icon--good">
            <StoredIcon size={20} strokeWidth={1.9} />
          </span>
          <span className="source__text">
            <span className="source__title">{stored}</span>
            {files.map(function renderFile(file) {
              return (
                <span key={file.position} className="source__file">
                  <span className="source__line source__line--file">
                    {file.name}, {file.detail}
                  </span>
                  {files.length > 1 && (
                    <a
                      className="icon-button source__download"
                      href={downloadUrl(file.position)}
                      download={file.downloadName}
                      aria-label={`Download ${file.name}`}
                    >
                      <DownloadIcon size={18} strokeWidth={1.9} />
                    </a>
                  )}
                </span>
              );
            })}
          </span>
        </div>
      )}
    </section>
  );
}
