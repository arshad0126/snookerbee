import { toActionLog } from '../engine/century';
import {
  byFinish,
  formatCenturyDuration,
  type CenturyDetailsData,
} from '../lib/centuryHistory';
import { Icon } from './ui';

interface Props {
  game: CenturyDetailsData;
  onClose: () => void;
  onShare?: () => void;
}

export default function CenturyDetailsModal({ game, onClose, onShare }: Props) {
  const ordered = byFinish(game.players);
  const first = ordered.find((p) => p.finishedAt === 1);
  const log = game.actionLog ? toActionLog(game.actionLog) : null;

  return (
    <div className="modal-backdrop modal-centered" onClick={onClose}>
      <div className="ma-sheet" onClick={(e) => e.stopPropagation()}>
        <header className="ma-header">
          <div>
            <h3 className="ma-title">Century</h3>
            <span className="ma-date">{game.date}</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close century game">
            <Icon name="close" size={20} />
          </button>
        </header>

        <div className="ma-body">
          <div className="ma-result">
            <div className="ma-result-top">
              <Icon name="trophy" size={26} className="ma-result-trophy" />
              <div className="ma-result-names">
                <span className="ma-result-label">First out</span>
                <span className="ma-result-name">{first?.name ?? '—'}</span>
              </div>
            </div>

            <div className="ma-meta-row">
              <span className="ma-meta"><Icon name="clock" size={14} />{formatCenturyDuration(game.durationMs)}</span>
              <span className="ma-meta"><Icon name="target" size={14} />Target {game.target}</span>
              <span className="ma-meta"><Icon name="ball" size={14} />Red {game.redValue}</span>
            </div>

            {onShare && (
              <button className="ma-share" onClick={onShare}>
                <Icon name="share" size={17} />
                Share Result Card
              </button>
            )}
          </div>

          <section className="ma-section">
            <h4 className="ma-section-title">Finishing Order</h4>
            <div className="ma-players">
              {ordered.map((p) => {
                const short = p.finishedAt === null;
                return (
                  <article key={p.name} className={`ma-player${p.finishedAt === 1 ? ' is-winner' : ''}`}>
                    <div className="ma-player-head">
                      <span className="ma-team">{short ? 'Short' : `#${p.finishedAt}`}</span>
                      <span className="ma-player-name">{p.name}</span>
                      <span className="ma-player-score">{p.score}</span>
                    </div>
                    <div className="ma-stats">
                      <div className="ma-stat"><b>{p.potted}</b><span>Pots</span></div>
                      <div className="ma-stat"><b>{p.redsPotted}</b><span>Reds</span></div>
                      <div className="ma-stat">
                        <b className={p.redsMissed > 0 ? 'is-warn' : undefined}>{p.redsMissed}</b><span>Reds missed</span>
                      </div>
                      <div className="ma-stat">
                        <b className={p.fouls > 0 ? 'is-warn' : undefined}>{p.fouls}</b><span>Fouls</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="ma-section">
            <h4 className="ma-section-title">Event Timeline</h4>
            {!log ? (
              <p className="ma-empty">No event timeline for this game — it was played before timelines were saved.</p>
            ) : log.length === 0 ? (
              <p className="ma-empty">No shots recorded.</p>
            ) : (
              <ol className="ma-timeline">
                {log.map((entry, idx) => (
                  <li key={idx} className={`ma-event ma-event--${entry.type}`}>
                    <span className="ma-event-dot" />
                    <span className="ma-event-what">{entry.description}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
