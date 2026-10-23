// Root component: UI state, views, keyboard shortcuts, reminders and the bridge to the main process
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, Toasts } from './components/common.jsx';
import Sidebar from './components/Sidebar.jsx';
import QuickAdd from './components/QuickAdd.jsx';
import { TaskList } from './components/TaskList.jsx';
import TaskDrawer from './components/TaskDrawer.jsx';
import CalendarView from './components/CalendarView.jsx';
import StatsView from './components/StatsView.jsx';
import FocusModal from './components/FocusModal.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import ShortcutsModal from './components/ShortcutsModal.jsx';
import * as store from './lib/store.js';
import { useStore } from './lib/hooks.js';
import { VIEWS, counts, groupsForView, isListView, tagOf } from './lib/views.js';
import { dayKey, formatDue, parseDue, relative } from './lib/dates.js';
import { getFocusSnapshot, setFocusTask, subscribeFocus, toggleFocus } from './lib/focus.js';
import { toast } from './lib/toast.js';
import { confetti } from './lib/confetti.js';

const isMac = window.desk.platform === 'darwin';
const MOD = isMac ? '⌘' : 'Ctrl+';

const isTyping = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

// ---------- Side effects that don't render anything ----------

// Every 30s: notify for tasks due within the lead time, and for tasks that just became due
function checkReminders() {
  const { tasks, settings } = store.getState();
  if (!settings.notifications) return;
  const now = Date.now();
  tasks.forEach(t => {
    if (t.done || !t.due) return;
    const diff = parseDue(t.due) - now;
    if (!t.notified.soon && diff > 0 && diff <= settings.leadMinutes * 60000) {
      window.desk.notify({ title: `Due ${relative(t.due)}`, body: t.title, taskId: t.id });
      store.markNotified(t.id, 'soon');
    } else if (!t.notified.due && diff <= 0) {
      // Only alert for deadlines that passed in the last hour (not stale ones on startup)
      if (diff > -3600000) window.desk.notify({ title: 'Deadline reached', body: t.title, taskId: t.id });
      store.markNotified(t.id, 'soon', 'due');
    }
  });
}

// Tray menu, menu-bar title and dock badge. Only sent when something changed.
let lastStatus = '';
function sendStatus() {
  const { open, overdue, today } = counts(store.getState().tasks);
  const now = new Date();
  const upcoming = open
    .filter(t => t.due && parseDue(t.due) >= now)
    .sort((a, b) => parseDue(a.due) - parseDue(b.due))
    .slice(0, 5)
    .map(t => ({ id: t.id, title: t.title.length > 40 ? t.title.slice(0, 39) + '…' : t.title, when: formatDue(t.due) }));
  const status = { todayCount: today.length, overdueCount: overdue.length, upcoming, focusLabel: getFocusSnapshot().trayLabel };
  const json = JSON.stringify(status);
  if (json === lastStatus) return;
  lastStatus = json;
  window.desk.updateStatus(status);
}

// ---------- App ----------

export default function App() {
  const { tasks, settings, focusLog } = useStore();
  const [view, setViewState] = useState('today');      // a key of VIEWS, or "tag:<name>"
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('due');
  const [selectedId, setSelectedId] = useState(null);
  const [overlay, setOverlay] = useState(null);        // focus | settings | palette | shortcuts
  const [calendarDay, setCalendarDay] = useState(() => dayKey(new Date()));
  const [now, setNow] = useState(() => new Date());     // ticks so countdowns stay live

  const quickRef = useRef(null);
  const searchRef = useRef(null);
  const viewRef = useRef(null);

  const stats = useMemo(() => counts(tasks, now), [tasks, now]);
  const selectedTask = tasks.find(t => t.id === selectedId);
  const tag = tagOf(view);

  // ---------- Actions ----------

  function setView(next) {
    setViewState(next);
    if (!isListView(next)) setQuery('');
    viewRef.current?.scrollTo(0, 0);
  }

  function openTask(id) {
    if (!store.getTask(id)) return;
    setSelectedId(id);
    setViewState(v => (v === 'stats' ? 'all' : v));
  }

  function completeTask(id) {
    const before = counts(store.getState().tasks);
    const result = store.toggleTask(id);
    if (!result?.task.done) return;
    const { task, next } = result;

    if (next) toast(`Done. Next “${next.title}” is ${formatDue(next.due)}`);
    else toast(`Completed “${task.title}”`, { label: 'Undo', run: () => store.toggleTask(id) });

    // Celebrate clearing the last thing due today
    const after = counts(store.getState().tasks);
    if (store.getState().settings.confetti && before.today.length + before.overdue.length > 0 && after.today.length + after.overdue.length === 0) {
      confetti();
      toast('Everything due today is done. Nice work!');
    }
  }

  function removeTask(id) {
    const removed = store.deleteTask(id);
    if (!removed) return;
    setSelectedId(s => (s === id ? null : s));
    toast(`Deleted “${removed.task.title}”`, { label: 'Undo', run: () => store.restoreTask(removed) });
  }

  function openFocus(taskId) {
    if (taskId && !getFocusSnapshot().running) setFocusTask(taskId);
    setOverlay('focus');
  }

  function focusQuickAdd() {
    setOverlay(null);
    setViewState(v => (v === 'stats' ? 'today' : v));
    setTimeout(() => quickRef.current?.focus());
  }

  async function exportData(format) {
    const path = await window.desk.exportFile(format === 'csv' ? store.toCsv() : store.toJson(), format);
    if (path) toast(`Exported to ${path.split(/[\\/]/).pop()}`);
  }

  async function importData() {
    try {
      const data = await window.desk.importFile();
      if (!data) return;
      const n = store.importData(data);
      toast(n ? `Imported ${n} task${n === 1 ? '' : 's'}` : 'Those tasks are already here');
    } catch (err) {
      toast(err.message);
    }
  }

  async function resetData() {
    const ok = await window.desk.confirm({
      message: 'Erase all tasks and settings?',
      detail: 'This permanently deletes every task, your focus history and settings. Export a backup first if you might need them.',
      okLabel: 'Erase everything'
    });
    if (!ok) return;
    store.resetAll();
    setSelectedId(null);
    setOverlay(null);
    toast('Everything erased. Fresh start!');
  }

  function clearCompleted() {
    const removed = store.clearCompleted();
    toast(`Cleared ${removed.length} completed task${removed.length === 1 ? '' : 's'}`, { label: 'Undo', run: () => store.restoreMany(removed) });
  }

  const taskActions = { open: openTask, complete: completeTask, remove: removeTask, focus: openFocus };

  // The menu, tray and keyboard listeners are registered once and call the latest actions through this ref
  const actions = useRef(null);
  actions.current = { setView, openTask, openFocus, focusQuickAdd, exportData, importData, setOverlay, setSelectedId, overlay, selectedId };

  // ---------- Effects ----------

  // Theme and accent colour
  useEffect(() => {
    const dark = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = settings.theme === 'system' ? (dark.matches ? 'dark' : 'light') : settings.theme;
      document.documentElement.dataset.accent = settings.accent;
    };
    apply();
    dark.addEventListener('change', apply);
    return () => dark.removeEventListener('change', apply);
  }, [settings.theme, settings.accent]);

  // Live countdowns and reminders
  useEffect(() => {
    const tick = setInterval(() => { setNow(new Date()); checkReminders(); }, 30000);
    const first = setTimeout(checkReminders, 3000);
    return () => { clearInterval(tick); clearTimeout(first); };
  }, []);

  // Tray, menu-bar title and dock badge
  useEffect(sendStatus, [tasks, now]);
  useEffect(() => subscribeFocus(() => {
    sendStatus();
    const focus = getFocusSnapshot();
    document.title = focus.running ? `${focus.clock} · Watcher` : 'Watcher';
  }), []);

  // Commands from the native menu, tray, notifications and global shortcut
  useEffect(() => {
    const a = () => actions.current;
    const offs = [
      window.desk.onView(v => a().setView(v)),
      window.desk.onNewTask(() => a().focusQuickAdd()),
      window.desk.onPalette(() => a().setOverlay('palette')),
      window.desk.onImport(() => a().importData()),
      window.desk.onExport(format => a().exportData(format)),
      window.desk.onSettings(() => a().setOverlay('settings')),
      window.desk.onFocus(() => a().openFocus()),
      window.desk.onShortcuts(() => a().setOverlay('shortcuts')),
      window.desk.onOpenTask(id => a().openTask(id))
    ];
    return () => offs.forEach(off => off());
  }, []);

  // Single-key shortcuts
  useEffect(() => {
    const onKey = e => {
      const a = actions.current;
      if (e.key === 'Escape') {
        if (a.overlay) return a.setOverlay(null);
        if (isTyping()) return document.activeElement.blur();
        if (a.selectedId) return a.setSelectedId(null);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (a.overlay === 'focus' && e.key === ' ' && !isTyping()) { e.preventDefault(); return toggleFocus(); }
      if (isTyping() || a.overlay) return;
      if (e.key === 'n') { e.preventDefault(); a.focusQuickAdd(); }
      else if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === 'f') a.openFocus();
      else if (e.key === '?') a.setOverlay('shortcuts');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // ---------- Render ----------

  const subtitle = tag
    ? `${stats.open.filter(t => t.tags.includes(tag)).length} open tasks tagged #${tag}`
    : {
      today: now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }) + (stats.overdue.length ? ` · ${stats.overdue.length} overdue` : ''),
      upcoming: 'Your next seven days',
      all: `${stats.open.length} open task${stats.open.length === 1 ? '' : 's'}`,
      completed: 'Everything you’ve finished',
      calendar: 'Plan your month. Drag tasks between days.',
      stats: 'How you’ve been doing'
    }[view];

  const quickAddDate = view === 'calendar' ? new Date(`${calendarDay}T00:00`) : view === 'today' ? now : null;

  const commands = [
    { label: 'New task', icon: 'plus', hint: 'N', run: focusQuickAdd },
    ...Object.entries(VIEWS).map(([key, v], i) => ({ label: `Go to ${v.title}`, icon: v.icon, hint: `${MOD}${i + 1}`, run: () => setView(key) })),
    { label: 'Start focus timer', icon: 'focus', hint: 'F', run: () => openFocus() },
    { label: 'Toggle light / dark theme', icon: 'moon', run: () => store.setSettings({ theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' }) },
    { label: 'Settings', icon: 'settings', hint: `${MOD},`, run: () => setOverlay('settings') },
    { label: 'Export backup (JSON)', icon: 'download', hint: `${MOD}E`, run: () => exportData('json') },
    { label: 'Export spreadsheet (CSV)', icon: 'download', run: () => exportData('csv') },
    { label: 'Import backup', icon: 'upload', run: importData },
    { label: 'Clear completed tasks', icon: 'trash', run: clearCompleted },
    { label: 'Keyboard shortcuts', icon: 'keyboard', hint: '?', run: () => setOverlay('shortcuts') }
  ];

  return (
    <div className={`shell platform-${window.desk.platform}`}>
      <Sidebar
        tasks={tasks}
        stats={stats}
        now={now}
        view={view}
        onSelect={setView}
        onFocus={() => openFocus()}
        onPalette={() => setOverlay('palette')}
        onSettings={() => setOverlay('settings')}
      />

      <main className="main">
        <header className="main-head drag">
          <div className="heading">
            <h1>{tag ? `#${tag}` : VIEWS[view].title}</h1>
            <p className="sub">{subtitle}</p>
          </div>
          <div className="head-tools no-drag">
            <label className="search">
              <Icon name="search" />
              <input
                ref={searchRef}
                type="search"
                placeholder="Search tasks"
                aria-label="Search tasks"
                value={query}
                onChange={e => {
                  setQuery(e.target.value.trim() ? e.target.value : '');
                  if (!isListView(view)) setViewState('all');
                }}
              />
              <kbd>/</kbd>
            </label>
            {(view === 'all' || tag) && (
              <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort tasks">
                <option value="due">Sort: Due date</option>
                <option value="priority">Sort: Priority</option>
                <option value="created">Sort: Newest</option>
                <option value="title">Sort: A–Z</option>
              </select>
            )}
          </div>
        </header>

        {view !== 'stats' && (
          <QuickAdd
            ref={quickRef}
            defaultDate={quickAddDate}
            showDefaultDate={view === 'calendar'}
            extraTag={tag}
            onOpenTask={openTask}
          />
        )}

        <section className="view" ref={viewRef}>
          {view === 'calendar' && (
            <CalendarView tasks={tasks} now={now} selectedDay={calendarDay} onSelectDay={setCalendarDay}
              selectedId={selectedId} actions={taskActions} />
          )}
          {view === 'stats' && <StatsView tasks={tasks} focusLog={focusLog} now={now} />}
          {isListView(view) && (
            <ListView tasks={tasks} view={view} query={query.trim()} sort={sort} now={now}
              selectedId={selectedId} actions={taskActions} onClearCompleted={clearCompleted} />
          )}
        </section>
      </main>

      {selectedTask && (
        <TaskDrawer
          key={selectedTask.id}
          task={selectedTask}
          onClose={() => setSelectedId(null)}
          onComplete={completeTask}
          onFocus={openFocus}
          onDelete={removeTask}
        />
      )}

      {overlay === 'focus' && <FocusModal tasks={tasks} focusLog={focusLog} onClose={() => setOverlay(null)} />}
      {overlay === 'settings' && (
        <SettingsModal settings={settings} isMac={isMac} onClose={() => setOverlay(null)}
          onExport={exportData} onImport={importData} onReset={resetData} />
      )}
      {overlay === 'palette' && (
        <CommandPalette tasks={tasks} commands={commands} onOpenTask={openTask} onClose={() => setOverlay(null)} />
      )}
      {overlay === 'shortcuts' && <ShortcutsModal isMac={isMac} onClose={() => setOverlay(null)} />}

      <Toasts />
    </div>
  );
}

function emptyCopy(view, query) {
  if (query) return ['No matches', `Nothing matches “${query}”.`];
  if (view === 'today') return ['You’re all caught up', 'Nothing due today. Plan ahead in Upcoming, or enjoy the calm.'];
  if (view === 'completed') return ['Nothing finished yet', 'Completed tasks will show up here.'];
  if (view === 'upcoming') return ['A clear week ahead', 'Tasks due in the coming days will appear here.'];
  return ['All clear', 'Nothing here. Add a task above to get started.'];
}

function ListView({ tasks, view, query, sort, now, selectedId, actions, onClearCompleted }) {
  const groups = groupsForView(tasks, { view, query, sort }, now);
  const total = groups.reduce((n, g) => n + g.tasks.length, 0);

  if (!total) {
    const [title, text] = emptyCopy(view, query);
    return (
      <div className="empty">
        <div className="empty-art"><Icon name="completed" /></div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    );
  }

  return (
    <>
      <TaskList groups={groups} now={now} query={query} selectedId={selectedId} actions={actions} />
      {view === 'completed' && (
        <div className="list-foot">
          <button className="btn ghost" onClick={onClearCompleted}><Icon name="trash" />Clear completed</button>
        </div>
      )}
    </>
  );
}
