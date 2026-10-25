// Small shared components: icons, search highlighting, modal shell, toasts
import { useToasts } from '../lib/hooks.js';
import { dismissToast } from '../lib/toast.js';

// Icons come from the SVG sprite in index.html
export const Icon = ({ name }) => <svg aria-hidden="true"><use href={`#i-${name}`} /></svg>;

// Wraps search matches in <mark>. React escapes the text, so user input can't inject HTML.
export function Highlight({ text, query }) {
  if (!query) return text;
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${safe})`, 'ig'));
  return parts.map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

export function Modal({ className, label, onClose, top, children, showClose = true }) {
  return (
    <div className={`overlay${top ? ' top' : ''}`} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${className}`} role="dialog" aria-label={label}>
        {showClose && (
          <button className="icon-btn close" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        )}
        {children}
      </div>
    </div>
  );
}

export function Toasts() {
  const toasts = useToasts();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast${t.leaving ? ' out' : ''}`}>
          <span>{t.message}</span>
          {t.action && (
            <button onClick={() => { t.action.run(); dismissToast(t.id); }}>{t.action.label}</button>
          )}
        </div>
      ))}
    </div>
  );
}
