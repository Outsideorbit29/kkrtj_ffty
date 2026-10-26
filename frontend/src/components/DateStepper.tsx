import { useId } from 'react';
import type { IsoDate } from '../api/types';
import { addDays, clampDate, isIsoDate } from '../lib/dates';
import { ChevronLeft, ChevronRight } from './Icons';

interface DateStepperProps {
  label: string;
  value: IsoDate;
  min: IsoDate;
  max: IsoDate;
  onChange: (date: IsoDate) => void;
}

/** A date input with previous/next-day buttons, bounded to [min, max]. */
export function DateStepper({ label, value, min, max, onChange }: DateStepperProps) {
  const id = useId();
  const step = (days: number) => onChange(clampDate(addDays(value, days), min, max));

  return (
    <div className="control">
      <label className="control__label" htmlFor={id}>
        {label}
      </label>
      <div className="control__row">
        <button
          type="button"
          className="btn btn--icon"
          onClick={() => step(-1)}
          disabled={value <= min}
          aria-label="Previous day"
        >
          <ChevronLeft />
        </button>
        <input
          id={id}
          className="input"
          type="date"
          min={min}
          max={max}
          value={value}
          required
          onChange={(e) => {
            if (isIsoDate(e.target.value)) onChange(clampDate(e.target.value, min, max));
          }}
        />
        <button
          type="button"
          className="btn btn--icon"
          onClick={() => step(1)}
          disabled={value >= max}
          aria-label="Next day"
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}
