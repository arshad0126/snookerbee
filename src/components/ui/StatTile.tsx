import type { ReactNode } from 'react';

export interface StatTileProps {
  value: ReactNode;
  label: ReactNode;
}

/** Big tabular number over a small label. Numbers never jitter in width. */
export function StatTile({ value, label }: StatTileProps) {
  return (
    <div className="ui-stat">
      <span className="ui-stat-value">{value}</span>
      <span className="ui-stat-label">{label}</span>
    </div>
  );
}
