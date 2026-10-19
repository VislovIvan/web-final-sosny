import { initLayout, el, icon, formatPrice, plural, showMessage } from './ui.js';
import { MAX_DAYS_AHEAD, findConflict, getHouse, houseNumber, validateStay } from './data.js';
import { addDays, formatDate, formatStay, formatWeekday, todayISO } from './dates.js';
import { addBooking, loadBookings, STORAGE_KEY, STORAGE_PROBLEMS } from './storage.js';
import {
  FORECAST_DAYS,
  WeatherError,
  describeWeather,
  fetchDailyForecast,
  formatTemperature,
  weatherKind,
} from './weather.js';

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
const confirmButton = $('#confirm');
const CONFIRM_TEXT = confirmButton.textContent;

const params = new URLSearchParams(location.search);
const houseId = params.get('id');
const house = getHouse(houseId);
const touched = new Set();
let bookings = [];
let submitting = false;

const LOAD_PROBLEMS = {
  corrupt: `${STORAGE_PROBLEMS.corrupt} Новая бронь начнёт список заново.`,
  blocked: `${STORAGE_PROBLEMS.blocked} Сумму посчитать можно, но бронь не сохранится.`,
};

function conflictText(conflict) {
  const stay = formatStay(conflict.from, conflict.nights);
  return conflict.booking
    ? `На эти даты у вас уже есть бронь ${conflict.booking.number} ${stay}. Выберите другие даты.`
    : `Дом занят ${stay}. Выберите другую дату заезда или меньше ночей.`;
}

function readRaw() {
  return Object.fromEntries(FIELDS.map((name) => [name, inputs[name].validity.badInput ? 'bad' : inputs[name].value]));
}

// Пересчёт итога и ошибок; ошибки поля видны после первого ввода в него, занятость сразу
function update() {
  const raw = readRaw();
  const errors = validateStay(raw, house.capacity);
  const nights = Number(raw.nights);
  const checkout = errors.from || errors.nights ? null : addDays(raw.from, nights);
  const conflict = checkout ? findConflict(house, { from: raw.from, nights }, bookings) : null;

  for (const name of FIELDS) {
    let text = touched.has(name) ? errors[name] ?? '' : '';
    if (name === 'from' && !text && conflict) text = conflictText(conflict);
    errorOutputs[name].textContent = text;
    if (text) inputs[name].setAttribute('aria-invalid', 'true');
    else inputs[name].removeAttribute('aria-invalid');
  }

  fromHint.textContent = checkout ? `Выезд ${formatDate(checkout)}, ${formatWeekday(checkout)}` : '';
  const back = new URLSearchParams();
  if (checkout) {
    back.set('from', raw.from);
    back.set('nights', nights);
  }
  if (!errors.guests) back.set('guests', raw.guests);
  $('#change-house').href = `catalog.html?${back}`;

  updateForecast(checkout ? { from: raw.from, nights } : null);

  if (errors.nights) {
    totalCalc.textContent = 'Сумма появится, когда число ночей будет от 1 до 30.';
    totalValue.textContent = '';
  } else {
    totalCalc.textContent = `${formatPrice(house.price)} × ${nights} ${plural(nights, NIGHT_WORDS)}`;
    totalValue.textContent = formatPrice(house.price * nights);
  }
  return { errors, conflict, values: { from: raw.from, nights, guests: Number(raw.guests) } };
}

// Прогноз на 16 дней загружается один раз, смена дат только перерисовывает строки
const forecast = {
  box: $('#forecast'),
  note: $('#forecast-note'),
  loading: $('#forecast-loading'),
  list: $('#forecast-list'),
  error: $('#forecast-error'),
  errorText: $('#forecast-error-text'),
  days: null,
  status: 'idle',
  stay: null,
  key: '',
  controller: null,
};

function forecastRow(date) {
  const { min, max, code } = forecast.days.get(date);
  return el('li', { class: 'forecast-day' },
    el('span', { class: 'forecast-date', text: `${formatWeekday(date)}, ${formatDate(date)}` }),
    el('span', { class: 'forecast-desc' }, icon(weatherKind(code)), describeWeather(code)),
    el('span', { class: 'forecast-temp', text: `от ${formatTemperature(min, false)} до ${formatTemperature(max)}` }),
  );
}

function renderForecast() {
  const { stay, status } = forecast;
  const lastDay = addDays(todayISO(), FORECAST_DAYS - 1);
  let note = '';
  let rows = [];
  if (!stay) {
    note = 'Укажите дату заезда и число ночей, чтобы увидеть прогноз.';
  } else if (stay.from > lastDay) {
    const opens = addDays(stay.from, 1 - FORECAST_DAYS);
    note = `Прогноз на ${formatDate(stay.from)} появится ближе к дате: Open-Meteo считает погоду на ${FORECAST_DAYS} дней вперёд. Загляните сюда с ${formatDate(opens)}.`;
  } else if (status === 'idle') {
    loadForecast();
    return;
  } else if (status === 'ready') {
    const days = Array.from({ length: stay.nights + 1 }, (_, index) => addDays(stay.from, index));
    const known = days.filter((day) => forecast.days.has(day));
    rows = known.map(forecastRow);
    if (!known.length) note = 'Прогноз на эти даты появится ближе к поездке.';
    else if (known.length < days.length) note = `Дальше ${formatDate(known.at(-1))} прогноза пока нет.`;
  }
  const waiting = Boolean(stay) && stay.from <= lastDay;
  forecast.note.textContent = note;
  forecast.list.replaceChildren(...rows);
  forecast.loading.hidden = !(waiting && status === 'loading');
  forecast.error.hidden = !(waiting && status === 'error');
  forecast.box.setAttribute('aria-busy', String(waiting && status === 'loading'));
}

function updateForecast(stay) {
  const key = `${stay ? `${stay.from}/${stay.nights}` : 'none'}/${forecast.status}`;
  if (key === forecast.key) return;
  forecast.key = key;
  forecast.stay = stay;
  renderForecast();
}

async function loadForecast() {
  forecast.controller?.abort();
  const controller = new AbortController();
  forecast.controller = controller;
  const setStatus = (status) => {
    forecast.status = status;
    forecast.key = '';
    updateForecast(forecast.stay);
  };
  setStatus('loading');
  try {
    forecast.days = await fetchDailyForecast(controller.signal);
    setStatus('ready');
  } catch (error) {
    if (controller.signal.aborted) return;
    const reason = error instanceof WeatherError ? error.message : 'Попробуйте ещё раз.';
    forecast.errorText.textContent = `Не удалось загрузить прогноз. ${reason} Бронь можно оформить и без него.`;
    setStatus('error');
  }
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

function refreshBookings() {
  const loaded = loadBookings();
  bookings = loaded.bookings;
  showMessage(formMessages, loaded.problem && LOAD_PROBLEMS[loaded.problem], 'error');
}

function setSubmitting(value) {
  submitting = value;
  confirmButton.disabled = value;
  confirmButton.textContent = value ? 'Сохраняем бронь' : CONFIRM_TEXT;
}

// Второе нажатие до перехода игнорируется, запись создаётся одна
function submit(event) {
  event.preventDefault();
  if (submitting) return;
  FIELDS.forEach((name) => touched.add(name));
  refreshBookings();
  const { errors, conflict, values } = update();
  const invalid = FIELDS.find((name) => errors[name]) ?? (conflict ? 'from' : null);
  if (invalid) {
    inputs[invalid].focus();
    return;
  }

  setSubmitting(true);
  const result = addBooking({ house, ...values });
  if (!result.ok) {
    setSubmitting(false);
    const extra = result.problem === 'overlap' ? ` Номер ${result.booking.number}.` : ' Бронь не сохранена.';
    showMessage(formMessages, `${STORAGE_PROBLEMS[result.problem]}${extra}`, 'error');
    refreshBookings();
    update();
    return;
  }
  location.assign(`orders.html?new=${encodeURIComponent(result.booking.number)}`);
}

// Значения из ссылки каталога проверяются сразу, пустые заменяются значениями по умолчанию
function prefill(today) {
  const defaults = { from: addDays(today, 1), nights: '2', guests: String(Math.min(2, house.capacity)) };
  for (const name of FIELDS) {
    const value = params.get(name);
    if (value) {
      inputs[name].value = value;
      touched.add(name);
    } else {
      inputs[name].value = defaults[name];
    }
  }
}

function initBooking() {
  const today = todayISO();
  inputs.from.min = today;
  inputs.from.max = addDays(today, MAX_DAYS_AHEAD);
  inputs.guests.max = String(house.capacity);
  prefill(today);

  document.title = `Бронь: ${house.name} · Сосны`;
  fillHouse();
  refreshBookings();
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
  $('#forecast-retry').addEventListener('click', () => {
    inputs.from.focus();
    loadForecast();
  });

  // Возврат кнопкой «Назад» после брони и брони из другой вкладки
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    setSubmitting(false);
    refreshBookings();
    update();
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    refreshBookings();
    update();
  });
}

function showMissing() {
  $('#missing-text').textContent = houseId
    ? `Дом «${houseId.slice(0, 30)}» не найден: ссылка неверная или устарела. Выберите дом в каталоге.`
    : 'Дом не выбран. Выберите свободный дом в каталоге, и он появится здесь вместе с датами.';
  $('#booking-missing').hidden = false;
}

if (house) initBooking();
else showMissing();
