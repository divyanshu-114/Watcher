// Left sidebar: brand, today progress ring, views, tags and the focus pill
import { Icon } from './common.jsx';
import { VIEWS } from '../lib/views.js';
import { addDays, daysBetween, parseDue, startOfDay } from '../lib/dates.js';
import { allTags } from '../lib/store.js';
import { useFocus } from '../lib/hooks.js';

const RING = 2 * Math.PI * 18;

function NavItem({ view, current, icon, label, count, alert, onSelect }) {
  return (
    <button className={`nav-item${current === view ? ' active' : ''}`} onClick={() => onSelect(view)}>
      <Icon name={icon} /><span>{label}</span>
      {count !== undefined && <em className={alert ? 'alert' : ''}>{count || ''}</em>}
    </button>
  );
}

function FocusPill({ onOpen }) {
  const focus = useFocus();
  const isBreak = focus.phase === 'break';
  return (
    <button className={`focus-pill${focus.running ? ' running' : ''}${isBreak ? ' break' : ''}`} onClick={onOpen} title="Focus timer (F)">
      <Icon name="focus" /><span>{focus.active ? `${isBreak ? 'Break' : 'Focus'} ${focus.clock}` : 'Focus'}</span>
    </button>
  );
}

export default function Sidebar({ tasks, stats, now, view, onSelect, onFocus, onPalette, onSettings }) {
  const { open, overdue, today, upcoming } = stats;
  const tags = allTags(tasks);

  // Progress = what was due by tonight: still open, plus finished today
  const endOfToday = startOfDay(addDays(now, 1));
  const doneToday = tasks.filter(t => t.done && t.due && parseDue(t.due) < endOfToday && t.completedAt && daysBetween(new Date(t.completedAt), now) === 0).length;
  const totalToday = today.length + overdue.length + doneToday;

  const nav = (key, extra) => (
    <NavItem view={key} current={view} icon={VIEWS[key].icon} label={key === 'stats' ? 'Insights' : VIEWS[key].title} onSelect={onSelect} {...extra} />
  );

  return (
    <aside className="sidebar">
      <div className="brand drag">
        <span className="brand-mark"><Icon name="logo" /></span>
        <span className="brand-name">Deadline Desk</span>
      </div>

      <div className="today-card">
        <svg className="ring" viewBox="0 0 44 44" aria-hidden="true">
          <circle className="ring-track" cx="22" cy="22" r="18" />
          <circle className="ring-fill" cx="22" cy="22" r="18"
            style={{ strokeDasharray: RING, strokeDashoffset: totalToday ? RING * (1 - doneToday / totalToday) : RING }} />
        </svg>
        <div>
          <div className="today-card-title">{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}</div>
          <div className="today-card-sub">
            {totalToday ? `${doneToday}/${totalToday} done${overdue.length ? ` · ${overdue.length} late` : ''}` : 'Nothing due today'}
          </div>
        </div>
      </div>

      <nav className="nav" aria-label="Views">
        {nav('today', { count: today.length + overdue.length, alert: overdue.length > 0 })}
        {nav('upcoming', { count: upcoming.length })}
        {nav('all', { count: open.length })}
        {nav('completed', { count: tasks.length - open.length })}
        <div className="nav-sep" />
        {nav('calendar')}
        {nav('stats')}
      </nav>

      <div className="nav-label">Tags</div>
      <nav className="nav tags-nav" aria-label="Tags">
        {tags.length
          ? tags.map(([tag, n]) => <NavItem key={tag} view={`tag:${tag}`} current={view} icon="tag" label={tag} count={n} onSelect={onSelect} />)
          : <p className="tags-empty">Type #tag in quick add</p>}
      </nav>

      <div className="sidebar-foot">
        <FocusPill onOpen={onFocus} />
        <button className="icon-btn" onClick={onPalette} title="Command palette (⌘K)"><Icon name="command" /></button>
        <button className="icon-btn" onClick={onSettings} title="Settings (⌘,)"><Icon name="settings" /></button>
      </div>
    </aside>
  );
}
