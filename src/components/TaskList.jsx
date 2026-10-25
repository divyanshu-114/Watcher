// Grouped task list and a single task row
import { useState } from 'react';
import { Icon, Highlight } from './common.jsx';
import { formatDue, parseDue, relative } from '../lib/dates.js';
import { isOverdue } from '../lib/store.js';

export function TaskRow({ task: t, now, query, selected, actions }) {
  const [leaving, setLeaving] = useState(false);
  const overdue = isOverdue(t, now);
  const soon = !t.done && t.due && !overdue && parseDue(t.due) - now < 24 * 3600 * 1000;
  const subDone = t.subtasks.filter(s => s.done).length;
  const tagQuery = query.replace(/^#/, '');

  // Completing plays a short exit animation first
  const onCheck = e => {
    e.stopPropagation();
    if (t.done) return actions.complete(t.id);
    setLeaving(true);
    setTimeout(() => {
      actions.complete(t.id);
      setLeaving(false);   // the row may stay visible (e.g. under "Done today")
    }, 380);
  };

  return (
    <li
      className={`task ${t.priority}${t.done ? ' done' : ''}${selected ? ' selected' : ''}${leaving ? ' leaving' : ''}`}
      onClick={() => actions.open(t.id)}
    >
      <button className={`check${t.done || leaving ? ' on' : ''}`} onClick={onCheck}
        aria-label={t.done ? 'Mark as not done' : 'Mark as done'} />
      <div className="body">
        <div className="title"><Highlight text={t.title} query={query} /></div>
        <div className="meta">
          {t.due && (
            <span className={`due${overdue ? ' overdue' : soon ? ' soon' : ''}`}><Icon name="calendar" />{formatDue(t.due)}</span>
          )}
          {t.due && !t.done && <span className="countdown">{relative(t.due, now)}</span>}
          {t.repeat !== 'none' && <span title="Repeats"><Icon name="repeat" />{t.repeat}</span>}
          {t.subtasks.length > 0 && <span><Icon name="subtasks" />{subDone}/{t.subtasks.length}</span>}
          {t.notes && <span title="Has notes"><Icon name="note" /></span>}
          {t.focusMinutes > 0 && <span title="Time focused"><Icon name="focus" />{t.focusMinutes}m</span>}
          {t.tags.map(tag => <span key={tag} className="tag">#<Highlight text={tag} query={tagQuery} /></span>)}
        </div>
      </div>
      <div className="actions">
        {!t.done && (
          <button className="icon-btn" title="Focus on this" onClick={e => { e.stopPropagation(); actions.focus(t.id); }}>
            <Icon name="play" />
          </button>
        )}
        <button className="icon-btn del" title="Delete" onClick={e => { e.stopPropagation(); actions.remove(t.id); }}>
          <Icon name="trash" />
        </button>
      </div>
    </li>
  );
}

export function TaskList({ groups, now, query = '', selectedId, actions, emptyText }) {
  const visible = groups.filter(g => g.tasks.length || g.showEmpty);
  const total = groups.reduce((n, g) => n + g.tasks.length, 0);
  return (
    <>
      {visible.map(g => (
        <section key={g.key} className="group">
          <div className={`group-head${g.key === 'overdue' ? ' overdue' : ''}`}>{g.label} <em>{g.tasks.length || ''}</em></div>
          <ul className="list">
            {g.tasks.map(t => (
              <TaskRow key={t.id} task={t} now={now} query={query} selected={t.id === selectedId} actions={actions} />
            ))}
          </ul>
        </section>
      ))}
      {!total && emptyText && <p className="hint">{emptyText}</p>}
    </>
  );
}
