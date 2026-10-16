import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActionLogEntry } from '../engine/types';
import { buildFrameVisits } from '../lib/frameVisits';
import type { FrameSide, FrameVisit, VisitBall, VisitMark } from '../lib/frameVisits';
import { Icon } from './ui';

/**
 * The frame log: a centred scoresheet with one row per visit. The running
 * score runs down the left, the player and the balls they potted sit in the
 * middle, and the points for the visit on the right.
 */

interface ActionLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  actionLog: ActionLogEntry[];
  /** Scoring sides, in turn order (players, or teams in team mode). */
  sides: FrameSide[];
  /** Player at the table now; null once the frame is over. */
  currentPlayerName: string | null;
  isOver: boolean;
  /** "Frame 2", "Century 50" — shown as "Timeline · Frame 2". */
  title: string;
}

const MAX_CHIPS = 10;

function Chips({ balls }: { balls: VisitBall[] }) {
  const shown = balls.length > MAX_CHIPS ? balls.slice(0, MAX_CHIPS - 1) : balls;
  const rest = balls.length - shown.length;
  return (
    <span
      className="flog-chips"
      aria-label={balls.map((b) => (b.undone ? `${b.ball} (undone)` : b.ball)).join(', ')}
    >
      {shown.map((b, i) => (
        <span
          key={i}
          className={`flog-chip flog-chip--${b.ball}${b.freeBall ? ' is-free' : ''}${b.undone ? ' is-undone' : ''}`}
          title={`${b.ball}${b.freeBall ? ' (free ball)' : ''}${b.undone ? ' (undone)' : ''}`}
        />
      ))}
      {rest > 0 && <span className="flog-chip-more">+{rest}</span>}
    </span>
  );
}

function MarkLine({ mark }: { mark: VisitMark }) {
  return (
    <span className={`flog-mark flog-mark--${mark.kind}`}>
      <Icon name={mark.kind === 'undo' ? 'arrow-left' : 'arrow-right'} size={11} />
      <span>
        {mark.kind === 'undo' ? 'Undone' : 'Redone'} · {mark.text}
      </span>
    </span>
  );
}

/**
 * Undo / Redo notes for a visit. One shows as its own line; two or more fold
 * into "2 undos · 1 redo", tap to show them all.
 */
function Marks({
  marks,
  open,
  onToggle,
}: {
  marks: VisitMark[];
  open: boolean;
  onToggle: () => void;
}) {
  if (marks.length === 0) return null;
  if (marks.length === 1) return <MarkLine mark={marks[0]} />;

  const undos = marks.filter((m) => m.kind === 'undo').length;
  const redos = marks.length - undos;
  const parts = [
    undos ? `${undos} ${undos === 1 ? 'undo' : 'undos'}` : '',
    redos ? `${redos} ${redos === 1 ? 'redo' : 'redos'}` : '',
  ].filter(Boolean);

  return (
    <>
      <button
        type="button"
        className="flog-mark flog-mark-toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <Icon name="arrow-left" size={11} />
        <span>{parts.join(' · ')}</span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={11} />
      </button>
      {open && marks.map((m, i) => <MarkLine key={i} mark={m} />)}
    </>
  );
}

const minus = (n: number) => `−${Math.abs(n)}`;

function foulText(v: FrameVisit): string {
  const f = v.foul;
  if (!f) return '';
  if (v.note) return v.note;
  const what = f.inOff ? 'In-off' : f.ball ? `Foul on ${f.ball}` : 'Foul';
  if (f.to.length === 0) return what;
  const who = f.to.length > 1 ? 'each opponent' : f.to[0];
  return `${what} · ${f.penalty} to ${who}`;
}

export default function ActionLogDrawer({
  isOpen,
  onClose,
  actionLog,
  sides,
  currentPlayerName,
  isOver,
  title,
}: ActionLogDrawerProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  // Visits whose undo / redo list is expanded, by visit number.
  const [openMarks, setOpenMarks] = useState<Set<number>>(() => new Set());
  const toggleMarks = (n: number) =>
    setOpenMarks((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const { visits, visitCount } = useMemo(
    () => buildFrameVisits({ actionLog, sides, currentPlayerName, isOver }),
    [actionLog, sides, currentPlayerName, isOver],
  );

  // Newest row in view on open and whenever one is added.
  useEffect(() => {
    const el = listRef.current;
    if (isOpen && el) el.scrollTop = el.scrollHeight;
  }, [isOpen, visits]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const headToHead = sides.length === 2;
  const meta = headToHead
    ? `${sides[0].name} – ${sides[1].name}`
    : `${sides.length} players · ${visitCount} ${visitCount === 1 ? 'visit' : 'visits'}`;

  const score = (v: FrameVisit) => {
    const quiet = v.live || v.kind === 'end' || v.changed.length === 0;
    if (headToHead) {
      return (
        <span className={`flog-score${quiet ? ' is-quiet' : ''}`}>
          {sides.map((s, i) => (
            <span key={s.name}>
              {i > 0 && '–'}
              <span
                className={
                  !quiet && v.changed.includes(s.name)
                    ? v.highest && s.name === v.side
                      ? 'is-moved is-high'
                      : 'is-moved'
                    : undefined
                }
              >
                {v.totals[s.name] ?? 0}
              </span>
            </span>
          ))}
        </span>
      );
    }
    if (v.kind === 'end') return <span className="flog-score is-quiet" />;
    return (
      <span className={`flog-score${quiet ? ' is-quiet' : ''}${v.highest ? ' is-high' : ''}`}>
        {v.totals[v.side] ?? 0}
      </span>
    );
  };

  const points = (v: FrameVisit) => {
    if (v.foul && v.foul.to.length > 0 && v.points <= 0) {
      return <span className="flog-pts is-foul">{v.foul.penalty}</span>;
    }
    if (v.points < 0) return <span className="flog-pts is-foul">{minus(v.points)}</span>;
    if (v.points > 0) {
      return <span className={`flog-pts${v.highest ? ' is-high' : ''}`}>+{v.points}</span>;
    }
    return <span className="flog-pts" />;
  };

  const body = (v: FrameVisit) => {
    if (v.kind === 'end') {
      return <span className="flog-line2">{v.note}</span>;
    }
    const empty = v.live && v.balls.length === 0 && !v.foul && v.marks.length === 0;
    if (empty) {
      return (
        <>
          <span className="flog-name is-live">
            {v.player} {visitCount === 0 ? 'to break' : 'at the table'}
          </span>
          {visitCount === 0 && (
            <span className="flog-line2">Each visit will appear here as you score.</span>
          )}
        </>
      );
    }
    return (
      <>
        <span className="flog-name">
          {v.player}
          {v.side !== v.player && <span className="flog-team">{v.side}</span>}
          {v.highest && <span className="flog-tag">Highest break</span>}
          {v.live && <span className="flog-tag">At the table</span>}
        </span>
        {v.balls.length > 0 && <Chips balls={v.balls} />}
        {v.foul && <span className="flog-line2 is-foul">{foulText(v)}</span>}
        {!v.foul && v.missed && (
          <span className="flog-line2">{v.number === 1 ? 'Break-off, missed' : 'Missed'}</span>
        )}
        {!v.foul && v.note && <span className="flog-line2">{v.note}</span>}
        <Marks
          marks={v.marks}
          open={openMarks.has(v.number)}
          onToggle={() => toggleMarks(v.number)}
        />
      </>
    );
  };

  const ruleClass = (v: FrameVisit) =>
    v.live ? ' is-live' : v.foul ? ' is-foul' : v.highest ? ' is-high' : '';

  return (
    <div className="modal-backdrop modal-centered flog-backdrop" onClick={onClose}>
      <div
        className="flog"
        role="dialog"
        aria-modal="true"
        aria-label={`Timeline, ${title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flog-head">
          <h3 className="flog-title">
            Timeline <span className="flog-title-sep">·</span> {title}
          </h3>
          <span className="flog-meta">{meta}</span>
          <button type="button" onClick={onClose} className="flog-close" aria-label="Close timeline">
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="flog-row flog-cols" aria-hidden="true">
          <span>{headToHead ? 'Score' : 'Total'}</span>
          <span className="flog-cols-visit">Visit</span>
          <span className="flog-cols-pts">Pts</span>
        </div>

        <div
          ref={listRef}
          className={`flog-list${scrolled ? ' is-scrolled' : ''}`}
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}
        >
          {visits.map((v, i) => (
            <div key={i} className={`flog-row${v.kind === 'end' ? ' is-end' : ''}`}>
              {score(v)}
              <div className={`flog-visit${ruleClass(v)}`}>{body(v)}</div>
              {v.kind === 'end' ? <span className="flog-pts" /> : points(v)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
