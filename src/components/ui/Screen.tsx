import {
  useRef, useState, type ReactNode, type UIEvent,
} from 'react';

export interface ScreenProps {
  /** Large title shown at the top; collapses into the nav bar on scroll. */
  title: string;
  /** Leading nav element (e.g. a back button). */
  navLeading?: ReactNode;
  /** Single trailing nav action. */
  navTrailing?: ReactNode;
  children: ReactNode;
}

const COLLAPSE_AT = 20; // px scrolled before the large title hands off to the nav

/**
 * Safe-area-aware page shell. The large title collapses to an inline nav-bar
 * title as the content scrolls, matching the iOS large-title pattern.
 */
export function Screen({ title, navLeading, navTrailing, children }: ScreenProps) {
  const [collapsed, setCollapsed] = useState(false);
  const ticking = useRef(false);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      setCollapsed(top > COLLAPSE_AT);
      ticking.current = false;
    });
  };

  return (
    <div className="ui-screen">
      <NavBar title={title} titleVisible={collapsed} leading={navLeading} trailing={navTrailing} />
      <div className="ui-screen-scroll" onScroll={onScroll}>
        <div className="ui-screen-body">
          <h1 className={`ui-large-title type-large-title ${collapsed ? 'is-collapsed' : ''}`}>
            {title}
          </h1>
          {children}
        </div>
      </div>
    </div>
  );
}

export interface NavBarProps {
  title?: string;
  titleVisible?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function NavBar({ title, titleVisible = true, leading, trailing }: NavBarProps) {
  return (
    <div className="ui-navbar">
      {leading && <div className="ui-navbar-lead">{leading}</div>}
      {title && (
        <div className={`ui-navbar-title ${titleVisible ? 'is-visible' : ''}`}>{title}</div>
      )}
      {trailing && <div className="ui-navbar-trail">{trailing}</div>}
    </div>
  );
}

export interface BackButtonProps {
  label?: string;
  onClick: () => void;
}

export function BackButton({ label = 'Back', onClick }: BackButtonProps) {
  return (
    <button type="button" className="ui-navbar-back" onClick={onClick}>
      <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
        <path d="M10 2L2 10l8 8" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  );
}
