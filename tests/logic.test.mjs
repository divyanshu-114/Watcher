// Unit tests for the pure logic: natural-language parsing and recurring deadlines. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickAdd } from '../src/lib/parser.js';
import { nextOccurrence } from '../src/lib/store.js';
import { relative } from '../src/lib/dates.js';

const now = new Date('2026-10-23T14:00');   // a Friday afternoon
const parse = text => parseQuickAdd(text, { now });

test('plain text stays a plain task', () => {
  assert.deepEqual(parse('Buy milk'), { title: 'Buy milk', due: null, priority: null, tags: [], repeat: null });
});

test('weekday, time, priority and tag', () => {
  const r = parse('Submit essay fri 5pm !high #college');
  assert.equal(r.title, 'Submit essay');
  assert.equal(r.due, '2026-10-30T17:00');   // "fri" on a Friday means next Friday
  assert.equal(r.priority, 'high');
  assert.deepEqual(r.tags, ['college']);
});

test('relative dates', () => {
  assert.equal(parse('Read in 3 days').due, '2026-10-26T23:59');
  assert.equal(parse('Quiz in 45 min').due, '2026-10-23T14:45');
  assert.equal(parse('Call mom tonight').due, '2026-10-23T20:00');
  assert.equal(parse('Lab report next wed').due, '2026-11-04T23:59');
  assert.equal(parse('Rent tomorrow').due, '2026-10-24T23:59');
});

test('month names roll into next year when already past', () => {
  assert.equal(parse('Pay rent dec 1').due, '2026-12-01T23:59');
  assert.equal(parse('Plan trip 12 march').due, '2027-03-12T23:59');
});

test('a bare time that already passed means tomorrow', () => {
  assert.equal(parse('Meet 1pm').due, '2026-10-24T13:00');
  assert.equal(parse('Meet 6pm').due, '2026-10-23T18:00');
});

test('repeat rules', () => {
  assert.equal(parse('Water plants daily').repeat, 'daily');
  assert.equal(parse('Water plants daily').due, '2026-10-23T23:59');
  const gym = parse('Gym every monday 7am');
  assert.equal(gym.repeat, 'weekly');
  assert.equal(gym.due, '2026-10-26T07:00');
  assert.equal(parse('Standup 9:30 every weekday').due, '2026-10-26T09:30');   // skips the weekend
});

test('a default date from the calendar is used when none is typed', () => {
  const r = parseQuickAdd('Dentist 10am', { now, defaultDate: new Date('2026-11-05T00:00') });
  assert.equal(r.due, '2026-11-05T10:00');
});

test('recurring tasks jump to the next future occurrence', () => {
  assert.equal(nextOccurrence('2026-10-23T18:00', 'daily', now), '2026-10-24T18:00');
  assert.equal(nextOccurrence('2026-10-20T09:00', 'daily', now), '2026-10-24T09:00');   // overdue by days
  assert.equal(nextOccurrence('2026-10-23T09:00', 'weekdays', now), '2026-10-26T09:00');
  assert.equal(nextOccurrence('2026-10-23T09:00', 'weekly', now), '2026-10-30T09:00');
  assert.equal(nextOccurrence('2027-01-31T09:00', 'monthly', now), '2027-02-28T09:00');   // clamps to month end
});

test('countdown text', () => {
  assert.equal(relative('2026-10-23T16:30', now), 'in 2h 30m');
  assert.equal(relative('2026-10-23T13:15', now), '45m overdue');
  assert.equal(relative('2026-10-27T14:00', now), 'in 4 days');
});
