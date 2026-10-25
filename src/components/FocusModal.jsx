// Focus timer dialog. The timer itself lives in lib/focus.js and keeps running when this closes.
import { Icon, Modal } from './common.jsx';
import { useFocus } from '../lib/hooks.js';
import { toggleFocus, resetFocus, skipFocus, setFocusTask } from '../lib/focus.js';
import { dayKey } from '../lib/dates.js';

const RING = 2 * Math.PI * 96;

export default function FocusModal({ tasks, focusLog, onClose }) {
  const focus = useFocus();
  const isBreak = focus.phase === 'break';
  const open = tasks.filter(t => !t.done);
  const taskId = open.some(t => t.id === focus.taskId) ? focus.taskId : '';

  const today = dayKey(new Date());
  const todayLog = focusLog.filter(f => f.date === today);
  const minutes = todayLog.reduce((sum, f) => sum + f.minutes, 0);

  return (
    <Modal className="focus-modal" label="Focus timer" onClose={onClose}>
      <div className={`focus-phase${isBreak ? ' break' : ''}`}>{isBreak ? 'Break' : 'Focus'}</div>
      <div className={`focus-ring${isBreak ? ' break' : ''}`}>
        <svg viewBox="0 0 220 220" aria-hidden="true">
          <circle className="ring-track" cx="110" cy="110" r="96" />
          <circle className="ring-fill" cx="110" cy="110" r="96"
            style={{ strokeDasharray: RING, strokeDashoffset: RING * (1 - focus.left / focus.total) }} />
        </svg>
        <div className="focus-time">{focus.clock}</div>
      </div>
      <select className="focus-task" value={taskId} onChange={e => setFocusTask(e.target.value)} aria-label="Task to focus on">
        <option value="">No specific task</option>
        {open.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
      </select>
      <div className="focus-controls">
        <button className="icon-btn lg" onClick={resetFocus} title="Reset"><Icon name="reset" /></button>
        <button className="play" onClick={toggleFocus} title="Start / pause (Space)"><Icon name={focus.running ? 'pause' : 'play'} /></button>
        <button className="icon-btn lg" onClick={skipFocus} title="Skip to next phase"><Icon name="skip" /></button>
      </div>
      <p className="focus-stats">Today: {todayLog.length} session{todayLog.length === 1 ? '' : 's'} · {minutes} min focused</p>
    </Modal>
  );
}
