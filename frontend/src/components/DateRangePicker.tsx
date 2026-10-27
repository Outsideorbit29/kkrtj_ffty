import { useId } from 'react';
import type { IsoDate } from '../api/types';
import { clampDate, isIsoDate } from '../lib/dates';

interface DateRangePickerProps {
  start: IsoDate;
  end: IsoDate;
  min: IsoDate;
  max: IsoDate;
  onChange: (start: IsoDate, end: IsoDate) => void;
}

/** Delivery-day range. Moving one end past the other drags the other end along. */
export function DateRangePicker({ start, end, min, max, onChange }: DateRangePickerProps) {
  const id = useId();
  const isFull = start === min && end === max;

  const setStart = (raw: string) => {
    if (!isIsoDate(raw)) return;
    const next = clampDate(raw, min, max);
    onChange(next, next > end ? next : end);
  };
  const setEnd = (raw: string) => {
    if (!isIsoDate(raw)) return;
    const next = clampDate(raw, min, max);
    onChange(next < start ? next : start, next);
  };

  return (
    <fieldset className="control fieldset">
      <legend className="control__label">Delivery days</legend>
      <div className="range">
        <label className="visually-hidden" htmlFor={`${id}-start`}>
          From
        </label>
        <input
          id={`${id}-start`}
          className="input range__input"
          type="date"
          min={min}
          max={max}
          value={start}
          required
          onChange={(e) => setStart(e.target.value)}
        />
        <span className="range__sep" aria-hidden>–</span>
        <label className="visually-hidden" htmlFor={`${id}-end`}>
          To
        </label>
        <input
          id={`${id}-end`}
          className="input range__input"
          type="date"
          min={min}
          max={max}
          value={end}
          required
          onChange={(e) => setEnd(e.target.value)}
        />
        <button type="button" className="btn" disabled={isFull} onClick={() => onChange(min, max)}>
          Full range
        </button>
      </div>
    </fieldset>
  );
}
