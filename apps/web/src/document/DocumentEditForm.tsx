import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import type { ArchiveDocument, DocumentDetail, GuessableField } from '@moneta/core/document';
import {
  patchFromValues,
  valuesFromDocument,
  type DocumentEditValues,
} from '@moneta/core/document-edit';
import { describeError, saveDocument } from '../api';

interface Props {
  document: ArchiveDocument;
  onSaved: (detail: DocumentDetail) => void;
  onCancel: () => void;
}

export function DocumentEditForm({ document: doc, onSaved, onCancel }: Props) {
  const [values, setValues] = useState(function initial() {
    return valuesFromDocument(doc);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState(doc.tags.join(', '));

  function update(field: keyof DocumentEditValues, value: string) {
    setValues(function replace(previous) {
      return { ...previous, [field]: value };
    });
    setError(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }
    const parsed = patchFromValues(values);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const nextTags = tags
      .split(',')
      .map(function trim(tag) {
        return tag.trim();
      })
      .filter(Boolean);
    setSaving(true);
    setError(null);
    try {
      onSaved(await saveDocument(doc.id, { ...parsed.value, tags: nextTags }));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  function field(
    name: keyof DocumentEditValues,
    label: string,
    options: {
      type?: string;
      inputMode?: 'decimal';
      placeholder?: string;
    } = {},
  ) {
    let guessedField: GuessableField | null = name as GuessableField;
    if (name === 'amount') {
      guessedField = 'amountMinor';
    } else if (name === 'purchasedItem' || name === 'notes') {
      guessedField = null;
    }
    return (
      <EditField
        label={label}
        guessed={guessedField !== null && doc.guessed.includes(guessedField)}
        key={name}
      >
        <input
          name={name}
          type={options.type ?? 'text'}
          inputMode={options.inputMode}
          placeholder={options.placeholder}
          value={values[name]}
          disabled={saving}
          onChange={function change(event: ChangeEvent<HTMLInputElement>) {
            update(name, event.target.value);
          }}
        />
      </EditField>
    );
  }

  return (
    <form className="document-edit list" aria-label="Edit details" onSubmit={save}>
      <p className="document-edit__intro">
        Check the details against the original. An amber dot marks an unconfirmed value until you
        save.
      </p>
      <fieldset className="document-edit__group">
        <legend>Document</legend>
        <EditField label="Type" guessed={doc.guessed.includes('kind')}>
          <select
            name="kind"
            value={values.kind}
            disabled={saving}
            onChange={function change(event) {
              update('kind', event.target.value);
            }}
          >
            <option value="receipt">Receipt</option>
            <option value="invoice">Invoice</option>
            <option value="other">Other</option>
          </select>
        </EditField>
        {field('merchant', 'Shop or sender')}
        {field('purchasedItem', 'What you bought', { placeholder: 'e.g. headphones' })}
        <div className="document-edit__pair">
          {field('amount', 'Amount', { inputMode: 'decimal', placeholder: '499,50' })}
          {field('currency', 'Currency', { placeholder: 'NOK' })}
        </div>
        {field('issuedOn', 'Document date', { type: 'date' })}
      </fieldset>
      <fieldset className="document-edit__group">
        <legend>Invoice details</legend>
        {field('dueOn', 'Due date', { type: 'date' })}
        {field('kid', 'KID')}
        {field('account', 'Account')}
        {field('iban', 'IBAN')}
      </fieldset>
      <fieldset className="document-edit__group">
        <legend>Notes</legend>
        <label className="document-edit__field">
          <span className="document-edit__label">Tags (comma separated)</span>
          <input
            name="tags"
            value={tags}
            disabled={saving}
            onChange={function change(event) {
              setTags(event.target.value);
            }}
            placeholder="e.g. bolig, jobb"
          />
        </label>
        <label className="document-edit__field">
          <span className="visually-hidden">Notes</span>
          <textarea
            name="notes"
            rows={4}
            value={values.notes}
            disabled={saving}
            onChange={function change(event) {
              update('notes', event.target.value);
            }}
          />
        </label>
      </fieldset>
      {error !== null && (
        <p className="document-edit__error" role="alert">
          {error}
        </p>
      )}
      <div className="document-edit__actions">
        <button type="submit" className="button button--primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save details'}
        </button>
        <button type="button" className="button" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditField({
  label,
  guessed,
  children,
}: {
  label: string;
  guessed: boolean;
  children: ReactNode;
}) {
  return (
    <label className="document-edit__field">
      <span className="document-edit__label">
        {label}
        {guessed && (
          <span
            className="document-edit__guess"
            title="Unconfirmed value; save to confirm"
            aria-label="Unconfirmed guess"
          />
        )}
      </span>
      {children}
    </label>
  );
}
