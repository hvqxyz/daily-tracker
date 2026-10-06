import { DEFAULT_CATEGORIES, STATUSES } from './model.js';
import { todayKey, shiftDateKey, clockToMinutes, nowMinutes } from './time.js';
import { buildSampleTrackers } from '../trackers/templates.js';
import { buildSampleNotes } from '../notes/samples.js';

let seedCounter = 0;
function id(prefix) {
  seedCounter += 1;
  return `${prefix}_seed_${seedCounter}`;
}

function act({ title, icon, categoryId, priority, start, duration, fixed = true, status, notes = '' }) {
  const startMin = start != null ? clockToMinutes(start) : null;
  return {
    id: id('act'),
    title,
    icon,
    categoryId,
    priority,
    start: startMin,
    duration,
    plannedStart: startMin,
    plannedDuration: duration,
    fixed,
    status,
    notes,
    recurrenceId: null,
    createdAt: Date.now(),
  };
}

const RECURRING_IDS = ['rec_running', 'rec_gym', 'rec_reading', 'rec_cleaning'];

function buildTodayActivities() {
  const now = nowMinutes();
  const statusFor = (start, duration) => {
    if (start == null) return STATUSES.PLANNED;
    if (now >= start + duration) return STATUSES.COMPLETED;
    if (now >= start) return STATUSES.IN_PROGRESS;
    return STATUSES.PLANNED;
  };

  const items = [
    act({ title: 'Wake up', icon: '☀️', categoryId: 'recovery', priority: 'required', start: '08:00', duration: 30 }),
    act({ title: 'Deep Work', icon: '💻', categoryId: 'career', priority: 'required', start: '09:00', duration: 120 }),
    act({ title: 'Break', icon: '☕', categoryId: 'life', priority: 'optional', start: '11:00', duration: 15 }),
    act({ title: 'Lunch', icon: '🍝', categoryId: 'life', priority: 'required', start: '12:00', duration: 45 }),
    act({ title: 'Running', icon: '🏃', categoryId: 'body', priority: 'required', start: '13:00', duration: 60 }),
    act({ title: 'MX-5 drive', icon: '🚗', categoryId: 'pleasure', priority: 'optional', start: '15:00', duration: 60 }),
    act({ title: 'Reading', icon: '📚', categoryId: 'mind', priority: 'should', start: '17:00', duration: 45 }),
    act({ title: 'Gaming', icon: '🎮', categoryId: 'pleasure', priority: 'optional', start: '20:00', duration: 90, fixed: false }),
    act({ title: 'Sleep', icon: '😴', categoryId: 'recovery', priority: 'required', start: '23:30', duration: 30 }),
  ];
  items.forEach((it) => {
    it.status = statusFor(it.start, it.duration);
  });

  // A flexible, not-yet-scheduled activity sitting in the tray.
  const stretching = act({ title: 'Stretching', icon: '🧘', categoryId: 'body', priority: 'optional', start: null, duration: 20, fixed: false, status: STATUSES.PLANNED });

  // One activity that was moved during the day, to demo plan vs. actual.
  const call = act({ title: 'Call Mom', icon: '📞', categoryId: 'relationships', priority: 'should', start: '18:00', duration: 20 });
  if (now > clockToMinutes('18:00')) {
    call.start = clockToMinutes('19:10');
    call.status = STATUSES.MOVED;
  }

  return [...items, stretching, call];
}

function buildPastDayActivities(dayOffset) {
  const variants = [
    [
      act({ title: 'Wake up', icon: '☀️', categoryId: 'recovery', priority: 'required', start: '07:00', duration: 30, status: STATUSES.COMPLETED }),
      act({ title: 'Work', icon: '💼', categoryId: 'career', priority: 'required', start: '09:00', duration: 240, status: STATUSES.COMPLETED }),
      act({ title: 'Lunch', icon: '🍝', categoryId: 'life', priority: 'required', start: '13:00', duration: 45, status: STATUSES.COMPLETED }),
      act({ title: 'Gym', icon: '🏋️', categoryId: 'body', priority: 'required', start: '18:00', duration: 70, status: STATUSES.COMPLETED }),
      act({ title: 'Reading', icon: '📚', categoryId: 'mind', priority: 'should', start: '20:30', duration: 30, status: STATUSES.COMPLETED }),
      act({ title: 'Gaming', icon: '🎮', categoryId: 'pleasure', priority: 'optional', start: '21:30', duration: 60, status: STATUSES.SKIPPED }),
      act({ title: 'Sleep', icon: '😴', categoryId: 'recovery', priority: 'required', start: '23:00', duration: 30, status: STATUSES.COMPLETED }),
    ],
    [
      act({ title: 'Wake up', icon: '☀️', categoryId: 'recovery', priority: 'required', start: '07:30', duration: 30, status: STATUSES.COMPLETED }),
      act({ title: 'Work', icon: '💼', categoryId: 'career', priority: 'required', start: '09:00', duration: 210, status: STATUSES.COMPLETED }),
      act({ title: 'Groceries', icon: '🛒', categoryId: 'life', priority: 'required', start: '17:00', duration: 40, status: STATUSES.COMPLETED }),
      act({ title: 'Football', icon: '⚽', categoryId: 'body', priority: 'required', start: '19:00', duration: 90, status: STATUSES.COMPLETED }),
      act({ title: 'Shower & dinner', icon: '🍲', categoryId: 'life', priority: 'required', start: '20:45', duration: 45, status: STATUSES.COMPLETED }),
      act({ title: 'Call a friend', icon: '❤️', categoryId: 'relationships', priority: 'should', start: '21:45', duration: 30, status: STATUSES.COMPLETED }),
      act({ title: 'Sleep', icon: '😴', categoryId: 'recovery', priority: 'required', start: '23:15', duration: 30, status: STATUSES.COMPLETED }),
    ],
    [
      act({ title: 'Wake up', icon: '☀️', categoryId: 'recovery', priority: 'required', start: '08:30', duration: 30, status: STATUSES.COMPLETED }),
      act({ title: 'Cleaning', icon: '🧹', categoryId: 'life', priority: 'should', start: '10:00', duration: 60, status: STATUSES.COMPLETED }),
      act({ title: 'Budgeting', icon: '💰', categoryId: 'finance', priority: 'should', start: '11:15', duration: 45, status: STATUSES.COMPLETED }),
      act({ title: 'MX-5 drive', icon: '🚗', categoryId: 'pleasure', priority: 'optional', start: '13:00', duration: 90, status: STATUSES.COMPLETED }),
      act({ title: 'Lunch with friends', icon: '❤️', categoryId: 'relationships', priority: 'should', start: '15:00', duration: 90, status: STATUSES.COMPLETED }),
      act({ title: 'Reading', icon: '📚', categoryId: 'mind', priority: 'should', start: '20:00', duration: 40, status: STATUSES.COMPLETED }),
      act({ title: 'Sleep', icon: '😴', categoryId: 'recovery', priority: 'required', start: '23:30', duration: 30, status: STATUSES.COMPLETED }),
    ],
  ];
  return variants[dayOffset % variants.length];
}

function buildTomorrowDraft() {
  return [
    act({ title: 'Wake up', icon: '☀️', categoryId: 'recovery', priority: 'required', start: '08:00', duration: 30 }),
    act({ title: 'Deep Work', icon: '💻', categoryId: 'career', priority: 'required', start: '09:00', duration: 180 }),
    act({ title: 'Lunch', icon: '🍝', categoryId: 'life', priority: 'required', start: '12:00', duration: 45 }),
    act({ title: 'Running', icon: '🏃', categoryId: 'body', priority: 'required', start: '13:00', duration: 60, fixed: false }),
    act({ title: 'MX-5 drive', icon: '🚗', categoryId: 'pleasure', priority: 'optional', start: '15:30', duration: 60 }),
    act({ title: 'Reading', icon: '📚', categoryId: 'mind', priority: 'should', start: '17:00', duration: 40, fixed: false }),
    act({ title: 'Gaming', icon: '🎮', categoryId: 'pleasure', priority: 'optional', start: '20:00', duration: 90 }),
    act({ title: 'Sleep', icon: '😴', categoryId: 'recovery', priority: 'required', start: '23:30', duration: 30 }),
  ];
}

function buildDayAfterDraft() {
  return [
    act({ title: 'Wake up', icon: '☀️', categoryId: 'recovery', priority: 'required', start: '09:00', duration: 30 }),
    act({ title: 'Football', icon: '⚽', categoryId: 'body', priority: 'required', start: '11:00', duration: 90 }),
    act({ title: 'Lunch', icon: '🍝', categoryId: 'life', priority: 'required', start: '13:00', duration: 45 }),
    act({ title: 'Meet a friend', icon: '❤️', categoryId: 'relationships', priority: 'should', start: null, duration: 90, fixed: false }),
    act({ title: 'Gaming', icon: '🎮', categoryId: 'pleasure', priority: 'optional', start: '20:30', duration: 90 }),
  ];
}

function templateItem({ title, icon, categoryId, priority, start, duration, fixed = true }) {
  return { id: id('ti'), title, icon, categoryId, priority, start: start != null ? clockToMinutes(start) : null, duration, fixed };
}

/** A standalone reusable activity — same shape as a template item, but not tied to any template. */
function dictionaryItem({ title, icon, categoryId, priority, start = null, duration, fixed = true }) {
  return { id: id('ad'), title, icon, categoryId, priority, start: start != null ? clockToMinutes(start) : null, duration, fixed };
}

function buildActivityDictionary() {
  return [
    dictionaryItem({ title: 'Gym', icon: '🏋️', categoryId: 'body', priority: 'required', duration: 75 }),
    dictionaryItem({ title: 'Running', icon: '🏃', categoryId: 'body', priority: 'should', duration: 45, fixed: false }),
    dictionaryItem({ title: 'Reading', icon: '📚', categoryId: 'mind', priority: 'should', duration: 30, fixed: false }),
    dictionaryItem({ title: 'Meditation', icon: '🧘', categoryId: 'mind', priority: 'optional', duration: 15, fixed: false }),
    dictionaryItem({ title: 'Deep Work', icon: '💻', categoryId: 'career', priority: 'required', duration: 120 }),
    dictionaryItem({ title: 'Groceries', icon: '🛒', categoryId: 'life', priority: 'should', duration: 30, fixed: false }),
  ];
}

function buildTemplates() {
  return [
    {
      id: 'tpl_workday',
      name: 'Workday',
      icon: '💼',
      items: [
        templateItem({ title: 'Wake up', icon: '☀️', categoryId: 'recovery', priority: 'required', start: '07:00', duration: 30 }),
        templateItem({ title: 'Deep Work', icon: '💻', categoryId: 'career', priority: 'required', start: '09:00', duration: 180 }),
        templateItem({ title: 'Lunch', icon: '🍝', categoryId: 'life', priority: 'required', start: '12:30', duration: 45 }),
        templateItem({ title: 'Work', icon: '💼', categoryId: 'career', priority: 'required', start: '13:30', duration: 210 }),
        templateItem({ title: 'Reading', icon: '📚', categoryId: 'mind', priority: 'should', start: '20:00', duration: 30, fixed: false }),
        templateItem({ title: 'Sleep', icon: '😴', categoryId: 'recovery', priority: 'required', start: '23:00', duration: 30 }),
      ],
    },
    {
      id: 'tpl_training',
      name: 'Training Day',
      icon: '🏋️',
      items: [
        templateItem({ title: 'Wake up', icon: '☀️', categoryId: 'recovery', priority: 'required', start: '08:00', duration: 30 }),
        templateItem({ title: 'Work', icon: '💼', categoryId: 'career', priority: 'required', start: '09:00', duration: 240 }),
        templateItem({ title: 'Lunch', icon: '🍝', categoryId: 'life', priority: 'required', start: '13:00', duration: 45 }),
        templateItem({ title: 'Gym', icon: '🏋️', categoryId: 'body', priority: 'required', start: '17:00', duration: 90 }),
        templateItem({ title: 'Dinner', icon: '🍲', categoryId: 'life', priority: 'required', start: '18:30', duration: 45 }),
        templateItem({ title: 'Reading', icon: '📚', categoryId: 'mind', priority: 'should', start: '20:00', duration: 60, fixed: false }),
        templateItem({ title: 'Gaming', icon: '🎮', categoryId: 'pleasure', priority: 'optional', start: '21:00', duration: 90 }),
        templateItem({ title: 'Sleep', icon: '😴', categoryId: 'recovery', priority: 'required', start: '23:30', duration: 30 }),
      ],
    },
    {
      id: 'tpl_football',
      name: 'Football Day',
      icon: '⚽',
      items: [
        templateItem({ title: 'Wake up', icon: '☀️', categoryId: 'recovery', priority: 'required', start: '08:00', duration: 30 }),
        templateItem({ title: 'Work', icon: '💼', categoryId: 'career', priority: 'required', start: '09:00', duration: 240 }),
        templateItem({ title: 'Lunch', icon: '🍝', categoryId: 'life', priority: 'required', start: '13:00', duration: 45 }),
        templateItem({ title: 'Football', icon: '⚽', categoryId: 'body', priority: 'required', start: '19:00', duration: 90 }),
        templateItem({ title: 'Shower & dinner', icon: '🍲', categoryId: 'life', priority: 'required', start: '20:45', duration: 45 }),
        templateItem({ title: 'Sleep', icon: '😴', categoryId: 'recovery', priority: 'required', start: '23:15', duration: 30 }),
      ],
    },
    {
      id: 'tpl_weekend',
      name: 'Weekend',
      icon: '🌴',
      items: [
        templateItem({ title: 'Wake up', icon: '☀️', categoryId: 'recovery', priority: 'required', start: '09:00', duration: 30 }),
        templateItem({ title: 'Brunch', icon: '🍳', categoryId: 'life', priority: 'required', start: '10:30', duration: 45 }),
        templateItem({ title: 'MX-5 drive', icon: '🚗', categoryId: 'pleasure', priority: 'optional', start: '13:00', duration: 90 }),
        templateItem({ title: 'Meet friends', icon: '❤️', categoryId: 'relationships', priority: 'should', start: null, duration: 120, fixed: false }),
        templateItem({ title: 'Gaming', icon: '🎮', categoryId: 'pleasure', priority: 'optional', start: '20:00', duration: 120 }),
        templateItem({ title: 'Sleep', icon: '😴', categoryId: 'recovery', priority: 'required', start: '00:00', duration: 30 }),
      ],
    },
    {
      id: 'tpl_recovery',
      name: 'Recovery Day',
      icon: '🧘',
      items: [
        templateItem({ title: 'Wake up (no alarm)', icon: '☀️', categoryId: 'recovery', priority: 'required', start: '09:00', duration: 30 }),
        templateItem({ title: 'Stretching', icon: '🧘', categoryId: 'body', priority: 'should', start: '10:00', duration: 30, fixed: false }),
        templateItem({ title: 'Light walk', icon: '🚶', categoryId: 'body', priority: 'optional', start: null, duration: 30, fixed: false }),
        templateItem({ title: 'Reading', icon: '📚', categoryId: 'mind', priority: 'should', start: '15:00', duration: 60, fixed: false }),
        templateItem({ title: 'Early sleep', icon: '😴', categoryId: 'recovery', priority: 'required', start: '22:30', duration: 30 }),
      ],
    },
    {
      id: 'tpl_travel',
      name: 'Travel Day',
      icon: '✈️',
      items: [
        templateItem({ title: 'Wake up early', icon: '☀️', categoryId: 'recovery', priority: 'required', start: '05:30', duration: 20 }),
        templateItem({ title: 'Airport / transit', icon: '✈️', categoryId: 'life', priority: 'required', start: '06:30', duration: 180 }),
        templateItem({ title: 'Check in', icon: '🏨', categoryId: 'life', priority: 'required', start: null, duration: 30, fixed: false }),
        templateItem({ title: 'Explore', icon: '🧭', categoryId: 'pleasure', priority: 'optional', start: null, duration: 120, fixed: false }),
        templateItem({ title: 'Sleep', icon: '😴', categoryId: 'recovery', priority: 'required', start: '23:00', duration: 30 }),
      ],
    },
  ];
}

function buildRecurrences() {
  const startDate = todayKey();
  const rule = (o) => ({ interval: 1, monthDay: null, endDate: null, count: null, pausedFrom: null, exceptDates: [], notes: '', createdAt: Date.now(), startDate, weekdays: [], ...o });
  return [
    rule({ id: 'rec_running', title: 'Running', icon: '🏃', categoryId: 'body', priority: 'required', start: null, duration: 60, fixed: false, freq: 'weekly', weekdays: [0, 2, 4] }),
    rule({ id: 'rec_gym', title: 'Gym', icon: '🏋️', categoryId: 'body', priority: 'required', start: clockToMinutes('18:00'), duration: 75, fixed: true, freq: 'weekly', weekdays: [1, 3] }),
    rule({ id: 'rec_reading', title: 'Reading', icon: '📚', categoryId: 'mind', priority: 'should', start: null, duration: 30, fixed: false, freq: 'daily' }),
    rule({ id: 'rec_cleaning', title: 'Cleaning', icon: '🧹', categoryId: 'life', priority: 'should', start: clockToMinutes('10:00'), duration: 45, fixed: true, freq: 'weekly', weekdays: [5] }),
  ];
}

export function buildSeed() {
  const today = todayKey();
  const days = {};

  for (let offset = 6; offset >= 1; offset -= 1) {
    const key = shiftDateKey(today, -offset);
    days[key] = { activities: buildPastDayActivities(6 - offset), materializedRuleIds: RECURRING_IDS };
  }

  days[today] = { activities: buildTodayActivities(), materializedRuleIds: RECURRING_IDS };
  days[shiftDateKey(today, 1)] = { activities: buildTomorrowDraft(), materializedRuleIds: RECURRING_IDS };
  days[shiftDateKey(today, 2)] = { activities: buildDayAfterDraft(), materializedRuleIds: RECURRING_IDS };

  const trackerData = buildSampleTrackers();
  const sampleNotes = buildSampleNotes(trackerData);

  return {
    version: 1,
    categories: DEFAULT_CATEGORIES,
    templates: buildTemplates(),
    activityDictionary: buildActivityDictionary(),
    recurrences: buildRecurrences(),
    days,
    settings: { wakingHoursMinutes: 16 * 60 },
    ...trackerData,
    trackerTemplates: [],
    notes: sampleNotes.notes,
    noteCollections: sampleNotes.collections,
    noteTags: sampleNotes.tags,
  };
}
