import { useState, useEffect } from 'react';
import { Icon } from './ui';

/**
 * The phone's clock, plus when the current frame began.
 *
 * Durations are derived by subtracting timestamps in the reducer, so nothing
 * here drives the match record — this is display only, and it is deliberately
 * the cheapest display possible.
 *
 * A clock showing hours and minutes only needs to change once a minute, so it
 * schedules a single timeout to the next minute boundary and re-arms. That is
 * one render a minute against the sixty a second-resolution counter cost, and
 * the wake is aligned to the boundary rather than drifting a second at a time.
 * It also refreshes on visibilitychange, so coming back to a backgrounded app
 * never shows a stale time.
 */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer = 0;

    const schedule = () => {
      // +250ms so we land just after the boundary, never just before it.
      const untilNextMinute = 60_000 - (Date.now() % 60_000) + 250;
      timer = window.setTimeout(() => {
        setNow(new Date());
        schedule();
      }, untilNextMinute);
    };

    schedule();

    const onVisible = () => {
      if (!document.hidden) setNow(new Date());
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return now;
}

const timeOfDay = (d: Date) =>
  d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function WallClock({ frameStartTime }: { frameStartTime: string }) {
  const now = useMinuteClock();
  const started = Date.parse(frameStartTime);

  return (
    <div className="wall-clock">
      <span className="wall-clock-now">{timeOfDay(now)}</span>
      {Number.isFinite(started) && (
        <span className="wall-clock-since">
          <Icon name="clock" size={11} /> from {timeOfDay(new Date(started))}
        </span>
      )}
    </div>
  );
}
