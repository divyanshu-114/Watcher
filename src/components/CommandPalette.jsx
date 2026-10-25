// Command palette (⌘K): search across commands and tasks
import { useEffect, useRef, useState } from 'react';
import { Icon, Highlight, Modal } from './common.jsx';
import { formatDue } from '../lib/dates.js';

// Every word of the query must appear somewhere in the text
const matches = (text, q) => q.split(/\s+/).every(word => text.toLowerCase().includes(word));

export default function CommandPalette({ tasks, commands, onOpenTask, onClose }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef(null);

  const q = query.trim().toLowerCase();
  const taskHits = q
    ? tasks
      .filter(t => matches(`${t.title} ${t.tags.map(x => '#' + x).join(' ')} ${t.notes}`, q))
      .sort((a, b) => a.done - b.done)
      .slice(0, 8)
    : [];
  const cmdHits = commands.filter(c => !q || matches(c.label, q));
  const results = [...taskHits.map(task => ({ task })), ...cmdHits];

  useEffect(() => {
    listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = r => {
    if (!r) return;
    onClose();
    if (r.task) onOpenTask(r.task.id);
    else r.run();
  };

  const onKeyDown = e => {
    if (e.key === 'ArrowDown') { setActive(a => Math.min(a + 1, results.length - 1)); e.preventDefault(); }
    if (e.key === 'ArrowUp') { setActive(a => Math.max(a - 1, 0)); e.preventDefault(); }
    if (e.key === 'Enter') { run(results[active]); e.preventDefault(); }
  };

  const row = (r, i) => (
    <li key={r.task ? r.task.id : r.label} className={i === active ? 'active' : ''}
      onMouseMove={() => i !== active && setActive(i)} onClick={() => run(r)}>
      {r.task ? (
        <>
          <Icon name={r.task.done ? 'completed' : 'all'} />
          <span className="label"><Highlight text={r.task.title} query={q.split(/\s+/)[0]} /></span>
          <small>{r.task.due ? formatDue(r.task.due) : ''}</small>
        </>
      ) : (
        <>
          <Icon name={r.icon} />
          <span className="label">{r.label}</span>
          {r.hint && <kbd>{r.hint}</kbd>}
        </>
      )}
    </li>
  );

  return (
    <Modal className="palette" label="Command palette" onClose={onClose} top showClose={false}>
      <label className="palette-input">
        <Icon name="search" />
        <input autoFocus type="text" placeholder="Search tasks or type a command…" aria-label="Command"
          value={query} onChange={e => { setQuery(e.target.value); setActive(0); }} onKeyDown={onKeyDown} />
      </label>
      <ul className="palette-list" role="listbox" ref={listRef}>
        {taskHits.length > 0 && <li className="section">Tasks</li>}
        {results.slice(0, taskHits.length).map(row)}
        {taskHits.length > 0 && cmdHits.length > 0 && <li className="section">Commands</li>}
        {results.slice(taskHits.length).map((r, i) => row(r, i + taskHits.length))}
        {!results.length && <li className="section">No matches</li>}
      </ul>
    </Modal>
  );
}
