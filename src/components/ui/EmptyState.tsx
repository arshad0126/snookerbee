import type { ReactNode } from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  /** One line telling the person what to do next — an invitation, not an apology. */
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="ui-empty">
      <div className="ui-empty-icon" aria-hidden="true">{icon}</div>
      <div className="ui-empty-title">{title}</div>
      <div className="ui-empty-text">{message}</div>
      {actionLabel && onAction && (
        <Button variant="tinted" onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}
