import { useNavigate } from 'react-router-dom';
import ThemeBackdrop from './ThemeBackdrop';
import { Icon } from './ui';

/** About SnookerBee — who made it, and how to reach him. */

const WHATSAPP = '918826887725';
const GITHUB = 'arshad0126';

export default function About() {
  const navigate = useNavigate();
  const feedback = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hi Arshad, about SnookerBee (v${__APP_VERSION__}): `)}`;

  return (
    <div className="ms-page ab-page">
      <ThemeBackdrop />
      <header className="ms-header">
        <button type="button" className="st-back" onClick={() => navigate(-1)} aria-label="Back">
          <Icon name="arrow-left" size={18} />
        </button>
        <div className="ms-titles">
          <h1 className="st-title">About</h1>
        </div>
      </header>

      <main className="ab-grid">
        <section className="ms-card ab-maker" aria-label="Made by">
          <div className="ab-who">
            <span className="ab-avatar" aria-hidden="true">A</span>
            <div className="ab-who-text">
              <h2 className="ab-name">Arshad Khan</h2>
              <span className="ab-role">DevOps &amp; Cloud Engineer · Lucknow</span>
            </div>
          </div>
          <p className="ab-blurb">Made SnookerBee to keep score at our table. Built and looked after in my spare time.</p>
          <a className="ab-chip" href={`https://github.com/${GITHUB}`} target="_blank" rel="noreferrer">
            GitHub · {GITHUB}
          </a>
        </section>

        <section className="ms-card ab-app" aria-label="This app">
          <span className="ab-k">This app</span>
          <div className="ab-row"><span>Version</span><b>{__APP_VERSION__}</b></div>
          <button type="button" className="ab-row ab-link" onClick={() => navigate('/whats-new')}>
            <span>What's new</span><Icon name="arrow-right" size={16} />
          </button>
          <a className="ab-row ab-link" href={feedback} target="_blank" rel="noreferrer">
            <span>Send feedback on WhatsApp</span><Icon name="arrow-right" size={16} />
          </a>
        </section>
      </main>
    </div>
  );
}
