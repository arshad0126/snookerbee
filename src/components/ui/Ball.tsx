import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react';
import { BALL_POINTS, type BallColor } from '../../styles/tokens';

type BallSize = 'sm' | 'md' | 'lg';

export interface BallProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  color: BallColor;
  size?: BallSize;
  /** Small badge for a multi-ball pot (e.g. two reds in one stroke). */
  count?: number;
}

const LABEL: Record<BallColor, string> = {
  red: 'Red', yellow: 'Yellow', green: 'Green', brown: 'Brown',
  blue: 'Blue', pink: 'Pink', black: 'Black',
};

/**
 * The signature component. A ball is a physical object on the table, never a
 * button chrome. Full-saturation colour, soft specular highlight, drop shadow.
 * There is deliberately no `disabled` prop — every ball is always tappable.
 */
export const Ball = forwardRef<HTMLButtonElement, BallProps>(function Ball(
  { color, size = 'md', count, style, ...rest },
  ref,
) {
  const vars = {
    '--ball-fill': `var(--ball-${color})`,
    '--ball-label': `var(--on-ball-${color})`,
  } as CSSProperties;

  return (
    <button
      ref={ref}
      type="button"
      className={`ui-ball ui-ball-${size}`}
      style={{ ...vars, ...style }}
      aria-label={`${LABEL[color]}, ${BALL_POINTS[color]} point${BALL_POINTS[color] === 1 ? '' : 's'}`}
      {...rest}
    >
      {count !== undefined && count > 1 && (
        <span className="ui-ball-count" aria-hidden="true">{count}</span>
      )}
    </button>
  );
});
