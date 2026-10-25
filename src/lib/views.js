// Which tasks each view shows, and how they are grouped and sorted
import { addDays, dayKey, daysBetween, parseDue, startOfDay } from './dates.js';
import { isOverdue, isDueToday } from './store.js';

export const VIEWS = {
  today: { title: 'Today', icon: 'today' },
  upcoming: { title: 'Upcoming', icon: 'upcoming' },
  all: { title: 'All tasks', icon: 'all' },
  completed: { title: 'Completed', icon: 'completed' },
  calendar: { title: 'Calendar', icon: 'calendar' },
  stats: { title: 'Insights', icon: 'stats' }
};

export const isListView = view => view !== 'calendar' && view !== 'stats';
export const tagOf = view => (view.startsWith('tag:') ? view.slice(4) : null);

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

export function matchesQuery(task, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return task.title.toLowerCase().includes(q) || task.notes.toLowerCase().includes(q) || task.tags.some(t => t.includes(q.replace(/^#/, '')));
}

export function sortTasks(list, sort = 'due') {
  const byDue = (a, b) => (!a.due) - (!b.due) || parseDue(a.due) - parseDue(b.due) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  const sorters = {
    due: byDue,
    priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byDue(a, b),
    created: (a, b) => b.createdAt.localeCompare(a.createdAt),
    title: (a, b) => a.title.localeCompare(b.title)
  };
  return [...list].sort(sorters[sort]);
}

// Bucket open tasks by deadline: Overdue / Today / Tomorrow / Next 7 days / Later / No date
function groupByDue(tasks, now) {
  const buckets = [
    { key: 'overdue', label: 'Overdue', test: t => isOverdue(t, now) },
    { key: 'today', label: 'Today', test: t => isDueToday(t, now) },
    { key: 'tomorrow', label: 'Tomorrow', test: t => daysBetween(now, parseDue(t.due)) === 1 },
    { key: 'week', label: 'Next 7 days', test: t => daysBetween(now, parseDue(t.due)) < 7 },
    { key: 'later', label: 'Later', test: t => !!t.due },
    { key: 'nodate', label: 'No date', test: () => true }
  ].map(b => ({ ...b, tasks: [] }));
  tasks.forEach(t => buckets.find(b => b.test(t)).tasks.push(t));
  return buckets;
}

export function groupsForView(tasks, { view, query, sort }, now = new Date()) {
  const tag = tagOf(view);
  const open = tasks.filter(t => !t.done && matchesQuery(t, query));

  if (view === 'completed') {
    const done = tasks.filter(t => t.done && matchesQuery(t, query)).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
    const label = t => {
      const d = daysBetween(new Date(t.completedAt), now);
      return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 7 ? 'This week' : 'Earlier';
    };
    const groups = [];
    done.forEach(t => {
      const l = label(t);
      if (!groups.length || groups[groups.length - 1].label !== l) groups.push({ key: l, label: l, tasks: [] });
      groups[groups.length - 1].tasks.push(t);
    });
    return groups;
  }

  if (view === 'today') {
    const due = sortTasks(open.filter(t => t.due && parseDue(t.due) < startOfDay(addDays(now, 1))));
    const doneToday = tasks.filter(t => t.done && matchesQuery(t, query) && t.completedAt && daysBetween(new Date(t.completedAt), now) === 0);
    return [
      { key: 'overdue', label: 'Overdue', tasks: due.filter(t => isOverdue(t, now)) },
      { key: 'today', label: 'Today', tasks: due.filter(t => !isOverdue(t, now)) },
      { key: 'donetoday', label: 'Done today', tasks: doneToday }
    ];
  }

  if (view === 'upcoming') {
    const later = sortTasks(open.filter(t => t.due && parseDue(t.due) >= startOfDay(addDays(now, 1))));
    const groups = [];
    for (let i = 1; i <= 7; i++) {
      const day = addDays(now, i);
      const label = i === 1 ? 'Tomorrow' : day.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
      groups.push({ key: dayKey(day), label, tasks: later.filter(t => dayKey(parseDue(t.due)) === dayKey(day)), showEmpty: true });
    }
    groups.push({ key: 'later', label: 'Later', tasks: later.filter(t => daysBetween(now, parseDue(t.due)) > 7) });
    return groups;
  }

  const list = sortTasks(tag ? open.filter(t => t.tags.includes(tag)) : open, sort);
  if (sort !== 'due') return [{ key: 'all', label: `${list.length} task${list.length === 1 ? '' : 's'}`, tasks: list }];
  return groupByDue(list, now);
}

// Counts used by the sidebar, header, tray and dock badge
export function counts(tasks, now = new Date()) {
  const open = tasks.filter(t => !t.done);
  const overdue = open.filter(t => isOverdue(t, now));
  const today = open.filter(t => isDueToday(t, now) && !isOverdue(t, now));
  const upcoming = open.filter(t => t.due && parseDue(t.due) >= startOfDay(addDays(now, 1)) && daysBetween(now, parseDue(t.due)) <= 7);
  return { open, overdue, today, upcoming };
}
