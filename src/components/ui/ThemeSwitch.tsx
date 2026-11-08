import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { SWITCH_MODES, stepMode, type ColorMode } from '../../lib/settings';

const LABEL: Record<ColorMode, string> = { dark: 'Dark', auto: 'Auto', light: 'Light' };
const SPOKEN: Record<ColorMode, string> = {
  dark: 'Dark',
  auto: 'Auto, follows your phone',
  light: 'Light',
};

export interface ThemeSwitchProps {
  value: ColorMode;
  onChange: (mode: ColorMode) => void;
  /** Dark / Auto / Light words under the track. */
  showLabels?: boolean;
  className?: string;
}

/**
 * Three-way colour mode switch: a ball that rolls along a strip of baize.
 * Black ball = Dark, half black / half white = Auto, cue ball = Light.
 * CSS only (transforms + colour transitions), and still under reduced motion.
 */
export function ThemeSwitch({ value, onChange, showLabels = true, className }: ThemeSwitchProps) {
  const hits = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, SWITCH_MODES.indexOf(value));

  const pick = (mode: ColorMode, focus: boolean) => {
    if (mode !== value) onChange(mode);
    if (focus) hits.current[SWITCH_MODES.indexOf(mode)]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        pick(stepMode(value, -1), true);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        pick(stepMode(value, 1), true);
        break;
      case 'Home':
        pick(SWITCH_MODES[0], true);
        break;
      case 'End':
        pick(SWITCH_MODES[SWITCH_MODES.length - 1], true);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <div
      className={`ui-tswitch${className ? ` ${className}` : ''}`}
      data-mode={value}
      style={{ '--tswitch-i': index } as CSSProperties}
    >
      <div className="ui-tswitch-track" role="radiogroup" aria-label="Colour mode" onKeyDown={onKeyDown}>
        {SWITCH_MODES.map((m) => (
          <span key={m} className="ui-tswitch-spot" aria-hidden="true" />
        ))}
        <span className="ui-tswitch-ball" aria-hidden="true">
          <span className="ui-tswitch-spin">
            <span className="ui-tswitch-face ui-tswitch-face--l" />
            <span className="ui-tswitch-face ui-tswitch-face--r" />
          </span>
        </span>
        {SWITCH_MODES.map((m, i) => (
          <button
            key={m}
            ref={(el) => { hits.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={m === value}
            aria-label={SPOKEN[m]}
            tabIndex={m === value ? 0 : -1}
            className="ui-tswitch-hit"
            onClick={() => pick(m, false)}
          />
        ))}
      </div>
      {showLabels && (
        <div className="ui-tswitch-labels" aria-hidden="true">
          {SWITCH_MODES.map((m) => (
            <span key={m} className={m === value ? 'is-on' : undefined}>{LABEL[m]}</span>
          ))}
        </div>
      )}
    </div>
  );
}
