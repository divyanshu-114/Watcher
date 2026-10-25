// Natural-language quick add.
// "Submit essay fri 5pm !high #college every week" ->
//   { title: 'Submit essay', due: <next Friday 17:00>, priority: 'high', tags: ['college'], repeat: 'weekly' }
import { addDays, atTime, toLocalInput, END_OF_DAY } from './dates.js';

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const weekdayPattern = '(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|sday|urday)?';
const monthPattern = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';

const PRIORITIES = { high: 'high', h: 'high', '1': 'high', medium: 'medium', med: 'medium', m: 'medium', '2': 'medium', low: 'low', l: 'low', '3': 'low' };

const weekdayIndex = word => WEEKDAYS.findIndex(d => d.startsWith(word.slice(0, 3)));
const monthIndex = word => MONTHS.findIndex(m => m.startsWith(word.slice(0, 3)));

function nextWeekday(from, index, forceNextWeek) {
  let diff = (index - from.getDay() + 7) % 7 || 7;   // never "today"
  if (forceNextWeek && diff < 7) diff += 7;           // "next fri" = Friday of next week
  return addDays(from, diff);
}

export function parseQuickAdd(input, { defaultDate = null, now = new Date() } = {}) {
  let text = ` ${input} `;
  const found = {};

  // Remove a matched phrase from the text and run its handler
  const take = (regex, handler) => {
    const match = text.match(regex);
    if (!match) return;
    text = text.replace(match[0], ' ');
    handler(match);
  };

  take(/\s!(high|h|medium|med|m|low|l|[123])(?=\s)/i, m => { found.priority = PRIORITIES[m[1].toLowerCase()]; });

  found.tags = [];
  let tagMatch;
  while ((tagMatch = text.match(/\s#([\w-]{1,24})(?=\s)/))) {
    const tag = tagMatch[1].toLowerCase();
    if (!found.tags.includes(tag)) found.tags.push(tag);
    text = text.replace(tagMatch[0], ' ');
  }

  // Repeat rules
  take(/\s(?:every\s?day|daily)(?=\s)/i, () => { found.repeat = 'daily'; });
  take(/\s(?:every\s?weekday|weekdays)(?=\s)/i, () => { found.repeat = 'weekdays'; });
  take(/\s(?:every\s?week|weekly)(?=\s)/i, () => { found.repeat = 'weekly'; });
  take(/\s(?:every\s?month|monthly)(?=\s)/i, () => { found.repeat = 'monthly'; });
  take(new RegExp(`\\severy\\s${weekdayPattern}(?=\\s)`, 'i'), m => {
    found.repeat = 'weekly';
    found.date = nextWeekday(now, weekdayIndex(m[1].toLowerCase()), false);
  });

  // Times: "at 5pm", "5:30 pm", "17:00", "noon"
  take(/\s(?:at\s)?(\d{1,2})(?::(\d{2}))?\s?(am|pm)(?=\s)/i, m => {
    let h = Number(m[1]) % 12;
    if (m[3].toLowerCase() === 'pm') h += 12;
    found.time = `${h}:${m[2] || '00'}`;
  });
  take(/\s(?:at\s)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/, m => { found.time = `${m[1]}:${m[2]}`; });
  take(/\s(?:at\s)?noon(?=\s)/i, () => { found.time = '12:00'; });
  take(/\s(?:at\s)?midnight(?=\s)/i, () => { found.time = '23:59'; });

  // Dates
  take(/\s(?:today)(?=\s)/i, () => { found.date = now; });
  take(/\stonight(?=\s)/i, () => { found.date = now; found.time = found.time || '20:00'; });
  take(/\s(?:tomorrow|tmrw|tmr)(?=\s)/i, () => { found.date = addDays(now, 1); });
  take(/\snext\sweek(?=\s)/i, () => { found.date = addDays(now, 7); });
  take(/\sin\s(\d{1,3})\s?(min|mins|minutes|m|hours|hour|hrs|hr|h|days|day|d|weeks|week|w)(?=\s)/i, m => {
    const n = Number(m[1]);
    const unit = m[2].toLowerCase()[0];
    if (unit === 'm' || unit === 'h') {
      const exact = new Date(now.getTime() + n * (unit === 'm' ? 60000 : 3600000));
      found.date = exact;
      found.time = `${exact.getHours()}:${exact.getMinutes()}`;
    } else {
      found.date = addDays(now, unit === 'w' ? n * 7 : n);
    }
  });
  take(new RegExp(`\\s(?:on\\s|(this|next)\\s)?${weekdayPattern}(?=\\s)`, 'i'), m => {
    found.date = nextWeekday(now, weekdayIndex(m[2].toLowerCase()), (m[1] || '').toLowerCase() === 'next');
  });
  // "12 dec" / "dec 12" / "december 12th"
  const setMonthDay = (monthWord, dayNum) => {
    const date = new Date(now.getFullYear(), monthIndex(monthWord.toLowerCase()), Number(dayNum));
    if (date < atTime(now, '00:00')) date.setFullYear(date.getFullYear() + 1);
    found.date = date;
  };
  take(new RegExp(`\\s(?:on\\s)?(\\d{1,2})(?:st|nd|rd|th)?\\s${monthPattern}(?=\\s)`, 'i'), m => setMonthDay(m[2], m[1]));
  take(new RegExp(`\\s(?:on\\s)?${monthPattern}\\s(\\d{1,2})(?:st|nd|rd|th)?(?=\\s)`, 'i'), m => setMonthDay(m[1], m[2]));

  // Combine date + time
  let due = null;
  if (found.repeat && !found.date && !found.time && !defaultDate) found.date = now;   // repeating tasks start today
  if (found.date || found.time || defaultDate) {
    let date = found.date || defaultDate || now;
    let when = atTime(date, found.time || END_OF_DAY);
    // A bare time that has already passed today means tomorrow
    if (!found.date && !defaultDate && found.time && when < now) when = addDays(when, 1);
    while (found.repeat === 'weekdays' && (when.getDay() === 0 || when.getDay() === 6)) when = addDays(when, 1);
    due = toLocalInput(when);
  }

  return {
    title: text.replace(/\s+/g, ' ').trim(),
    due,
    priority: found.priority || null,
    tags: found.tags,
    repeat: found.repeat || null
  };
}
