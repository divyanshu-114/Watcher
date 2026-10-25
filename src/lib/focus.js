// Focus timer (Pomodoro) engine. Uses an end timestamp, so it stays accurate even if the window is hidden.
// Components read it through useFocus(); it keeps running when the timer dialog is closed.
import { getState, getTask, logFocus } from './store.js';
import { toast } from './toast.js';
import { formatClock } from './dates.js';

const timer = {
  phase: 'focus',     // focus | break
  running: false,
  endAt: 0,
  remaining: null,    // seconds left while paused; null = a full, untouched phase
  taskId: ''
};

const listeners = new Set();
let snapshot = null;

const phaseSeconds = () => 60 * (timer.phase === 'focus' ? getState().settings.focusMinutes : getState().settings.breakMinutes);

function secondsLeft() {
  if (timer.running) return Math.max(0, (timer.endAt - Date.now()) / 1000);
  return timer.remaining ?? phaseSeconds();
}

function emit() {
  const left = Math.ceil(secondsLeft());
  const total = phaseSeconds();
  const isBreak = timer.phase === 'break';
  snapshot = {
    phase: timer.phase,
    running: timer.running,
    taskId: timer.taskId,
    left,
    total,
    clock: formatClock(left),
    active: timer.running || left < total,
    trayLabel: timer.running ? `${isBreak ? '☕' : '●'} ${formatClock(left)}` : ''
  };
  listeners.forEach(fn => fn());
}

export function subscribeFocus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getFocusSnapshot = () => snapshot;

export function startFocusEngine() {
  emit();
  let lastSecond = -1;
  setInterval(() => {
    if (!timer.running) return;
    if (secondsLeft() <= 0) return finishPhase(false);
    const second = Math.ceil(secondsLeft());
    if (second !== lastSecond) { lastSecond = second; emit(); }
  }, 250);
}

export function toggleFocus() {
  if (timer.running) {
    timer.remaining = secondsLeft();
    timer.running = false;
  } else {
    timer.endAt = Date.now() + secondsLeft() * 1000;
    timer.running = true;
  }
  emit();
}

export function resetFocus() {
  timer.running = false;
  timer.remaining = null;
  emit();
}

export const skipFocus = () => finishPhase(true);

export function setFocusTask(id) {
  timer.taskId = id || '';
  emit();
}

// Settings changed: an untouched timer picks up the new length
export const syncFocusSettings = () => emit();

function finishPhase(skipped) {
  const wasFocus = timer.phase === 'focus';
  if (wasFocus) logFocus(Math.round((phaseSeconds() - secondsLeft()) / 60), timer.taskId);
  timer.phase = wasFocus ? 'break' : 'focus';
  timer.running = false;
  timer.remaining = null;

  if (!skipped) {
    const task = getTask(timer.taskId);
    window.desk.notify({
      title: wasFocus ? 'Focus session complete' : 'Break is over',
      body: wasFocus
        ? `Nice work${task ? ` on “${task.title}”` : ''}. Take a ${getState().settings.breakMinutes}-minute break.`
        : 'Ready for another focus session?'
    });
    toast(wasFocus ? 'Focus session complete. Time for a break.' : 'Break over. Back to it!');
    // Breaks start automatically; focus sessions wait for you
    if (wasFocus) return toggleFocus();
  }
  emit();
}
