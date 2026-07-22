import type { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Use the larger internal padding for primary surfaces. */
  primary?: boolean;
}

export function Card({ primary = false, className, ...rest }: CardProps) {
  const classes = ['ui-card', primary ? 'ui-card-primary' : '', className ?? '']
    .filter(Boolean).join(' ');
  return <div className={classes} {...rest} />;
}
