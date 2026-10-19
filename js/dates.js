// Даты строкой YYYY-MM-DD по местному времени, без перевода в UTC

const DAY_MS = 24 * 60 * 60 * 1000;

export function toISODate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseISODate(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  // new Date переносит 31 февраля на март: такую дату считаем неверной
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function todayISO() {
  return toISODate(new Date());
}

export function addDays(iso, days) {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function daysBetween(fromIso, toIso) {
  return Math.round((parseISODate(toIso) - parseISODate(fromIso)) / DAY_MS);
}

// Ночи [заезд, выезд) пересекаются, если каждый заезд раньше чужого выезда
export function rangesOverlap(a, b) {
  return a.from < addDays(b.from, b.nights) && b.from < addDays(a.from, a.nights);
}

const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const dayMonthYear = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const weekdayShort = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });

export function formatDate(iso) {
  const date = parseISODate(iso);
  return (date.getFullYear() === new Date().getFullYear() ? dayMonth : dayMonthYear).format(date);
}

export function formatWeekday(iso) {
  return weekdayShort.format(parseISODate(iso));
}

// «с 25 по 27 октября» или «с 30 октября по 2 ноября»
export function formatStay(from, nights) {
  const to = addDays(from, nights);
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  return sameMonth ? `с ${Number(from.slice(8))} по ${formatDate(to)}` : `с ${formatDate(from)} по ${formatDate(to)}`;
}
