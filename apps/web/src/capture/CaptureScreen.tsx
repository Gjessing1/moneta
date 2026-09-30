import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { parseAmount } from '@moneta/core/document-edit';
import {
  uploadContentType,
  uploadFileError,
  type UploadSource,
} from '@moneta/core/document-upload';
import { describeError, saveDocument, uploadDocumentFile } from '../api';
import { CameraIcon, UploadIcon } from '../icons';
import { Link, navigate } from '../router';

interface Draft {
  id: string;
  files: File[];
  source: UploadSource;
  capturedAt: string;
  details: DraftDetails;
}

interface DraftDetails {
  merchant: string;
  purchasedItem: string;
  amount: string;
  issuedOn: string;
  notes: string;
}

function emptyDetails(): DraftDetails {
  return { merchant: '', purchasedItem: '', amount: '', issuedOn: '', notes: '' };
}

export function CaptureScreen() {
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [kind, setKind] = useState<'receipt' | 'invoice' | 'other'>('receipt');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [progress, setProgress] = useState('');

  const cameraDraft = drafts.find(function isCamera(draft) {
    return draft.source === 'camera';
  });
  const detailDraft = drafts.length === 1 ? drafts[0] : cameraDraft;

  function updateDetail(field: keyof DraftDetails, value: string) {
    setDrafts(function update(previous) {
      return previous.map(function change(draft) {
        if (draft.id === detailDraft?.id) {
          return { ...draft, details: { ...draft.details, [field]: value } };
        }
        return draft;
      });
    });
    setError(null);
  }

  function addFiles(files: FileList | File[], source: UploadSource) {
    const selected = Array.from(files);
    if (selected.length === 0) {
      return;
    }
    for (const file of selected) {
      const fileError = uploadFileError(file.name, file.type, file.size);
      if (fileError !== null) {
        setError(fileError);
        return;
      }
      if (source === 'camera' && !uploadContentType(file.name, file.type)?.startsWith('image/')) {
        setError('Choose an image from the camera.');
        return;
      }
    }
    setError(null);
    setSavedCount(0);
    const capturedAt = new Date().toISOString();
    if (source === 'camera') {
      setDrafts(function appendPhoto(previous) {
        const existing = previous.find(function isCamera(draft) {
          return draft.source === 'camera';
        });
        if (existing === undefined) {
          return [
            ...previous,
            {
              id: crypto.randomUUID(),
              files: selected,
              source,
              capturedAt,
              details: emptyDetails(),
            },
          ];
        }
        return previous.map(function append(draft) {
          if (draft.id === existing.id) {
            return { ...draft, files: [...draft.files, ...selected] };
          }
          return draft;
        });
      });
    } else {
      setDrafts(function addUploads(previous) {
        return [
          ...previous,
          ...selected.map(function makeDraft(file): Draft {
            return {
              id: crypto.randomUUID(),
              files: [file],
              source,
              capturedAt,
              details: emptyDetails(),
            };
          }),
        ];
      });
    }
  }

  function pickCamera(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files !== null) {
      addFiles(event.target.files, 'camera');
    }
    event.target.value = '';
  }

  function pickUploads(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files !== null) {
      addFiles(event.target.files, 'upload');
    }
    event.target.value = '';
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!saving) {
      addFiles(event.dataTransfer.files, 'upload');
    }
  }

  function removeDraft(id: string) {
    setDrafts(function remove(previous) {
      return previous.filter(function keep(draft) {
        return draft.id !== id;
      });
    });
    setError(null);
  }

  async function fileDrafts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || drafts.length === 0) {
      return;
    }
    const amounts = new Map<string, number | null>();
    for (const draft of drafts) {
      const parsed = parseAmount(draft.details.amount);
      if (!parsed.ok) {
        setError(`${draft.files[0]?.name ?? 'Receipt'}: ${parsed.error}`);
        return;
      }
      amounts.set(draft.id, parsed.value);
    }
    setSaving(true);
    setError(null);
    let completed = 0;
    let lastId = '';
    try {
      for (const draft of drafts) {
        const label = draft.source === 'camera' ? 'receipt' : draft.files[0]?.name;
        setProgress(`Filing ${label ?? 'file'} (${completed + 1} of ${drafts.length})…`);
        for (const file of draft.files) {
          const contentType = uploadContentType(file.name, file.type);
          if (contentType === null) {
            throw new Error(`${file.name}: unsupported file type`);
          }
          await uploadDocumentFile(
            draft.id,
            file,
            contentType,
            draft.source,
            draft.capturedAt,
            draft.source === 'camera' ? 'receipt' : kind,
          );
        }
        const details = draft.details;
        const hasDetails =
          details.merchant.trim() !== '' ||
          details.purchasedItem.trim() !== '' ||
          details.amount.trim() !== '' ||
          details.issuedOn !== '' ||
          details.notes.trim() !== '';
        if (draft.source === 'camera' || hasDetails) {
          const amountMinor = amounts.get(draft.id) ?? null;
          await saveDocument(draft.id, {
            merchant: details.merchant.trim() || null,
            purchasedItem: details.purchasedItem.trim() || null,
            amountMinor,
            currency: amountMinor === null ? null : 'NOK',
            issuedOn: details.issuedOn || null,
            notes: details.notes,
          });
        }
        lastId = draft.id;
        completed += 1;
        setDrafts(function removeFiled(previous) {
          return previous.filter(function keep(item) {
            return item.id !== draft.id;
          });
        });
      }
      if (completed === 1) {
        navigate({ name: 'document', id: lastId });
      } else {
        setSavedCount(completed);
      }
    } catch (err) {
      setSavedCount(completed);
      setError(`${describeError(err)}. The remaining files are ready to retry.`);
    } finally {
      setProgress('');
      setSaving(false);
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h1 className="screen-title">Capture</h1>
      </header>
      <div
        className="capture"
        onDragOver={function allowDrop(event) {
          event.preventDefault();
        }}
        onDrop={drop}
      >
        <input
          ref={cameraInput}
          className="visually-hidden"
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Choose a receipt photo"
          onChange={pickCamera}
        />
        <input
          ref={uploadInput}
          className="visually-hidden"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          multiple
          aria-label="Choose PDF or image files"
          onChange={pickUploads}
        />
        <button
          type="button"
          className="capture__camera"
          disabled={saving}
          onClick={function openCamera() {
            cameraInput.current?.click();
          }}
        >
          <span className="capture__lens">
            <CameraIcon size={40} strokeWidth={1.7} />
          </span>
          <span className="capture__camera-title">
            {cameraDraft === undefined ? 'Photograph a receipt' : 'Add another page'}
          </span>
          <span className="capture__camera-hint">Opens the rear camera</span>
        </button>
        <button
          type="button"
          className="row-button"
          disabled={saving}
          onClick={function openFiles() {
            uploadInput.current?.click();
          }}
        >
          <UploadIcon size={22} strokeWidth={1.9} />
          <span className="row-button__text">
            <span className="row-button__title">Upload files</span>
            <span className="row-button__hint">
              PDFs or images, one or many · or drop them here
            </span>
          </span>
        </button>
        {drafts.length > 0 && (
          <form className="capture__drafts" onSubmit={fileDrafts}>
            <h2 className="section-title">Ready to file</h2>
            <ul className="capture__list">
              {drafts.map(function renderDraft(draft) {
                const label =
                  draft.source === 'camera'
                    ? `Receipt photo · ${draft.files.length} ${draft.files.length === 1 ? 'page' : 'pages'}`
                    : draft.files[0]?.name;
                return (
                  <li key={draft.id} className="capture__item">
                    <span>{label}</span>
                    <button
                      type="button"
                      className="text-button"
                      disabled={saving}
                      onClick={function remove() {
                        removeDraft(draft.id);
                      }}
                      aria-label={`Remove ${label}`}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
            {detailDraft !== undefined && (
              <div className="capture__details">
                <p className="note">
                  Details are optional. Add what you know now, or edit the document after filing.
                </p>
                <label>
                  Shop or sender{' '}
                  <input
                    name="merchant"
                    value={detailDraft.details.merchant}
                    maxLength={500}
                    disabled={saving}
                    onChange={function change(event) {
                      updateDetail('merchant', event.target.value);
                    }}
                  />
                </label>
                <label>
                  What you bought{' '}
                  <input
                    name="purchasedItem"
                    value={detailDraft.details.purchasedItem}
                    maxLength={500}
                    placeholder="e.g. headphones"
                    disabled={saving}
                    onChange={function change(event) {
                      updateDetail('purchasedItem', event.target.value);
                    }}
                  />
                </label>
                <label>
                  Amount (NOK){' '}
                  <input
                    name="amount"
                    inputMode="decimal"
                    placeholder="499,50"
                    value={detailDraft.details.amount}
                    disabled={saving}
                    onChange={function change(event) {
                      updateDetail('amount', event.target.value);
                    }}
                  />
                </label>
                <label>
                  Date{' '}
                  <input
                    name="issuedOn"
                    type="date"
                    value={detailDraft.details.issuedOn}
                    disabled={saving}
                    onChange={function change(event) {
                      updateDetail('issuedOn', event.target.value);
                    }}
                  />
                </label>
                <label className="capture__notes">
                  Notes{' '}
                  <textarea
                    name="notes"
                    rows={3}
                    value={detailDraft.details.notes}
                    disabled={saving}
                    onChange={function change(event) {
                      updateDetail('notes', event.target.value);
                    }}
                  />
                </label>
              </div>
            )}
            {drafts.some(function hasUpload(draft) {
              return draft.source === 'upload';
            }) && (
              <label className="capture__kind">
                File type for uploads
                <select
                  value={kind}
                  disabled={saving}
                  onChange={function change(event) {
                    setKind(event.target.value as typeof kind);
                  }}
                >
                  <option value="receipt">Receipt</option>
                  <option value="invoice">Invoice</option>
                  <option value="other">Other</option>
                </select>
              </label>
            )}
            {error !== null && (
              <p className="capture__error" role="alert">
                {error}
              </p>
            )}
            {progress !== '' && (
              <p className="note" role="status">
                {progress}
              </p>
            )}
            <button type="submit" className="button button--primary" disabled={saving}>
              {saving
                ? 'Filing…'
                : `File ${drafts.length === 1 ? 'document' : `${drafts.length} documents`}`}
            </button>
          </form>
        )}
        {drafts.length === 0 && error !== null && (
          <p className="capture__error" role="alert">
            {error}
          </p>
        )}
        {savedCount > 0 && (
          <p className="capture__success" role="status">
            Filed {savedCount} {savedCount === 1 ? 'document' : 'documents'}.{' '}
            <Link to={{ name: 'archive', view: 'recent' }}>View archive</Link>
          </p>
        )}
      </div>
    </div>
  );
}
