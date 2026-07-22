import { forwardRef, type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'filled' | 'tinted' | 'plain' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'filled', size = 'md', fullWidth = false, className, type = 'button', ...rest },
  ref,
) {
  const classes = [
    'ui-btn',
    `ui-btn-${variant}`,
    `ui-btn-${size}`,
    fullWidth ? 'ui-btn-full' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return <button ref={ref} type={type} className={classes} {...rest} />;
});
