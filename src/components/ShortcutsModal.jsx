// Keyboard shortcuts and quick-add syntax reference
import { Modal } from './common.jsx';

export default function ShortcutsModal({ isMac, onClose }) {
  const mod = isMac ? '⌘' : 'Ctrl+';
  const shortcuts = [
    ['N', 'New task (quick add)'],
    [`${isMac ? '⌘⇧' : 'Ctrl+Shift+'}D`, 'Quick add from anywhere (global)'],
    [`${mod}K`, 'Command palette'],
    ['/', 'Search tasks'],
    [`${mod}1 – ${mod}6`, 'Switch view'],
    ['F', 'Focus timer'],
    ['Space', 'Start / pause timer (when open)'],
    [`${mod},`, 'Settings'],
    [`${mod}E`, 'Export backup'],
    ['?', 'Show this list'],
    ['Esc', 'Close panel or dialog']
  ];

  return (
    <Modal className="shortcuts-modal" label="Keyboard shortcuts" onClose={onClose}>
      <h2>Keyboard shortcuts</h2>
      <dl className="shortcuts">
        {shortcuts.map(([k, d]) => (
          <div key={k} className="shortcut"><dt><kbd>{k}</kbd></dt><dd>{d}</dd></div>
        ))}
      </dl>
      <h3>Quick-add language</h3>
      <dl className="shortcuts">
        <div className="shortcut"><dt><code>tomorrow 5pm</code></dt><dd>Due date &amp; time (today, tonight, fri, next mon, dec 12, in 3 days, in 2h)</dd></div>
        <div className="shortcut"><dt><code>!high</code></dt><dd>Priority (!high · !med · !low or !1 · !2 · !3)</dd></div>
        <div className="shortcut"><dt><code>#college</code></dt><dd>Add a tag</dd></div>
        <div className="shortcut"><dt><code>every week</code></dt><dd>Repeat (daily, every weekday, weekly, monthly, every monday)</dd></div>
      </dl>
    </Modal>
  );
}
