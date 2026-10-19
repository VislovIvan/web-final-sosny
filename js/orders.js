import { initLayout, el, formatPrice, plural, showMessage } from './ui.js';
import { findConflict, getHouse, houseNumber } from './data.js';
import { formatStay, todayISO } from './dates.js';
import { cancelBooking, loadBookings, resetBookings, STORAGE_KEY, STORAGE_PROBLEMS } from './storage.js';

initLayout();

const NIGHT_WORDS = ['ночь', 'ночи', 'ночей'];
const GUEST_WORDS = ['гость', 'гостя', 'гостей'];

const $ = (selector) => document.querySelector(selector);
const list = $('#orders-list');
const empty = $('#orders-empty');
const count = $('#orders-count');
const messages = $('#orders-messages');
const storageNotice = $('#storage-notice');
const resetZone = $('#reset-zone');
const resetButton = $('#reset-demo');
const resetConfirm = $('#reset-confirm');

const LOAD_PROBLEMS = {
  corrupt: `${STORAGE_PROBLEMS.corrupt} Нажмите «Сбросить демо», чтобы начать список заново.`,
  blocked: `${STORAGE_PROBLEMS.blocked} Брони здесь не появятся, пока сохранение запрещено.`,
};

const newNumber = new URLSearchParams(location.search).get('new');

function houseLabel(booking) {
  const house = getHouse(booking.houseId);
  return house ? `Дом ${houseNumber(house)}` : 'Дом';
}

function stayLine(booking) {
  const { from, nights, guests } = booking;
  return `${formatStay(from, nights)} · ${nights} ${plural(nights, NIGHT_WORDS)} · ${guests} ${plural(guests, GUEST_WORDS)}`;
}

// Отменённую бронь можно повторить на те же даты, если они ещё не прошли
function rebookUrl(booking) {
  const params = new URLSearchParams({ id: booking.houseId });
  if (booking.status === 'cancelled' && booking.from >= todayISO()) params.set('from', booking.from);
  params.set('nights', booking.nights);
  params.set('guests', booking.guests);
  return `booking.html?${params}`;
}

// Отмена в два шага на самой карточке: «Отменить» → «Да, отменить» или «Нет»
function cancelControls(booking) {
  const cancelButton = el('button', { type: 'button', class: 'btn btn-sm btn-danger', text: 'Отменить' });
  const yes = el('button', { type: 'button', class: 'btn btn-sm btn-danger', text: 'Да, отменить' });
  const no = el('button', { type: 'button', class: 'btn btn-sm', text: 'Нет' });
  const confirm = el('div', { class: 'confirm', role: 'group', 'aria-label': `Отмена брони ${booking.number}`, hidden: true },
    el('p', { class: 'confirm-question', text: `Отменить бронь ${booking.number}?` }),
    yes,
    no,
  );
  const close = () => {
    confirm.hidden = true;
    cancelButton.hidden = false;
    cancelButton.focus();
  };
  cancelButton.addEventListener('click', () => {
    cancelButton.hidden = true;
    confirm.hidden = false;
    no.focus();
  });
  no.addEventListener('click', close);
  confirm.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  yes.addEventListener('click', () => cancel(booking));
  return [cancelButton, confirm];
}

function renderCard(booking) {
  const active = booking.status === 'active';
  const isNew = booking.number === newNumber;
  const card = el('li', { class: 'card-soft order-card', 'data-number': booking.number },
    el('div', { class: 'order-head' },
      el('span', { class: 'label order-number', text: `${booking.number} · ${houseLabel(booking)}` }),
      isNew ? el('span', { class: 'badge badge-accent', text: 'Новая' }) : null,
      el('span', { class: active ? 'badge badge-ok' : 'badge', text: active ? 'Активна' : 'Отменена' }),
    ),
    el('h2', { class: 'order-house', text: booking.houseName }),
    el('p', { class: 'order-dates', text: stayLine(booking) }),
    el('p', { class: 'order-total', text: formatPrice(booking.total) }),
    el('div', { class: 'order-actions' },
      ...(active ? cancelControls(booking) : []),
      el('a', { class: 'btn btn-sm rebook', href: rebookUrl(booking), text: 'Оформить снова' }),
    ),
  );
  card.classList.toggle('is-new', isNew);
  card.classList.toggle('is-cancelled', !active);
  return card;
}

function render() {
  const { bookings, problem } = loadBookings();
  const sorted = [...bookings].reverse();
  list.replaceChildren(...sorted.map(renderCard));
  empty.hidden = bookings.length > 0;
  const active = bookings.filter((booking) => booking.status === 'active').length;
  count.textContent = bookings.length ? `Активные: ${active} · Отменённые: ${bookings.length - active}` : '';
  showMessage(storageNotice, problem && LOAD_PROBLEMS[problem], 'error');
  resetZone.hidden = bookings.length === 0 && problem !== 'corrupt';
  return { bookings, problem };
}

function cancel(booking) {
  const result = cancelBooking(booking.number);
  if (!result.ok) {
    showMessage(messages, STORAGE_PROBLEMS[result.problem], 'error');
    render();
    return;
  }
  const { bookings } = render();
  // Демо-занятость считается от сегодня, поэтому на те же даты дом может оставаться занятым
  const house = getHouse(booking.houseId);
  const freed = house && !findConflict(house, booking, bookings);
  const tail = freed ? ` Дом «${booking.houseName}» снова свободен ${formatStay(booking.from, booking.nights)}.` : '';
  showMessage(messages, `Бронь ${booking.number} отменена.${tail}`, 'ok');
  list.querySelector(`[data-number="${booking.number}"] .rebook`)?.focus();
}

function toggleResetConfirm(open) {
  resetConfirm.hidden = !open;
  resetButton.hidden = open;
  (open ? $('#reset-no') : resetButton).focus();
}

function initReset() {
  resetButton.addEventListener('click', () => toggleResetConfirm(true));
  $('#reset-no').addEventListener('click', () => toggleResetConfirm(false));
  resetConfirm.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') toggleResetConfirm(false);
  });
  $('#reset-yes').addEventListener('click', () => {
    const result = resetBookings();
    resetConfirm.hidden = true;
    resetButton.hidden = false;
    if (!result.ok) {
      showMessage(messages, STORAGE_PROBLEMS[result.problem], 'error');
      resetButton.focus();
      return;
    }
    render();
    showMessage(messages, 'Демо сброшено: брони из этого браузера удалены.', 'ok');
    $('#empty-link').focus();
  });
}

function init() {
  initReset();
  const { bookings } = render();
  const created = bookings.find((booking) => booking.number === newNumber);
  if (created) {
    showMessage(messages, `Бронь ${created.number} оформлена: «${created.houseName}», ${formatStay(created.from, created.nights)}. Оплата не нужна, это учебная бронь.`, 'ok');
  }

  // Брони из другой вкладки и возврат кнопкой «Назад»
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) render();
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) render();
  });
}

init();
