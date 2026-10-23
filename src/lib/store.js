// App state: tasks, settings and focus history. Saved to a JSON file through the preload bridge.
// Every change replaces the state object (never mutates it), so React re-renders through useSyncExternalStore.
import { addDays, atTime, dayKey, parseDue, startOfDay, toLocalInput, END_OF_DAY } from './dates.js';

const STORAGE_KEY = 'watcher-tasks';
const LEGACY_STORAGE_KEY = 'deadline-desk-tasks';   // v1 kept tasks in localStorage
const SCHEMA_VERSION = 2;

export const DEFAULT_SETTINGS = {
  theme: 'dark',            // dark | light | system
  accent: 'mustard',        // mustard | coral | teal | violet | sky
  notifications: true,
  leadMinutes: 15,          // remind this long before a deadline
  focusMinutes: 25,
  breakMinutes: 5,
  confetti: true
};

let state = { tasks: [], settings: { ...DEFAULT_SETTINGS }, focusLog: [] };
const listeners = new Set();
let saveTimer = null;

export const getState = () => state;
export const getTask = id => state.tasks.find(t => t.id === id);

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setState(next) {
  state = next;
  listeners.forEach(fn => fn());
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => window.desk.save({ version: SCHEMA_VERSION, ...state }), 250);
}

const setTasks = fn => setState({ ...state, tasks: fn(state.tasks) });
const patchTask = (id, fn) => setTasks(tasks => tasks.map(t => (t.id === id ? fn(t) : t)));

export const newId = () => crypto.randomUUID();

export function normalizeTask(t) {
  return {
    id: String(t.id || newId()),
    title: String(t.title || 'Untitled task').slice(0, 200),
    notes: String(t.notes || ''),
    due: t.due || '',
    priority: ['low', 'medium', 'high'].includes(t.priority) ? t.priority : 'medium',
    tags: Array.isArray(t.tags) ? t.tags.map(String) : [],
    subtasks: Array.isArray(t.subtasks)
      ? t.subtasks.map(s => ({ id: String(s.id || newId()), title: String(s.title || ''), done: !!s.done }))
      : [],
    repeat: ['daily', 'weekdays', 'weekly', 'monthly'].includes(t.repeat) ? t.repeat : 'none',
    done: !!t.done,
    createdAt: t.createdAt || new Date(typeof t.id === 'number' ? t.id : Date.now()).toISOString(),
    completedAt: t.completedAt || (t.done ? new Date().toISOString() : null),
    focusMinutes: Number(t.focusMinutes) || 0,
    notified: { soon: !!t.notified?.soon, due: !!t.notified?.due }
  };
}

// ---------- Loading ----------

export async function load() {
  const saved = await window.desk.load();
  if (saved && Array.isArray(saved.tasks)) {
    setState({
      tasks: saved.tasks.map(normalizeTask),
      settings: { ...DEFAULT_SETTINGS, ...saved.settings },
      focusLog: Array.isArray(saved.focusLog) ? saved.focusLog : []
    });
    return { firstRun: false };
  }

  // Migrate legacy data from localStorage, or seed example tasks on a brand-new install
  let legacy = null;
  try { legacy = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)); } catch { /* ignore */ }
  setTasks(() => (Array.isArray(legacy) && legacy.length ? legacy.map(normalizeTask) : sampleTasks()));
  return { firstRun: true, migrated: !!legacy?.length };
}

function sampleTasks() {
  const now = new Date();
  const at = (days, time) => toLocalInput(atTime(addDays(now, days), time));
  const doneAgo = days => addDays(now, -days).toISOString();
  return [
    { title: 'Welcome to Watcher — click me for details', priority: 'medium', notes: 'Try the quick-add bar: type "Submit essay fri 5pm !high #college" and press Enter.\n\nShortcuts: N new task · ⌘K command palette · ⌘1–6 switch views · ? all shortcuts.', subtasks: [{ title: 'Add your first task', done: false }, { title: 'Start a focus session', done: false }, { title: 'Check out Insights', done: false }] },
    { title: 'Submit DBMS assignment', due: at(0, '23:59'), priority: 'high', tags: ['college'] },
    { title: 'Prepare slides for project demo', due: at(1, '10:00'), priority: 'high', tags: ['college', 'project'], subtasks: [{ title: 'Outline', done: true }, { title: 'Screenshots', done: false }, { title: 'Rehearse', done: false }] },
    { title: 'Morning run', due: at(1, '07:00'), priority: 'low', tags: ['health'], repeat: 'daily' },
    { title: 'Read chapter 5 – Operating Systems', due: at(3, END_OF_DAY), priority: 'medium', tags: ['college'] },
    { title: 'Pay phone bill', due: at(-1, '18:00'), priority: 'medium', tags: ['personal'] },
    { title: 'Weekly review', due: at(5, '17:00'), priority: 'low', repeat: 'weekly' },
    { title: 'Set up GitHub portfolio', priority: 'low', tags: ['project'] },
    { title: 'Finish lab record', priority: 'medium', tags: ['college'], done: true, completedAt: doneAgo(0) },
    { title: 'Book train tickets', priority: 'high', tags: ['personal'], done: true, completedAt: doneAgo(1) },
    { title: 'Revise linked lists', priority: 'medium', tags: ['college'], done: true, completedAt: doneAgo(2) },
    { title: 'Group meeting notes', priority: 'low', tags: ['project'], done: true, completedAt: doneAgo(2) },
    { title: 'Update resume', priority: 'medium', tags: ['personal'], done: true, completedAt: doneAgo(4) }
  ].map(normalizeTask);
}

// ---------- Recurrence ----------

export function nextOccurrence(due, repeat, now = new Date()) {
  let next = parseDue(due);
  const step = d => {
    if (repeat === 'daily') return addDays(d, 1);
    if (repeat === 'weekly') return addDays(d, 7);
    if (repeat === 'monthly') {
      const m = new Date(d);
      const day = m.getDate();
      m.setDate(1);
      m.setMonth(m.getMonth() + 1);
      m.setDate(Math.min(day, new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()));
      return m;
    }
    // weekdays
    let w = addDays(d, 1);
    while (w.getDay() === 0 || w.getDay() === 6) w = addDays(w, 1);
    return w;
  };
  do { next = step(next); } while (next <= now);
  return toLocalInput(next);
}

// ---------- Task actions ----------

export function addTask(fields) {
  const task = normalizeTask({ ...fields, id: newId(), createdAt: new Date().toISOString() });
  setTasks(tasks => [...tasks, task]);
  return task;
}

export function updateTask(id, patch) {
  patchTask(id, t => ({
    ...t,
    ...patch,
    // A new deadline gets fresh reminders
    ...('due' in patch && patch.due !== t.due ? { notified: { soon: false, due: false } } : {})
  }));
}

// Returns the updated task, plus the follow-up task when a repeating task is completed
export function toggleTask(id) {
  const task = getTask(id);
  if (!task) return null;
  const done = !task.done;
  const updated = { ...task, done, completedAt: done ? new Date().toISOString() : null };

  let next = null;
  if (done && task.repeat !== 'none' && task.due) {
    next = normalizeTask({
      ...task,
      id: newId(),
      done: false,
      completedAt: null,
      focusMinutes: 0,
      createdAt: new Date().toISOString(),
      due: nextOccurrence(task.due, task.repeat),
      subtasks: task.subtasks.map(s => ({ ...s, id: newId(), done: false })),
      notified: {}
    });
    updated.repeat = 'none';   // the finished copy no longer repeats; the new one carries the rule
  }
  setTasks(tasks => [...tasks.map(t => (t.id === id ? updated : t)), ...(next ? [next] : [])]);
  return { task: updated, next };
}

export function deleteTask(id) {
  const index = state.tasks.findIndex(t => t.id === id);
  if (index === -1) return null;
  const task = state.tasks[index];
  setTasks(tasks => tasks.filter(t => t.id !== id));
  return { task, index };
}

export function restoreTask({ task, index }) {
  setTasks(tasks => [...tasks.slice(0, index), task, ...tasks.slice(index)]);
}

export function clearCompleted() {
  const removed = state.tasks.filter(t => t.done);
  setTasks(tasks => tasks.filter(t => !t.done));
  return removed;
}

export function restoreMany(removed) {
  setTasks(tasks => [...tasks, ...removed]);
}

// ---------- Subtasks ----------

export function addSubtask(taskId, title) {
  if (!title.trim()) return;
  patchTask(taskId, t => ({ ...t, subtasks: [...t.subtasks, { id: newId(), title: title.trim(), done: false }] }));
}

export function toggleSubtask(taskId, subId) {
  patchTask(taskId, t => ({ ...t, subtasks: t.subtasks.map(s => (s.id === subId ? { ...s, done: !s.done } : s)) }));
}

export function deleteSubtask(taskId, subId) {
  patchTask(taskId, t => ({ ...t, subtasks: t.subtasks.filter(s => s.id !== subId) }));
}

// ---------- Settings, focus, import ----------

export function setSettings(patch) {
  setState({ ...state, settings: { ...state.settings, ...patch } });
}

export function logFocus(minutes, taskId) {
  if (minutes <= 0) return;
  setState({
    ...state,
    focusLog: [...state.focusLog, { date: dayKey(new Date()), minutes, taskId: taskId || null }],
    tasks: state.tasks.map(t => (t.id === taskId ? { ...t, focusMinutes: t.focusMinutes + minutes } : t))
  });
}

export function markNotified(id, ...which) {
  patchTask(id, t => ({ ...t, notified: { ...t.notified, ...Object.fromEntries(which.map(w => [w, true])) } }));
}

// Accepts a full backup ({ tasks, settings }) or a plain array of tasks. Skips tasks that already exist.
export function importData(data) {
  const incoming = Array.isArray(data) ? data : data?.tasks;
  if (!Array.isArray(incoming)) throw new Error('This file is not a Watcher backup.');
  const existing = new Set(state.tasks.map(t => t.id));
  const fresh = incoming.map(normalizeTask).filter(t => !existing.has(t.id));
  setState({
    ...state,
    tasks: [...state.tasks, ...fresh],
    focusLog: Array.isArray(data?.focusLog) ? [...state.focusLog, ...data.focusLog] : state.focusLog
  });
  return fresh.length;
}

export function resetAll() {
  setState({ tasks: [], settings: { ...DEFAULT_SETTINGS }, focusLog: [] });
}

export function toCsv() {
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Title', 'Due', 'Priority', 'Status', 'Tags', 'Repeat', 'Subtasks', 'Focus minutes', 'Notes', 'Created', 'Completed'];
  const rows = state.tasks.map(t => [
    t.title, t.due.replace('T', ' '), t.priority, t.done ? 'Done' : 'Open', t.tags.join(' '), t.repeat,
    `${t.subtasks.filter(s => s.done).length}/${t.subtasks.length}`, t.focusMinutes, t.notes, t.createdAt, t.completedAt || ''
  ]);
  return [header, ...rows].map(r => r.map(cell).join(',')).join('\n');
}

export const toJson = () => JSON.stringify({ app: 'watcher', version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), ...state }, null, 2);

// ---------- Queries ----------

export const isOverdue = (task, now = new Date()) => !task.done && !!task.due && parseDue(task.due) < now;

export function isDueToday(task, now = new Date()) {
  if (!task.due) return false;
  const d = parseDue(task.due);
  return d >= startOfDay(now) && d < startOfDay(addDays(now, 1));
}

export function allTags(tasks) {
  const counts = new Map();
  tasks.filter(t => !t.done).forEach(t => t.tags.forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
