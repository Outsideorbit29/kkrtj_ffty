export interface SegmentOption<K extends string> {
  key: K;
  label: string;
}

interface SegmentedProps<K extends string> {
  options: SegmentOption<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
}

/** A row of mutually exclusive toggle buttons (chart/table, filters). */
export function Segmented<K extends string>({ options, value, onChange, label }: SegmentedProps<K>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} type="button" className="segmented__btn" aria-pressed={o.key === value} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
