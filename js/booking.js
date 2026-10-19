import { initLayout, el, formatPrice, plural, showMessage } from './ui.js';
import { MAX_DAYS_AHEAD, getHouse, houseNumber, validateStay } from './data.js';
import { addDays, formatDate, formatWeekday, todayISO } from './dates.js';
import { addBooking, STORAGE_PROBLEMS } from './storage.js';

initLayout();

const NIGHT_WORDS = ['ночь', 'ночи', 'ночей'];
const FIELDS = ['from', 'nights', 'guests'];

const $ = (selector) => document.querySelector(selector);
const form = $('#booking-form');
const inputs = Object.fromEntries(FIELDS.map((name) => [name, form.elements[name]]));
const errorOutputs = Object.fromEntries(FIELDS.map((name) => [name, $(`#${name}-error`)]));
const fromHint = $('#from-hint');
const totalCalc = $('#total-calc');
const totalValue = $('#total-value');
const formMessages = $('#form-messages');

const house = getHouse(new URLSearchParams(location.search).get('id'));
const touched = new Set();

function readRaw() {
  return Object.fromEntries(FIELDS.map((name) => [name, inputs[name].validity.badInput ? 'bad' : inputs[name].value]));
}

// Пересчёт итога и ошибок; ошибки поля видны после первого ввода в него
function update() {
  const raw = readRaw();
  const errors = validateStay(raw, house.capacity);
  for (const name of FIELDS) {
    const text = touched.has(name) ? errors[name] ?? '' : '';
    errorOutputs[name].textContent = text;
    if (text) inputs[name].setAttribute('aria-invalid', 'true');
    else inputs[name].removeAttribute('aria-invalid');
  }

  const nights = Number(raw.nights);
  const checkout = errors.from || errors.nights ? null : addDays(raw.from, nights);
  fromHint.textContent = checkout ? `Выезд ${formatDate(checkout)}, ${formatWeekday(checkout)}` : '';
  if (errors.nights) {
    totalCalc.textContent = 'Сумма появится, когда число ночей будет от 1 до 30.';
    totalValue.textContent = '';
  } else {
    totalCalc.textContent = `${formatPrice(house.price)} × ${nights} ${plural(nights, NIGHT_WORDS)}`;
    totalValue.textContent = formatPrice(house.price * nights);
  }
  return { errors, values: { from: raw.from, nights, guests: Number(raw.guests) } };
}

function fillHouse() {
  $('#house-num').textContent = `Дом ${houseNumber(house)}`;
  $('#house-name').textContent = house.name;
  $('#house-desc').textContent = house.description;
  $('#house-tags').replaceChildren(...house.features.map((feature) => el('li', { class: 'tag', text: feature })));
  $('#house-capacity').textContent = `до ${house.capacity} гостей`;
  $('#house-price').textContent = formatPrice(house.price);
  $('#guests-hint').textContent = `В этом доме до ${house.capacity} гостей.`;
}

function submit(event) {
  event.preventDefault();
  FIELDS.forEach((name) => touched.add(name));
  const { errors, values } = update();
  const invalid = FIELDS.find((name) => errors[name]);
  if (invalid) {
    inputs[invalid].focus();
    return;
  }
  const result = addBooking({ house, ...values });
  if (!result.ok) {
    showMessage(formMessages, `${STORAGE_PROBLEMS[result.problem]} Бронь не сохранена.`, 'error');
    return;
  }
  location.assign(`orders.html?new=${encodeURIComponent(result.booking.number)}`);
}

function initBooking() {
  const today = todayISO();
  inputs.from.min = today;
  inputs.from.max = addDays(today, MAX_DAYS_AHEAD);
  inputs.guests.max = String(house.capacity);
  inputs.from.value = addDays(today, 1);
  inputs.nights.value = '2';
  inputs.guests.value = String(Math.min(2, house.capacity));

  fillHouse();
  $('#booking-layout').hidden = false;
  update();

  for (const input of Object.values(inputs)) {
    input.addEventListener('input', update);
    input.addEventListener('change', () => {
      touched.add(input.name);
      update();
    });
  }
  form.addEventListener('submit', submit);
}

if (house) {
  initBooking();
} else {
  $('#missing-text').textContent = 'Дом не найден. Выберите дом в каталоге.';
  $('#booking-missing').hidden = false;
}
