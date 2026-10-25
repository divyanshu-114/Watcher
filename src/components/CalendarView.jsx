// Month calendar with drag-and-drop rescheduling
import { useState } from 'react';
import { Icon } from './common.jsx';
import { TaskList } from './TaskList.jsx';
import { addDays, dayKey, parseDue, startOfDay, toLocalInput } from '../lib/dates.js';
import { getTask, updateTask } from '../lib/store.js';
import { toast } from '../lib/toast.js';

const WEEKDAYS = Array.from({ length: 7 }, (_, i) => addDays(new Date(2024, 0, 1), i)   // 1 Jan 2024 was a Monday
  .toLocaleDateString([], { weekday: 'short' }));

const keyToDate = key => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export default function CalendarView({ tasks, now, selectedDay, onSelectDay, selectedId, actions }) {
  const [month, setMonth] = useState(() => {
    const d = keyToDate(selectedDay);
    d.setDate(1);
    return d;
  });
  const [dropKey, setDropKey] = useState(null);

  const shiftMonth = delta => setMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  const goToday = () => {
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    onSelectDay(dayKey(now));
  };

  // Bucket tasks by day
  const byDay = new Map();
  tasks.filter(t => t.due).forEach(t => {
    const key = dayKey(parseDue(t.due));
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(t);
  });
  byDay.forEach(list => list.sort((a, b) => a.done - b.done || parseDue(a.due) - parseDue(b.due)));

  // The grid starts on the Monday on/before the 1st and always shows 6 weeks
  const first = addDays(month, -((month.getDay() + 6) % 7));
  const todayKey = dayKey(now);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i));

  // Drag a task chip onto another day: keeps the time, changes the date
  const onDrop = (e, key) => {
    e.preventDefault();
    setDropKey(null);
    const task = getTask(e.dataTransfer.getData('text/plain'));
    if (!task) return;
    const target = keyToDate(key);
    const due = parseDue(task.due);
    due.setFullYear(target.getFullYear(), target.getMonth(), target.getDate());
    updateTask(task.id, { due: toLocalInput(due) });
    onSelectDay(key);
    toast(`Moved “${task.title}” to ${due.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}`);
  };

  const selectedDate = keyToDate(selectedDay);
  const selectedLabel = selectedDate.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <div className="cal-head">
        <h2>{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h2>
        <div className="cal-nav">
          <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month"><Icon name="left" /></button>
          <button className="btn ghost small" onClick={goToday}>Today</button>
          <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month"><Icon name="right" /></button>
        </div>
      </div>

      <div className="cal-weekdays">{WEEKDAYS.map(d => <div key={d}>{d}</div>)}</div>
      <div className="cal-grid">
        {cells.map(day => {
          const key = dayKey(day);
          const list = byDay.get(key) || [];
          const classes = ['cal-cell',
            day.getMonth() !== month.getMonth() && 'other',
            key === todayKey && 'today',
            key === selectedDay && 'selected',
            key === dropKey && 'drop'].filter(Boolean).join(' ');
          return (
            <div
              key={key}
              className={classes}
              onClick={() => onSelectDay(key)}
              onDragOver={e => { e.preventDefault(); setDropKey(key); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropKey(k => (k === key ? null : k)); }}
              onDrop={e => onDrop(e, key)}
            >
              <span className="cal-num">{day.getDate()}</span>
              {list.slice(0, 3).map(t => (
                <div
                  key={t.id}
                  className={`cal-chip ${t.priority}${t.done ? ' done' : ''}`}
                  draggable={!t.done}
                  title={t.title}
                  onDragStart={e => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; }}
                  onClick={e => { e.stopPropagation(); actions.open(t.id); }}
                >
                  {t.title}
                </div>
              ))}
              {list.length > 3 && <div className="cal-more">+{list.length - 3} more</div>}
            </div>
          );
        })}
      </div>
      <p className="hint">Drag a task onto another day to reschedule it. Click a day to see its tasks.</p>

      <div className="cal-day">
        <TaskList
          groups={[{ key: 'day', label: selectedLabel, tasks: byDay.get(selectedDay) || [], showEmpty: true }]}
          now={now}
          selectedId={selectedId}
          actions={actions}
          emptyText={`Nothing due on ${selectedLabel}.`}
        />
      </div>
    </>
  );
}
