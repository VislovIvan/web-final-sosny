import { initLayout, icon } from './ui.js';
import { MAX_DAYS_AHEAD, MAX_GUESTS, validateStay } from './data.js';
import { addDays, todayISO } from './dates.js';
import { WeatherError, describeWeather, fetchCurrentWeather, formatTemperature, weatherKind } from './weather.js';

initLayout();

const pickForm = document.querySelector('#pick-form');
const pickFields = ['from', 'nights', 'guests'].map((name) => pickForm.elements[name]);

function checkPickForm() {
  const raw = Object.fromEntries(pickFields.map((input) => [input.name, input.validity.badInput ? 'bad' : input.value]));
  const errors = validateStay(raw);
  for (const input of pickFields) {
    const error = errors[input.name] ?? '';
    document.getElementById(`${input.id}-error`).textContent = error;
    if (error) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
  return pickFields.find((input) => errors[input.name]);
}

function initPicker() {
  const today = todayISO();
  const [from, nights, guests] = pickFields;
  from.min = today;
  from.max = addDays(today, MAX_DAYS_AHEAD);
  from.value = addDays(today, 1);
  nights.value = '2';
  guests.value = '2';
  guests.max = String(MAX_GUESTS);

  // Форма уходит в каталог обычным GET-запросом, JS только проверяет поля
  pickForm.addEventListener('submit', (event) => {
    const invalid = checkPickForm();
    if (!invalid) return;
    event.preventDefault();
    invalid.focus();
  });
  for (const input of pickFields) {
    input.addEventListener('input', () => {
      if (input.hasAttribute('aria-invalid')) checkPickForm();
    });
  }
}

const weather = {
  box: document.querySelector('#weather'),
  loading: document.querySelector('#weather-loading'),
  result: document.querySelector('#weather-result'),
  error: document.querySelector('#weather-error'),
  refresh: document.querySelector('#weather-refresh'),
};
let weatherController = null;

function setWeatherState(state) {
  weather.loading.hidden = state !== 'loading';
  weather.result.hidden = state !== 'result';
  weather.error.hidden = state !== 'error';
  weather.box.setAttribute('aria-busy', String(state === 'loading'));
}

function renderWeather(data) {
  document.querySelector('#weather-icon').replaceChildren(icon(weatherKind(data.code)));
  document.querySelector('#weather-temp').textContent = formatTemperature(data.temperature);
  document.querySelector('#weather-desc').textContent = describeWeather(data.code);
  document.querySelector('#weather-feels').textContent = formatTemperature(data.feelsLike);
  document.querySelector('#weather-wind').textContent = `${Math.round(data.wind)} м/с`;
  document.querySelector('#weather-time').textContent = `Open-Meteo, данные на ${data.time.slice(11, 16)} по московскому времени.`;
}

// Новый запрос отменяет предыдущий, ошибка видна только в этом окне
async function loadWeather() {
  weatherController?.abort();
  const controller = new AbortController();
  weatherController = controller;
  setWeatherState('loading');
  try {
    renderWeather(await fetchCurrentWeather(controller.signal));
    setWeatherState('result');
  } catch (error) {
    if (controller.signal.aborted) return;
    const reason = error instanceof WeatherError ? error.message : 'Попробуйте ещё раз.';
    document.querySelector('#weather-error-text').textContent = `Не удалось загрузить погоду. ${reason}`;
    setWeatherState('error');
  }
}

function initWeather() {
  weather.refresh.addEventListener('click', loadWeather);
  document.querySelector('#weather-retry').addEventListener('click', () => {
    weather.refresh.focus();
    loadWeather();
  });
  loadWeather();
}

initPicker();
initWeather();
