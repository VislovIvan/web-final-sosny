// Общее хранилище броней: один ключ localStorage для всех страниц

export const STORAGE_KEY = 'sosny.bookings.v1';

export const STORAGE_PROBLEMS = {
  corrupt: 'Сохранённые брони повреждены и не читаются.',
  blocked: 'Браузер запретил сохранять данные на этом сайте.',
  missing: 'Бронь не найдена: возможно, её уже отменили в другой вкладке.',
};

const STATUSES = ['active', 'cancelled'];

function emptyStore() {
  return { seq: 0, bookings: [] };
}

function isBooking(item) {
  return Boolean(item)
    && typeof item.number === 'string'
    && typeof item.houseId === 'string'
    && typeof item.houseName === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(item.from)
    && Number.isInteger(item.nights) && item.nights > 0
    && Number.isInteger(item.guests) && item.guests > 0
    && Number.isFinite(item.total)
    && STATUSES.includes(item.status);
}

function parseStore(text) {
  const data = JSON.parse(text);
  const valid = Boolean(data)
    && Number.isInteger(data.seq)
    && Array.isArray(data.bookings)
    && data.bookings.every(isBooking);
  if (!valid) throw new TypeError('Неверная структура броней');
  return data;
}

// problem: null, 'corrupt' или 'blocked'; при проблеме страница работает с пустым списком
export function readStore() {
  let text;
  try {
    text = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { store: emptyStore(), problem: 'blocked' };
  }
  if (text === null) return { store: emptyStore(), problem: null };
  try {
    return { store: parseStore(text), problem: null };
  } catch {
    return { store: emptyStore(), problem: 'corrupt' };
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function loadBookings() {
  const { store, problem } = readStore();
  return { bookings: store.bookings, problem };
}

export function formatBookingNumber(seq) {
  return `С-${String(seq).padStart(4, '0')}`;
}

export function addBooking({ house, from, nights, guests }) {
  const { store } = readStore();
  const seq = store.seq + 1;
  const booking = {
    number: formatBookingNumber(seq),
    houseId: house.id,
    houseName: house.name,
    from,
    nights,
    guests,
    total: house.price * nights,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  if (!writeStore({ seq, bookings: [...store.bookings, booking] })) {
    return { ok: false, problem: 'blocked' };
  }
  return { ok: true, booking };
}

export function cancelBooking(number) {
  const { store, problem } = readStore();
  const booking = store.bookings.find((item) => item.number === number && item.status === 'active');
  if (!booking) return { ok: false, problem: problem ?? 'missing' };
  booking.status = 'cancelled';
  if (!writeStore(store)) return { ok: false, problem: 'blocked' };
  return { ok: true, booking };
}

export function resetBookings() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, problem: 'blocked' };
  }
}
