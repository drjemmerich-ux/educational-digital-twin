// Shared form primitives: labelled fields, confidence input, hypothesis lists, dialogs.
import * as React from 'react';

let idCounter = 0;
export function useId(prefix: string): string {
  const ref = React.useRef<string | null>(null);
  if (ref.current === null) ref.current = `${prefix}-${++idCounter}`;
  return ref.current;
}

export function TextField(props: {
  id: string;
  label: string;
  helper?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const helpId = `${props.id}-help`;
  return (
    <div className="field">
      <label htmlFor={props.id} className="field-label">
        {props.label}
        {props.required ? <span className="req" aria-hidden="true"> *</span> : <span className="optional"> (optional)</span>}
      </label>
      {props.helper ? (
        <p id={helpId} className="field-helper">
          {props.helper}
        </p>
      ) : null}
      {(props.rows ?? 3) > 1 ? (
        <textarea
          id={props.id}
          rows={props.rows ?? 3}
          value={props.value}
          required={props.required}
          disabled={props.disabled}
          aria-describedby={props.helper ? helpId : undefined}
          placeholder={props.placeholder}
          onChange={(e) => props.onChange(e.target.value)}
        />
      ) : (
        <input
          id={props.id}
          type="text"
          value={props.value}
          required={props.required}
          disabled={props.disabled}
          aria-describedby={props.helper ? helpId : undefined}
          placeholder={props.placeholder}
          onChange={(e) => props.onChange(e.target.value)}
        />
      )}
    </div>
  );
}

/** Confidence 0-100. Starts unset; never prefilled. */
export function ConfidenceInput(props: { id: string; value: number | null; onChange: (v: number | null) => void; required?: boolean; label?: string }) {
  const label = props.label ?? 'Your confidence';
  return (
    <fieldset className="field confidence">
      <legend className="field-label">
        {label}
        {props.required ? <span className="req" aria-hidden="true"> *</span> : <span className="optional"> (optional)</span>}
      </legend>
      <p className="field-helper">0 to 100. This is your confidence, not a probability of being correct.</p>
      <div className="confidence-row">
        <input
          id={props.id}
          type="range"
          min={0}
          max={100}
          step={5}
          value={props.value ?? 50}
          aria-valuetext={props.value === null ? 'Not set' : String(props.value)}
          aria-label={`${label}, 0 to 100`}
          className={props.value === null ? 'unset' : ''}
          onChange={(e) => props.onChange(Number(e.target.value))}
          onClick={(e) => props.onChange(Number((e.target as HTMLInputElement).value))}
        />
        <output htmlFor={props.id} className="confidence-value">
          {props.value === null ? 'Not set' : props.value}
        </output>
        {props.value !== null && !props.required ? (
          <button type="button" className="btn-link" onClick={() => props.onChange(null)}>
            Clear
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}

export function ListInput(props: { idBase: string; label: string; helper?: string; items: string[]; onChange: (v: string[]) => void; addLabel: string; required?: boolean }) {
  const items = props.items.length ? props.items : [''];
  return (
    <fieldset className="field">
      <legend className="field-label">
        {props.label}
        {props.required ? <span className="req" aria-hidden="true"> *</span> : null}
      </legend>
      {props.helper ? <p className="field-helper">{props.helper}</p> : null}
      <ol className="list-input">
        {items.map((it, i) => (
          <li key={i}>
            <label className="sr-only" htmlFor={`${props.idBase}-${i}`}>
              {props.label} {i + 1}
            </label>
            <input
              id={`${props.idBase}-${i}`}
              type="text"
              value={it}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                props.onChange(next);
              }}
            />
            {items.length > 1 ? (
              <button type="button" className="btn-icon" aria-label={`Remove item ${i + 1}`} onClick={() => props.onChange(items.filter((_, j) => j !== i))}>
                ×
              </button>
            ) : null}
          </li>
        ))}
      </ol>
      <button type="button" className="btn-secondary btn-small" onClick={() => props.onChange([...items, ''])}>
        {props.addLabel}
      </button>
    </fieldset>
  );
}

export function RadioGroup<T extends string>(props: { name: string; legend: string; options: { id: T; label: string; hint?: string }[]; value: T | null; onChange: (v: T) => void; required?: boolean }) {
  return (
    <fieldset className="field radio-group">
      <legend className="field-label">
        {props.legend}
        {props.required ? <span className="req" aria-hidden="true"> *</span> : null}
      </legend>
      {props.options.map((o) => (
        <label key={o.id} className={`radio-option ${props.value === o.id ? 'selected' : ''}`}>
          <input type="radio" name={props.name} value={o.id} checked={props.value === o.id} onChange={() => props.onChange(o.id)} />
          <span>
            {o.label}
            {o.hint ? <span className="radio-hint">{o.hint}</span> : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function ErrorNote(props: { message: string | null }) {
  if (!props.message) return null;
  return (
    <p className="error-note" role="alert">
      {props.message}
    </p>
  );
}

export function Dialog(props: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; labelledBy?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const titleId = useId('dlg');
  React.useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () => Array.from(node?.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])') ?? []).filter((el) => !el.hasAttribute('disabled'));
    (focusables()[0] ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        props.onClose();
      } else if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    node?.addEventListener('keydown', onKey);
    return () => {
      node?.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div ref={ref} className={`dialog ${props.wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="dialog-head">
          <h2 id={titleId}>{props.title}</h2>
          <button type="button" className="btn-icon" aria-label="Close dialog" onClick={props.onClose}>
            ×
          </button>
        </div>
        <div className="dialog-body">{props.children}</div>
      </div>
    </div>
  );
}

/** Inline two-step commit confirmation (window.confirm is unavailable in sandboxed viewers). */
export function CommitBar(props: { label: string; confirmText: string; onCommit: () => void; disabled?: boolean; error?: string | null }) {
  const [confirming, setConfirming] = React.useState(false);
  return (
    <div className="commit-bar">
      <ErrorNote message={props.error ?? null} />
      {confirming ? (
        <div className="confirm-inline" role="group" aria-label="Confirm commitment">
          <p>{props.confirmText}</p>
          <div className="row">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setConfirming(false);
                props.onCommit();
              }}
            >
              Confirm and commit
            </button>
            <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
              Keep editing
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-primary" disabled={props.disabled} onClick={() => setConfirming(true)}>
          {props.label}
        </button>
      )}
    </div>
  );
}

export function StatusChip(props: { tone: 'pending' | 'resolved' | 'boundary' | 'neutral' | 'info'; children: React.ReactNode }) {
  return <span className={`chip chip-${props.tone}`}>{props.children}</span>;
}

export const COMMIT_NOTE = 'Committed entries are kept as written. Later changes are saved as new linked versions.';
