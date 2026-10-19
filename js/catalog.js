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
const guestsSelect = $('#guests');
const priceSelect = $('#price');
const datesError = $('#dates-error');
const resultCount = $('#result-count');
const resetButton = $('#reset-filters');
const storageNotice = $('#storage-notice');
const messages = $('#catalog-messages');
const selectionStatus = $('#selection-status');
const map = $('#map');
const mapEmpty = $('#map-empty');
const list = $('#house-list');
const listEmpty = $('#list-empty');
const emptyReset = $('#empty-reset');
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
  guests: 0,
  price: 0,
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

// 0 в фильтре значит «любое»
function matchesFilters(house) {
  return house.capacity >= state.guests && (!state.price || house.price <= state.price);
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
    const item = el('li', {}, row);

    map.append(marker);
    list.append(item);
    views.set(house.id, { marker, mark, row, item, numBox, busyText, status });
  }
}

function render() {
  let shown = 0;
  let free = 0;
  for (const house of HOUSES) {
    const view = views.get(house.id);
    const visible = matchesFilters(house);
    const conflict = findConflict(house, state.stay, state.bookings);
    const kind = conflict ? 'busy' : state.selectedId === house.id ? 'selected' : 'free';
    const status = STATUS[kind];
    if (visible) {
      shown += 1;
      if (!conflict) free += 1;
    }

    view.marker.hidden = !visible;
    view.item.hidden = !visible;
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

  mapEmpty.hidden = shown > 0;
  listEmpty.hidden = shown > 0;
  const stay = formatStay(state.stay.from, state.stay.nights);
  const total = HOUSES.length;
  const counts = shown === total ? `свободно ${free} из ${total}` : `подходят ${shown} из ${total}, свободно ${free}`;
  resultCount.textContent = `${stay[0].toUpperCase()}${stay.slice(1)}: ${counts}`;
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
  const guests = Math.min(state.guests || 2, house.capacity);
  pick.link.href = `booking.html?${new URLSearchParams({ id: house.id, from, nights, guests })}`;
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

// Выбор снимается, если дом скрыт фильтром или занят на новые даты
function dropHiddenSelection() {
  const house = getHouse(state.selectedId);
  if (!house) return;
  if (!matchesFilters(house)) {
    state.selectedId = null;
    showMessage(messages, `${houseTitle(house)} не подходит под фильтр, выбор снят.`);
  } else if (findConflict(house, state.stay, state.bookings)) {
    state.selectedId = null;
    showMessage(messages, `${houseTitle(house)} занят на эти даты, выбор снят.`);
  }
}

function syncUrl() {
  const params = new URLSearchParams({ from: state.stay.from, nights: state.stay.nights });
  if (state.guests) params.set('guests', state.guests);
  if (state.price) params.set('price', state.price);
  history.replaceState(null, '', `?${params}`);
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
  dropHiddenSelection();
  syncUrl();
  render();
}

function applyFilters() {
  state.guests = Number(guestsSelect.value) || 0;
  state.price = Number(priceSelect.value) || 0;
  showMessage(messages, '');
  dropHiddenSelection();
  syncUrl();
  render();
}

function resetFilters() {
  guestsSelect.value = '';
  priceSelect.value = '';
  applyFilters();
}

// Параметры из ссылки главной: неверные заменяются значениями по умолчанию
function readUrl() {
  const params = new URLSearchParams(location.search);
  const raw = { from: params.get('from') ?? state.stay.from, nights: params.get('nights') ?? String(state.stay.nights) };
  const errors = validateStay(raw);
  if (!errors.from) state.stay.from = raw.from;
  if (!errors.nights) state.stay.nights = Number(raw.nights);
  if (errors.from || errors.nights) {
    showMessage(messages, 'Даты из ссылки не подошли, поэтому показаны даты по умолчанию.');
  }

  const guests = params.get('guests');
  if ([...guestsSelect.options].some((option) => option.value && option.value === guests)) state.guests = Number(guests);
  const price = params.get('price');
  if ([...priceSelect.options].some((option) => option.value && option.value === price)) state.price = Number(price);
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
  readUrl();
  fromInput.value = state.stay.from;
  nightsInput.value = String(state.stay.nights);
  guestsSelect.value = state.guests ? String(state.guests) : '';
  priceSelect.value = state.price ? String(state.price) : '';

  buildViews();
  refreshBookings();
  render();

  for (const input of [fromInput, nightsInput]) {
    input.addEventListener('input', () => readDates({ strict: false }));
    input.addEventListener('change', () => readDates({ strict: true }));
  }
  guestsSelect.addEventListener('change', applyFilters);
  priceSelect.addEventListener('change', applyFilters);
  resetButton.addEventListener('click', resetFilters);
  emptyReset.addEventListener('click', () => {
    resetFilters();
    guestsSelect.focus();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    readDates({ strict: true });
  });

  const update = () => {
    refreshBookings();
    dropHiddenSelection();
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
