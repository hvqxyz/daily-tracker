// Date-key (YYYY-MM-DD, local time) and clock-time (minutes-since-midnight)
// helpers used throughout the app. Kept dependency-free.

export function todayKey() {
  return dateToKey(new Date());
}

export function dateToKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function keyToDate(key) {
  return new Date(`${key}T00:00:00`);
}

export function shiftDateKey(key, days) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + days);
  return dateToKey(d);
}

export function weekdayIndex(key) {
  // Monday = 0 .. Sunday = 6
  return (keyToDate(key).getDay() + 6) % 7;
}

export function startOfWeekKey(key) {
  return shiftDateKey(key, -weekdayIndex(key));
}

export function formatDayHeading(key) {
  const d = keyToDate(key);
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatDateDMY(key) {
  if (!key) return '—';
  const d = keyToDate(key);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export function formatMonthYear(key) {
  const d = keyToDate(key);
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function formatShortDay(key) {
  const d = keyToDate(key);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function minutesToClock(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function clockToMinutes(clock) {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
}

export function formatClock12(clock) {
  const [h, m] = clock.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function clampMinutes(m, min = 0, max = 1440) {
  return Math.min(Math.max(m, min), max);
}

export function snapMinutes(m, step = 5) {
  return Math.round(m / step) * step;
}

export function formatRelativeTime(ms) {
  if (!ms) return 'never';
  const diff = Date.now() - ms;
  if (diff < 45 * 1000) return 'just now';
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
