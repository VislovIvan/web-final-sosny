import { initLayout, el, icon, formatPrice, plural, showMessage } from './ui.js';
import { HOUSES, MAX_DAYS_AHEAD, getHouse, houseNumber, findConflict, validateStay } from './data.js';
import { addDays, formatDate, formatStay, todayISO } from './dates.js';
import { loadBookings, STORAGE_KEY, STORAGE_PROBLEMS } from './storage.js';

initLayout();

const NIGHT_WORDS = ['ночь', 'ночи', 'ночей'];

const STATUS = {
  free: { text: 'Свободен', badge: 'badge-ok', icon: null },
  selected: { text: 'Выбран', badge: 'badge-accent', icon: 'check' },
  busy: { text: 'Занят', badge: 'badge-danger', icon: 'lock' },
};

const $ = (selector) => document.querySelector(selector);
const form = $('#filters');
const fromInput = $('#from');
const nightsInput = $('#nights');
const datesError = $('#dates-error');
const map = $('#map');
const list = $('#house-list');
const resultCount = $('#result-count');
const storageNotice = $('#storage-notice');
const messages = $('#catalog-messages');
const selectionStatus = $('#selection-status');
const pickCard = $('#pick-card');
const pick = {
  num: $('#pick-num'),
  name: $('#pick-name'),
  desc: $('#pick-desc'),
  tags: $('#pick-tags'),
  from: $('#pick-from'),
  to: $('#pick-to'),
  capacity: $('#pick-capacity'),
  price: $('#pick-price'),
  totalLabel: $('#pick-total-label'),
  total: $('#pick-total'),
  link: $('#pick-link'),
};

const state = {
  stay: { from: addDays(todayISO(), 1), nights: 2 },
  selectedId: null,
  bookings: [],
};

const views = new Map();

function houseTitle(house) {
  return `Дом ${houseNumber(house)} «${house.name}»`;
}

function busyLine(conflict) {
  const stay = formatStay(conflict.from, conflict.nights);
  return conflict.booking ? `Ваша бронь ${conflict.booking.number} ${stay}` : `Занят ${stay}`;
}

function buildViews() {
  for (const house of HOUSES) {
    const number = houseNumber(house);
    const mark = el('span', { class: 'map-house-mark', 'aria-hidden': 'true' });
    const marker = el('button', { type: 'button', class: 'map-house', 'aria-pressed': 'false' },
      el('span', { 'aria-hidden': 'true', text: number }),
      mark,
      el('span', { class: 'map-house-name', 'aria-hidden': 'true', text: house.name }),
    );
    marker.style.setProperty('--x', `${house.x}%`);
    marker.style.setProperty('--y', `${house.y}%`);
    marker.addEventListener('click', () => choose(house.id));

    const numBox = el('span', { class: 'house-num', 'aria-hidden': 'true', text: number });
    const busyText = el('span', { class: 'house-busy' });
    const status = el('span', { class: 'badge' });
    const row = el('button', { type: 'button', class: 'house-row', 'aria-pressed': 'false' },
      numBox,
      el('span', { class: 'house-main' },
        el('span', { class: 'house-name' }, el('span', { class: 'visually-hidden', text: `Дом ${number}: ` }), house.name),
        el('span', { class: 'house-desc', text: house.description }),
        busyText,
        el('span', { class: 'house-tags' },
          el('span', { class: 'tag', text: `до ${house.capacity} гостей` }),
          ...house.features.map((feature) => el('span', { class: 'tag', text: feature })),
        ),
      ),
      el('span', { class: 'house-side' },
        el('span', { class: 'price', text: formatPrice(house.price) }),
        status,
      ),
    );
    row.addEventListener('click', () => choose(house.id));

    map.append(marker);
    list.append(el('li', {}, row));
    views.set(house.id, { marker, mark, row, numBox, busyText, status });
  }
}

function render() {
  let free = 0;
  for (const house of HOUSES) {
    const view = views.get(house.id);
    const conflict = findConflict(house, state.stay, state.bookings);
    const kind = conflict ? 'busy' : state.selectedId === house.id ? 'selected' : 'free';
    const status = STATUS[kind];
    if (!conflict) free += 1;

    for (const node of [view.marker, view.row]) {
      node.setAttribute('aria-pressed', String(kind === 'selected'));
      node.classList.toggle('is-busy', kind === 'busy');
      if (kind === 'busy') node.setAttribute('aria-disabled', 'true');
      else node.removeAttribute('aria-disabled');
    }
    view.marker.classList.toggle('hatch', kind === 'busy');
    view.numBox.classList.toggle('hatch', kind === 'busy');
    view.marker.setAttribute(
      'aria-label',
      `${houseTitle(house)}: ${status.text.toLowerCase()}, до ${house.capacity} гостей, ${formatPrice(house.price)} за ночь`,
    );
    view.mark.replaceChildren(...(status.icon ? [icon(status.icon)] : []));
    view.status.className = `badge ${status.badge}`;
    view.status.replaceChildren(...(status.icon ? [icon(status.icon)] : []), status.text);
    view.busyText.textContent = conflict ? busyLine(conflict) : '';
  }

  const stay = formatStay(state.stay.from, state.stay.nights);
  resultCount.textContent = `${stay[0].toUpperCase()}${stay.slice(1)}: свободно ${free} из ${HOUSES.length}`;
  renderPick();
}

function renderPick() {
  const house = getHouse(state.selectedId);
  pickCard.classList.toggle('is-empty', !house);
  document.body.classList.toggle('has-pick', Boolean(house));
  if (!house) return;

  const { from, nights } = state.stay;
  pick.num.textContent = `Дом ${houseNumber(house)}`;
  pick.name.textContent = house.name;
  pick.desc.textContent = house.description;
  pick.tags.replaceChildren(...house.features.map((feature) => el('li', { class: 'tag', text: feature })));
  pick.from.textContent = formatDate(from);
  pick.to.textContent = formatDate(addDays(from, nights));
  pick.capacity.textContent = `до ${house.capacity} гостей`;
  pick.price.textContent = formatPrice(house.price);
  pick.totalLabel.textContent = `Итого за ${nights} ${plural(nights, NIGHT_WORDS)}`;
  pick.total.textContent = formatPrice(house.price * nights);
  const params = new URLSearchParams({ id: house.id, from, nights, guests: Math.min(2, house.capacity) });
  pick.link.href = `booking.html?${params}`;
}

function choose(id) {
  const house = getHouse(id);
  const conflict = findConflict(house, state.stay, state.bookings);
  if (conflict) {
    const stay = formatStay(conflict.from, conflict.nights);
    const reason = conflict.booking ? `занят вашей бронью ${conflict.booking.number} ${stay}` : `занят ${stay}`;
    showMessage(messages, `${houseTitle(house)} ${reason}. Выберите другие даты или свободный дом.`);
    return;
  }
  state.selectedId = state.selectedId === id ? null : id;
  showMessage(messages, '');
  selectionStatus.textContent = state.selectedId
    ? `Выбран ${houseTitle(house)}, итого ${formatPrice(house.price * state.stay.nights)}.`
    : 'Выбор снят.';
  render();
}

// Выбранный дом мог стать занятым после смены дат или отмены в другой вкладке
function dropBusySelection() {
  const house = getHouse(state.selectedId);
  if (house && findConflict(house, state.stay, state.bookings)) {
    state.selectedId = null;
    showMessage(messages, `${houseTitle(house)} занят на эти даты, выбор снят.`);
  }
}

function readDates({ strict }) {
  const raw = { from: fromInput.value, nights: nightsInput.validity.badInput ? 'bad' : nightsInput.value };
  const errors = validateStay(raw);
  const error = errors.from || errors.nights;
  if (error) {
    if (!strict) return;
    datesError.textContent = `${error} Пока показана занятость ${formatStay(state.stay.from, state.stay.nights)}.`;
    fromInput.setAttribute('aria-invalid', String(Boolean(errors.from)));
    nightsInput.setAttribute('aria-invalid', String(Boolean(errors.nights)));
    return;
  }
  datesError.textContent = '';
  fromInput.removeAttribute('aria-invalid');
  nightsInput.removeAttribute('aria-invalid');

  const stay = { from: raw.from, nights: Number(raw.nights) };
  if (stay.from === state.stay.from && stay.nights === state.stay.nights) return;
  state.stay = stay;
  showMessage(messages, '');
  dropBusySelection();
  render();
}

function refreshBookings() {
  const { bookings, problem } = loadBookings();
  state.bookings = bookings;
  const text = problem && `${STORAGE_PROBLEMS[problem]} Занятость показана только по демо-данным.`;
  showMessage(storageNotice, text, 'error');
}

function init() {
  const today = todayISO();
  fromInput.min = today;
  fromInput.max = addDays(today, MAX_DAYS_AHEAD);
  fromInput.value = state.stay.from;
  nightsInput.value = String(state.stay.nights);

  buildViews();
  refreshBookings();
  render();

  for (const input of [fromInput, nightsInput]) {
    input.addEventListener('input', () => readDates({ strict: false }));
    input.addEventListener('change', () => readDates({ strict: true }));
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    readDates({ strict: true });
  });

  const update = () => {
    refreshBookings();
    dropBusySelection();
    render();
  };
  // Возврат кнопкой «Назад» и брони из другой вкладки
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) update();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) update();
  });
}

init();
