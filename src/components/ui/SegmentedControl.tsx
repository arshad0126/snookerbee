import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}

/** iOS-style segmented control with a sliding thumb behind the active option. */
export function SegmentedControl<T extends string>({
  options, value, onChange, ariaLabel,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<CSSProperties>({ width: 0, transform: 'translateX(0)' });

  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const buttons = container.querySelectorAll<HTMLButtonElement>('.ui-segment');
    const active = buttons[activeIndex];
    if (!active) return;
    setThumb({
      width: active.offsetWidth,
      transform: `translateX(${active.offsetLeft - 2}px)`,
    });
  }, [activeIndex, options.length]);

  return (
    <div ref={containerRef} className="ui-segmented" role="tablist" aria-label={ariaLabel}>
      <span className="ui-segmented-thumb" style={thumb} aria-hidden="true" />
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={opt.value === value}
          className={`ui-segment ${opt.value === value ? 'is-active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
