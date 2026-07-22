export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel?: string;
}

export function Stepper({
  value, onChange, min = 0, max = 99, step = 1, ariaLabel,
}: StepperProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="ui-stepper" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className="ui-stepper-btn"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label="Decrease"
      >
        −
      </button>
      <span className="ui-stepper-value numeric" aria-live="polite">{value}</span>
      <button
        type="button"
        className="ui-stepper-btn"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
