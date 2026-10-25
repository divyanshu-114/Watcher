// Natural-language quick add with a live preview of what was understood
import { forwardRef, useState } from 'react';
import { Icon } from './common.jsx';
import { parseQuickAdd } from '../lib/parser.js';
import { formatDue } from '../lib/dates.js';
import { addTask } from '../lib/store.js';
import { toast } from '../lib/toast.js';

const QuickAdd = forwardRef(function QuickAdd({ defaultDate, showDefaultDate, extraTag, onOpenTask }, inputRef) {
  const [text, setText] = useState('');
  const parsed = text.trim() ? parseQuickAdd(text, { defaultDate }) : null;
  const tags = parsed ? [...new Set([...parsed.tags, ...(extraTag ? [extraTag] : [])])] : [];

  const submit = e => {
    e.preventDefault();
    const raw = text.trim();
    if (!raw) return;
    const task = addTask({
      title: parsed.title || raw,
      due: parsed.due || '',
      priority: parsed.priority || 'medium',
      tags,
      repeat: parsed.repeat || 'none'
    });
    setText('');
    toast(task.due ? `Added “${task.title}” · ${formatDue(task.due)}` : `Added “${task.title}”`, {
      label: 'Open', run: () => onOpenTask(task.id)
    });
  };

  return (
    <>
      <form className="quick-add" autoComplete="off" onSubmit={submit}>
        <span className="qa-plus"><Icon name="plus" /></span>
        <input
          ref={inputRef}
          type="text"
          maxLength={200}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { setText(''); e.currentTarget.blur(); } }}
          placeholder="Add a task — try “Submit essay fri 5pm !high #college”"
          aria-label="New task"
        />
        <button type="submit" className="btn primary">Add</button>
      </form>
      <div className="qa-preview" aria-live="polite">
        {parsed ? (
          <>
            {parsed.due && <span className="tag accent"><Icon name="calendar" />{formatDue(parsed.due)}</span>}
            {parsed.priority && <span className={`tag ${parsed.priority}`}><Icon name="flag" />{parsed.priority}</span>}
            {parsed.repeat && <span className="tag"><Icon name="repeat" />{parsed.repeat}</span>}
            {tags.map(t => <span key={t} className="tag">#{t}</span>)}
          </>
        ) : showDefaultDate && defaultDate && (
          <span className="tag"><Icon name="calendar" />Adding to {defaultDate.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}</span>
        )}
      </div>
    </>
  );
});

export default QuickAdd;
