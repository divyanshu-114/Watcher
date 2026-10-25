// Settings dialog: appearance, reminders, focus timer and data
import { Icon, Modal } from './common.jsx';
import { setSettings } from '../lib/store.js';
import { syncFocusSettings } from '../lib/focus.js';

const ACCENTS = ['mustard', 'coral', 'teal', 'violet', 'sky'];

function Select({ value, onChange, options }) {
  return (
    <select value={String(value)} onChange={e => onChange(Number(e.target.value))}>
      {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
  );
}

export default function SettingsModal({ settings: s, isMac, onClose, onExport, onImport, onReset }) {
  const change = patch => { setSettings(patch); syncFocusSettings(); };

  return (
    <Modal className="settings-modal" label="Settings" onClose={onClose}>
      <h2>Settings</h2>

      <h3>Appearance</h3>
      <div className="row">
        <span>Theme</span>
        <div className="segmented">
          {['dark', 'light', 'system'].map(v => (
            <button key={v} className={s.theme === v ? 'on' : ''} onClick={() => change({ theme: v })}>{v[0].toUpperCase() + v.slice(1)}</button>
          ))}
        </div>
      </div>
      <div className="row">
        <span>Accent colour</span>
        <div className="swatches">
          {ACCENTS.map(v => (
            <button key={v} data-v={v} className={s.accent === v ? 'on' : ''} onClick={() => change({ accent: v })} aria-label={v} />
          ))}
        </div>
      </div>
      <label className="row">
        <span>Celebrate with confetti</span>
        <input type="checkbox" className="switch" checked={s.confetti} onChange={e => change({ confetti: e.target.checked })} />
      </label>

      <h3>Reminders</h3>
      <label className="row">
        <span>Desktop notifications</span>
        <input type="checkbox" className="switch" checked={s.notifications} onChange={e => change({ notifications: e.target.checked })} />
      </label>
      <div className="row">
        <span>Remind me before a deadline</span>
        <Select value={s.leadMinutes} onChange={v => change({ leadMinutes: v })}
          options={[[5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 hour'], [1440, '1 day']]} />
      </div>

      <h3>Focus timer</h3>
      <div className="row">
        <span>Focus length</span>
        <Select value={s.focusMinutes} onChange={v => change({ focusMinutes: v })}
          options={[[15, '15 min'], [25, '25 min'], [45, '45 min'], [60, '60 min']]} />
      </div>
      <div className="row">
        <span>Break length</span>
        <Select value={s.breakMinutes} onChange={v => change({ breakMinutes: v })}
          options={[[5, '5 min'], [10, '10 min'], [15, '15 min']]} />
      </div>

      <h3>Data</h3>
      <div className="data-actions">
        <button className="btn" onClick={() => onExport('json')}><Icon name="download" />Export JSON</button>
        <button className="btn" onClick={() => onExport('csv')}><Icon name="download" />Export CSV</button>
        <button className="btn" onClick={onImport}><Icon name="upload" />Import</button>
        <button className="btn danger" onClick={onReset}><Icon name="trash" />Erase everything</button>
      </div>
      <p className="muted small">
        Tasks are stored in a JSON file in your user data folder (Help → Show Data File). Quick add from anywhere
        with <kbd>{isMac ? '⌘⇧D' : 'Ctrl+Shift+D'}</kbd>.
      </p>
    </Modal>
  );
}
