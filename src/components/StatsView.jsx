// Insights: productivity numbers and a 14-day bar chart
import { useEffect, useRef, useState } from 'react';
import { addDays, dayKey, parseDue, startOfDay } from '../lib/dates.js';
import { allTags } from '../lib/store.js';

const DAYS = 14;
const fmtMinutes = m => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
const dayLabel = d => d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

function sumByDay(entries) {
  const map = new Map();
  entries.forEach(([key, n]) => map.set(key, (map.get(key) || 0) + n));
  return map;
}

// Consecutive days with at least one completion, counting back from today (or yesterday)
function streak(counts, now) {
  let day = startOfDay(now);
  if (!counts.get(dayKey(day))) day = addDays(day, -1);
  let n = 0;
  while (counts.get(dayKey(day))) { n++; day = addDays(day, -1); }
  return n;
}

const Tile = ({ label, value, note }) => (
  <div className="tile"><div className="tile-label">{label}</div><div className="tile-value">{value}</div><div className="tile-note">{note}</div></div>
);

function Meter({ label, value, max }) {
  return (
    <div className="meter-row">
      <span>{label}</span>
      <div className="meter"><span style={{ width: `${(100 * value) / max}%` }} /></div>
      <b>{value}</b>
    </div>
  );
}

function niceMax(max) {
  if (max <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / step) * step;
}

function BarChart({ series, format }) {
  const boxRef = useRef(null);
  const tipRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);   // { i, x, y }

  // Draw at the container's real width so text never stretches
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(boxRef.current);
    return () => observer.disconnect();
  }, []);

  // Keep the tooltip inside the chart at the left and right edges
  useEffect(() => {
    const tip = tipRef.current;
    if (!tip || !hover) return;
    const half = tip.offsetWidth / 2;
    tip.style.left = `${Math.min(Math.max(hover.x, half), width - half)}px`;
  }, [hover, width]);

  const W = Math.max(320, width), H = 200, padL = 30, padB = 22, padT = 10;
  const max = niceMax(Math.max(...series.map(s => s.value)));
  const plotH = H - padB - padT;
  const slot = (W - padL) / series.length;
  const barW = Math.min(28, slot - 2);   // at least a 2px gap between bars
  const y = v => padT + plotH - (v / max) * plotH;
  const base = padT + plotH;

  return (
    <div className="chart" ref={boxRef} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Bar chart">
          {[0, max / 2, max].map(v => (
            <g key={v}>
              <line className="gridline" x1={padL} x2={W} y1={y(v)} y2={y(v)} />
              <text className="axis-label" x={padL - 8} y={y(v) + 4} textAnchor="end">{Math.round(v)}</text>
            </g>
          ))}
          {series.map((s, i) => {
            const cx = padL + slot * i + slot / 2;
            const x = cx - barW / 2;
            const h = (s.value / max) * plotH;
            const r = Math.min(4, h, barW / 2);
            // Rounded data-end on top, square on the baseline
            const path = `M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + barW - r} Q${x + barW},${base - h} ${x + barW},${base - h + r} V${base} Z`;
            return (
              <g key={i}>
                <rect className="hit" x={padL + slot * i} y={padT} width={slot} height={plotH + padB}
                  onMouseMove={e => {
                    const box = boxRef.current.getBoundingClientRect();
                    setHover({ i, x: cx, y: e.clientY - box.top - 12 });
                  }} />
                {h > 0 && <path className={`bar${hover?.i === i ? ' hover' : ''}`} d={path} />}
                <text className="axis-label" x={cx} y={H - 4} textAnchor="middle">
                  {i === series.length - 1 ? 'Today' : s.date.getDate()}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover && (
        <div className="chart-tip" ref={tipRef} style={{ top: hover.y }}>
          {dayLabel(series[hover.i].date)} · <b>{format(series[hover.i].value)}</b>
        </div>
      )}
    </div>
  );
}

export default function StatsView({ tasks, focusLog, now }) {
  const [metric, setMetric] = useState('done');   // done | focus
  const [showTable, setShowTable] = useState(false);

  const done = sumByDay(tasks.filter(t => t.done && t.completedAt).map(t => [dayKey(new Date(t.completedAt)), 1]));
  const focus = sumByDay(focusLog.map(f => [f.date, f.minutes]));
  const today = startOfDay(now);
  const week = new Set(Array.from({ length: 7 }, (_, i) => dayKey(addDays(today, -i))));
  const weekSum = map => [...map].filter(([k]) => week.has(k)).reduce((s, [, v]) => s + v, 0);

  const doneCount = tasks.filter(t => t.done).length;
  const rate = tasks.length ? Math.round((100 * doneCount) / tasks.length) : 0;
  const finishedWithDue = tasks.filter(t => t.done && t.due && t.completedAt);
  const onTime = finishedWithDue.filter(t => new Date(t.completedAt) <= parseDue(t.due)).length;
  const days = streak(done, now);

  const series = Array.from({ length: DAYS }, (_, i) => {
    const date = addDays(today, i - DAYS + 1);
    return { date, value: (metric === 'done' ? done : focus).get(dayKey(date)) || 0 };
  });
  const format = v => (metric === 'done' ? `${v} task${v === 1 ? '' : 's'}` : fmtMinutes(v));

  const open = tasks.filter(t => !t.done);
  const byPriority = ['high', 'medium', 'low'].map(p => [p, open.filter(t => t.priority === p).length]);
  const maxP = Math.max(1, ...byPriority.map(([, n]) => n));
  const tags = allTags(tasks).slice(0, 5);
  const maxT = Math.max(1, ...tags.map(([, n]) => n));

  return (
    <>
      <div className="stat-tiles">
        <Tile label="Completed this week" value={weekSum(done)} note={`${doneCount} all time`} />
        <Tile label="Day streak" value={days} note={days ? 'Keep it going!' : 'Finish a task to start one'} />
        <Tile label="Focus this week" value={fmtMinutes(weekSum(focus))} note={`${focusLog.length} sessions all time`} />
        <Tile label="Completion rate" value={`${rate}%`}
          note={finishedWithDue.length ? `${Math.round((100 * onTime) / finishedWithDue.length)}% finished on time` : 'of all tasks'} />
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>{metric === 'done' ? 'Tasks completed' : 'Minutes focused'}</h3>
            <p>Last {DAYS} days</p>
          </div>
          <div className="segmented">
            <button className={metric === 'done' ? 'on' : ''} onClick={() => setMetric('done')}>Completed</button>
            <button className={metric === 'focus' ? 'on' : ''} onClick={() => setMetric('focus')}>Focus time</button>
          </div>
        </div>
        <BarChart series={series} format={format} />
        <button className="btn ghost small" onClick={() => setShowTable(s => !s)}>{showTable ? 'Hide table' : 'Show as table'}</button>
        {showTable && (
          <table className="data-table">
            <thead><tr><th>Day</th><th>{metric === 'done' ? 'Completed' : 'Focus'}</th></tr></thead>
            <tbody>
              {[...series].reverse().map(s => <tr key={s.date.getTime()}><td>{dayLabel(s.date)}</td><td>{format(s.value)}</td></tr>)}
            </tbody>
          </table>
        )}
      </div>

      <div className="split">
        <div className="card">
          <div className="card-head"><div><h3>Open tasks by priority</h3><p>{open.length} open</p></div></div>
          {byPriority.map(([p, n]) => (
            <Meter key={p} label={<><i className={`dot ${p}`} />{p[0].toUpperCase() + p.slice(1)}</>} value={n} max={maxP} />
          ))}
        </div>
        <div className="card">
          <div className="card-head"><div><h3>Busiest tags</h3><p>Open tasks per tag</p></div></div>
          {tags.length
            ? tags.map(([tag, n]) => <Meter key={tag} label={`#${tag}`} value={n} max={maxT} />)
            : <p className="muted small">Add #tags to tasks to see them here.</p>}
        </div>
      </div>
    </>
  );
}
