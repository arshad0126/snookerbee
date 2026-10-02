import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHANGELOG, CURRENT_VERSION } from '../changelog';
import { markReleaseSeen } from '../lib/releaseSeen';
import ThemeBackdrop from './ThemeBackdrop';
import { Icon } from './ui';

const SECTIONS = [
  { key: 'added', label: 'New' },
  { key: 'improved', label: 'Better' },
  { key: 'fixed', label: 'Fixed' },
] as const;

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function WhatsNew() {
  const navigate = useNavigate();

  // Opening this page clears the "new update" dot.
  useEffect(() => { markReleaseSeen(); }, []);

  return (
    <div className="st-page">
      <ThemeBackdrop />
      <header className="st-header">
        <button type="button" className="st-back" onClick={() => navigate(-1)} aria-label="Back">
          <Icon name="arrow-left" size={18} />
        </button>
        <div className="ms-titles">
          <h1 className="st-title">What's new</h1>
          <span className="ms-sub">You're on version {CURRENT_VERSION}</span>
        </div>
      </header>

      <main className="st-body wn-list">
        {CHANGELOG.map((r, i) => (
          <article key={r.version} className={`st-section wn-release${i === 0 ? ' is-current' : ''}`}>
            <div className="wn-head">
              <span className="wn-version">v{r.version}</span>
              {i === 0 && <span className="wn-current">Current</span>}
              <span className="wn-date">{formatDate(r.date)}</span>
            </div>
            <h2 className="st-h2">{r.title}</h2>
            {SECTIONS.map(({ key, label }) => {
              const items = r[key];
              if (!items || items.length === 0) return null;
              return (
                <div key={key} className="wn-group">
                  <span className={`wn-tag wn-tag--${key}`}>{label}</span>
                  <ul className="wn-items">
                    {items.map((t) => <li key={t}>{t}</li>)}
                  </ul>
                </div>
              );
            })}
          </article>
        ))}
      </main>
    </div>
  );
}
