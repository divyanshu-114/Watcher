// Right-hand details panel for one task. Mounted with key={task.id}, so drafts reset per task.
import { useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './common.jsx';
import * as store from '../lib/store.js';
import { addDays, atTime, relative, toLocalInput, END_OF_DAY } from '../lib/dates.js';

const fmt = iso => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export default function TaskDrawer({ task: t, onClose, onComplete, onFocus, onDelete }) {
  const [title, setTitle] = useState(t.title);
  const [tags, setTags] = useState(t.tags.join(', '));
  const [step, setStep] = useState('');
  const titleRef = useRef(null);
  const edit = patch => store.updateTask(t.id, patch);

  // Grow the title box to fit its text
  useLayoutEffect(() => {
    const el = titleRef.current;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  const setDueShortcut = which => {
    if (which === 'clear') return edit({ due: '', repeat: 'none' });
    const time = t.due ? t.due.slice(11) : END_OF_DAY;
    edit({ due: toLocalInput(atTime(addDays(new Date(), { today: 0, tomorrow: 1, week: 7 }[which]), time)) });
  };

  const commitTags = () => {
    const list = [...new Set(tags.split(/[,\s]+/).map(s => s.replace(/^#/, '').toLowerCase()).filter(Boolean))];
    setTags(list.join(', '));
    edit({ tags: list });
  };

  const subDone = t.subtasks.filter(s => s.done).length;
  const kicker = t.done ? 'Completed'
    : store.isOverdue(t) ? `Overdue by ${relative(t.due).replace(' overdue', '')}`
    : t.due ? `Due ${relative(t.due)}` : 'No deadline';

  return (
    <aside className="drawer" aria-label="Task details">
      <div className="drawer-head">
        <button className={`check big ${t.priority}${t.done ? ' on' : ''}`} onClick={() => onComplete(t.id)} aria-label="Toggle done" />
        <span className="drawer-kicker">{kicker}</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close details"><Icon name="close" /></button>
      </div>

      <textarea
        ref={titleRef}
        className="d-title"
        rows={1}
        maxLength={200}
        aria-label="Task title"
        value={title}
        onChange={e => {
          const value = e.target.value.replace(/\n/g, ' ');
          setTitle(value);
          if (value.trim()) edit({ title: value });
        }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
      />

      <div className="field">
        <label htmlFor="dDue">Due</label>
        <input id="dDue" type="datetime-local" value={t.due} onChange={e => edit({ due: e.target.value })} />
        <div className="chips">
          <button className="chip" onClick={() => setDueShortcut('today')}>Today</button>
          <button className="chip" onClick={() => setDueShortcut('tomorrow')}>Tomorrow</button>
          <button className="chip" onClick={() => setDueShortcut('week')}>Next week</button>
          <button className="chip" onClick={() => setDueShortcut('clear')}>No date</button>
        </div>
      </div>

      <div className="field">
        <label>Priority</label>
        <div className="segmented priority">
          {['low', 'medium', 'high'].map(p => (
            <button key={p} data-p={p} className={t.priority === p ? 'on' : ''} onClick={() => edit({ priority: p })}>
              {p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="field two">
        <div>
          <label htmlFor="dRepeat">Repeat</label>
          <select
            id="dRepeat"
            value={t.repeat}
            onChange={e => {
              const patch = { repeat: e.target.value };
              // Repeating tasks need a start date
              if (e.target.value !== 'none' && !t.due) patch.due = toLocalInput(atTime(new Date(), END_OF_DAY));
              edit(patch);
            }}
          >
            <option value="none">Never</option>
            <option value="daily">Every day</option>
            <option value="weekdays">Every weekday</option>
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
          </select>
        </div>
        <div>
          <label htmlFor="dTags">Tags</label>
          <input id="dTags" type="text" placeholder="college, project" value={tags}
            onChange={e => setTags(e.target.value)} onBlur={commitTags}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        </div>
      </div>

      <div className="field">
        <label>Checklist <span className="muted">{t.subtasks.length ? `${subDone}/${t.subtasks.length}` : ''}</span></label>
        {t.subtasks.length > 0 && (
          <div className="progress"><span style={{ width: `${(100 * subDone) / t.subtasks.length}%` }} /></div>
        )}
        <ul className="subtasks">
          {t.subtasks.map(s => (
            <li key={s.id} className={s.done ? 'done' : ''}>
              <button className={`check${s.done ? ' on' : ''}`} onClick={() => store.toggleSubtask(t.id, s.id)} aria-label="Toggle step" />
              <span>{s.title}</span>
              <button className="icon-btn" onClick={() => store.deleteSubtask(t.id, s.id)} aria-label="Delete step"><Icon name="close" /></button>
            </li>
          ))}
        </ul>
        <form className="sub-add" onSubmit={e => { e.preventDefault(); store.addSubtask(t.id, step); setStep(''); }}>
          <Icon name="plus" />
          <input type="text" placeholder="Add a step" maxLength={160} aria-label="New checklist step"
            value={step} onChange={e => setStep(e.target.value)} />
        </form>
      </div>

      <div className="field">
        <label htmlFor="dNotes">Notes</label>
        <textarea id="dNotes" rows={5} placeholder="Links, details, ideas…" value={t.notes}
          onChange={e => edit({ notes: e.target.value })} />
      </div>

      <p className="d-meta">
        Created {fmt(t.createdAt)}
        {t.completedAt && <><br />Completed {fmt(t.completedAt)}</>}
        {t.focusMinutes > 0 && <><br />{t.focusMinutes} minutes of focus</>}
      </p>

      <div className="drawer-actions">
        {!t.done ? <button className="btn" onClick={() => onFocus(t.id)}><Icon name="focus" />Focus on this</button> : <span />}
        <button className="btn danger" onClick={() => onDelete(t.id)}><Icon name="trash" />Delete</button>
      </div>
    </aside>
  );
}
