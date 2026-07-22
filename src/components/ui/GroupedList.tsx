import type { HTMLAttributes, ReactNode } from 'react';

export interface GroupedListProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
}

export function GroupedList({ header, children, className, ...rest }: GroupedListProps) {
  return (
    <div className={className}>
      {header !== undefined && <div className="ui-list-header">{header}</div>}
      <div className="ui-list" {...rest}>{children}</div>
    </div>
  );
}

export interface ListRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  /** Trailing value text (e.g. "12–4"). */
  value?: ReactNode;
  /** Show a chevron (implies navigational). */
  chevron?: boolean;
  onClick?: () => void;
}

export function ListRow({
  title, subtitle, leading, value, chevron, onClick,
}: ListRowProps) {
  const interactive = typeof onClick === 'function';
  const content = (
    <>
      {leading !== undefined && <span className="ui-row-lead">{leading}</span>}
      <span className="ui-row-content">
        <span className="ui-row-title">{title}</span>
        {subtitle !== undefined && <span className="ui-row-subtitle">{subtitle}</span>}
      </span>
      {value !== undefined && <span className="ui-row-value numeric">{value}</span>}
      {chevron && (
        <span className="ui-row-chevron" aria-hidden="true">
          <ChevronRight />
        </span>
      )}
    </>
  );

  if (interactive) {
    return (
      <button type="button" className="ui-row" onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className="ui-row">{content}</div>;
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
