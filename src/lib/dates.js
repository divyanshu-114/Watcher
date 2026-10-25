// Date helpers. Due dates are stored as local "YYYY-MM-DDTHH:mm" strings (the datetime-local format).

const DAY = 24 * 60 * 60 * 1000;
export const END_OF_DAY = '23:59';

const pad = n => String(n).padStart(2, '0');

export function toLocalInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function dayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY);
}

export function atTime(date, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export const parseDue = due => (due ? new Date(due) : null);

export function isEndOfDay(date) {
  return date.getHours() === 23 && date.getMinutes() === 59;
}

export function formatTime(date) {
  if (isEndOfDay(date)) return 'end of day';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// "Today, 5:00 PM" / "Tomorrow, end of day" / "Fri, 12 Dec, 9:00 AM"
export function formatDue(due) {
  const date = parseDue(due);
  if (!date) return '';
  const diff = daysBetween(new Date(), date);
  let day;
  if (diff === 0) day = 'Today';
  else if (diff === 1) day = 'Tomorrow';
  else if (diff === -1) day = 'Yesterday';
  else if (diff > 1 && diff < 7) day = date.toLocaleDateString([], { weekday: 'long' });
  else day = date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}, ${formatTime(date)}`;
}

// Live countdown: "in 3h 20m", "in 4 days", "2h overdue"
export function relative(due, now = new Date()) {
  const date = parseDue(due);
  if (!date) return '';
  const ms = date - now;
  const abs = Math.abs(ms);
  const mins = Math.round(abs / 60000);
  let text;
  if (mins < 1) text = 'now';
  else if (mins < 60) text = `${mins}m`;
  else if (mins < 60 * 24) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    text = m ? `${h}h ${m}m` : `${h}h`;
  } else {
    const d = Math.round(mins / (60 * 24));
    text = `${d} day${d === 1 ? '' : 's'}`;
  }
  if (text === 'now') return 'due now';
  return ms > 0 ? `in ${text}` : `${text} overdue`;
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}
