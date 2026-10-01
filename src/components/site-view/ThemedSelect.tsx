'use client';

/* A themed single-choice listbox. Never a native <select>: the native menu opens as the system
 * menu and ignores the product's tokens. Mechanics follow CiteRank's question-select. */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export default function ThemedSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = Math.max(0, options.findIndex((o) => o.value === value));
  const [active, setActive] = useState(selected);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const search = useRef({ text: '', time: 0 });
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  function take(index: number) {
    onChange(options[index].value);
    setOpen(false);
    button.current?.focus();
  }

  function onKey(event: KeyboardEvent<HTMLButtonElement>) {
    const key = event.key;
    if (key === 'Tab') {
      setOpen(false);
      return;
    }
    if (key === 'Escape') {
      if (open) event.preventDefault();
      setOpen(false);
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(key)) {
      event.preventDefault();
      if (!open) {
        setActive(selected);
        setOpen(true);
        return;
      }
      if (key === 'Enter' || key === ' ') take(active);
      else if (key === 'Home') setActive(0);
      else if (key === 'End') setActive(options.length - 1);
      else setActive((i) => (i + (key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = Date.now();
      const text = (now - search.current.time < 600 ? search.current.text : '') + key.toLowerCase();
      search.current = { text, time: now };
      const match = options.findIndex((o) => o.label.toLowerCase().startsWith(text));
      if (match !== -1) {
        event.preventDefault();
        setActive(match);
        setOpen(true);
      }
    }
  }

  return (
    <div
      className="sv-select"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <span id={`${id}-label`} className="sv-label">
        {label}
      </span>
      <button
        ref={button}
        type="button"
        className="sv-select-btn"
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onKeyDown={onKey}
        onClick={() => {
          setActive(selected);
          setOpen(!open);
        }}
      >
        <span className="sv-select-val">{options[selected]?.label}</span>
        <span className="sv-select-chev" aria-hidden="true" />
      </button>
      <div className="sv-select-pop" data-open={open} inert={!open}>
        <ul id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`}>
          {options.map((o, index) => (
            <li
              key={o.value}
              id={`${id}-${index}`}
              role="option"
              aria-selected={selected === index}
              data-active={active === index}
              onPointerEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => take(index)}
            >
              <span>{o.label}</span>
              <span className="sv-select-tick" aria-hidden="true">
                {selected === index ? '✓' : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
