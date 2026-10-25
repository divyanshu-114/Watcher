// Toast notifications. toast() can be called from anywhere; <Toasts /> renders them.

let toasts = [];
const listeners = new Set();
let nextId = 1;

const emit = () => listeners.forEach(fn => fn());

export function subscribeToasts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getToasts = () => toasts;

export function dismissToast(id) {
  if (!toasts.some(t => t.id === id && !t.leaving)) return;
  toasts = toasts.map(t => (t.id === id ? { ...t, leaving: true } : t));
  emit();
  setTimeout(() => { toasts = toasts.filter(t => t.id !== id); emit(); }, 200);
}

// action: { label, run }
export function toast(message, action) {
  const id = nextId++;
  toasts = [...toasts, { id, message, action }].slice(-3);
  emit();
  setTimeout(() => dismissToast(id), action ? 6000 : 3500);
}
