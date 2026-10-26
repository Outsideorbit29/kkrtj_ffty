import { useRef, type KeyboardEvent } from 'react';
import { panelId, tabId } from './tabIds';

export interface TabDef<K extends string> {
  key: K;
  label: string;
}

interface TabsProps<K extends string> {
  tabs: TabDef<K>[];
  active: K;
  onChange: (key: K) => void;
  label: string;
}

/** WAI-ARIA tabs with roving tabindex; arrow keys, Home and End move between tabs. */
export function Tabs<K extends string>({ tabs, active, onChange, label }: TabsProps<K>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const target =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null;
    const tab = target === null ? undefined : tabs[target];
    if (target === null || !tab) return;
    event.preventDefault();
    onChange(tab.key);
    refs.current[target]?.focus();
  };

  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, i) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={tabId(tab.key)}
            type="button"
            role="tab"
            className="tab"
            aria-selected={selected}
            aria-controls={panelId(tab.key)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
