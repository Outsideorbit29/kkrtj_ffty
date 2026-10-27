import { useId, useState, type FormEvent } from 'react';
import type { CutoffPreset, HhMm } from '../api/types';
import { isHhMm } from '../lib/dates';

const CUSTOM = 'custom';

interface CutoffSelectorProps {
  value: HhMm;
  presets: CutoffPreset[];
  onChange: (cutoff: HhMm) => void;
}

/** Decision cutoff (UK time on D-1): an auction preset or a custom HH:MM. */
export function CutoffSelector({ value, presets, onChange }: CutoffSelectorProps) {
  const id = useId();
  const isPreset = presets.some((p) => p.value === value);
  const [customMode, setCustomMode] = useState(!isPreset);
  // Uncommitted custom time while the user is typing; null shows the applied value.
  const [draft, setDraft] = useState<string | null>(null);

  const commitDraft = (event?: FormEvent) => {
    event?.preventDefault();
    if (draft !== null && isHhMm(draft) && draft !== value) onChange(draft);
    setDraft(null);
  };

  const onSelect = (selected: string) => {
    if (selected === CUSTOM) {
      setCustomMode(true);
      return;
    }
    setCustomMode(false);
    onChange(selected);
  };

  return (
    <form className="control" onSubmit={commitDraft}>
      <label className="control__label" htmlFor={`${id}-preset`}>
        Cutoff (UK, D-1)
      </label>
      <div className="control__row">
        <span className="select-wrap">
          <select
            id={`${id}-preset`}
            className="select"
            value={customMode ? CUSTOM : value}
            onChange={(e) => onSelect(e.target.value)}
          >
            {presets.map((p) => (
              <option key={p.value} value={p.value}>
                {p.value} · {p.label}
              </option>
            ))}
            <option value={CUSTOM}>Custom time…</option>
          </select>
        </span>
        {customMode && (
          <>
            <label className="visually-hidden" htmlFor={`${id}-custom`}>
              Custom cutoff time
            </label>
            <input
              id={`${id}-custom`}
              className="input input--time"
              type="time"
              step={60}
              required
              value={draft ?? value}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => commitDraft()}
            />
          </>
        )}
      </div>
    </form>
  );
}
