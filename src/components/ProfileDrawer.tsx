import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Icon, type IconName } from './ui';

export interface DrawerStats {
  matches: number;
  wins: number;
  bestBreak: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  stats: DrawerStats | null;
  firstPlayedAt: number | null;
}

interface Item {
  icon: IconName;
  label: string;
  to: string;
  hint?: string;
  badge?: string;
}

const PRIMARY: Item[] = [
  { icon: 'chart', label: 'My stats', to: '/stats', badge: 'New' },
  { icon: 'history', label: 'Match history', to: '/history' },
  { icon: 'users', label: 'Players & head-to-head', to: '/stats#head-to-head' },
  { icon: 'trophy', label: 'Records & milestones', to: '/stats#breaks' },
];

const SECONDARY: Item[] = [
  { icon: 'settings', label: 'Settings', to: '/settings', hint: 'Theme, colours, name' },
  { icon: 'download', label: 'Export & backup', to: '/settings#data' },
  { icon: 'info', label: 'About & feedback', to: '/settings#about' },
];

export default function ProfileDrawer({ open, onClose, stats, firstPlayedAt }: Props) {
  const { user, isGuest, signOut } = useAuth();
  const navigate = useNavigate();
  const closeRef = useRef<HTMLButtonElement>(null);

  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Guest';
  const avatarUrl: string | undefined = user?.user_metadata?.avatar_url;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  const logOut = async () => {
    if (!window.confirm(isGuest ? 'Leave guest mode? Your games stay on this phone.' : 'Log out of SnookerBee?')) return;
    await signOut();
    navigate('/');
  };

  const since = firstPlayedAt
    ? new Date(firstPlayedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className={`pd-root${open ? ' is-open' : ''}`} aria-hidden={!open}>
      <div className="pd-scrim" onClick={onClose} />
      <nav className="pd-panel" aria-label="Profile menu" inert={!open}>
        <div className="pd-head">
          {avatarUrl ? (
            <img className="pd-avatar" src={avatarUrl} alt="" />
          ) : (
            <span className="pd-avatar pd-avatar--initials">{name.charAt(0).toUpperCase()}</span>
          )}
          <div className="pd-id">
            <span className="pd-name">{name}</span>
            {user?.email && <span className="pd-sub pd-email">{user.email}</span>}
            {isGuest && <span className="pd-sub">Guest · games saved on this phone</span>}
            {since && <span className="pd-sub">Playing since {since}</span>}
          </div>
          <button ref={closeRef} type="button" className="pd-close" onClick={onClose} aria-label="Close menu">
            <Icon name="close" size={16} />
          </button>
        </div>

        {stats && (
          <div className="pd-chips">
            <span className="pd-chip"><b>{stats.matches}</b>matches</span>
            <span className="pd-chip"><b>{stats.wins}</b>wins</span>
            <span className="pd-chip pd-chip--accent"><b>{stats.bestBreak}</b>best break</span>
          </div>
        )}

        <div className="pd-scroll">
          <ul className="pd-list">
            {PRIMARY.map((item) => (
              <li key={item.label}>
                <button type="button" className="pd-item" onClick={() => go(item.to)}>
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                  {item.badge && <span className="pd-badge">{item.badge}</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="pd-rule" />
          <ul className="pd-list">
            {SECONDARY.map((item) => (
              <li key={item.label}>
                <button type="button" className="pd-item" onClick={() => go(item.to)}>
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                  {item.hint && <span className="pd-hint">{item.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="pd-foot">
          <button type="button" className="pd-logout" onClick={() => { void logOut(); }}>
            <Icon name="logout" size={18} />
            {isGuest ? 'Leave guest mode' : 'Log out'}
          </button>
          <span className="pd-version">v{__APP_VERSION__}</span>
        </div>
      </nav>
    </div>
  );
}
