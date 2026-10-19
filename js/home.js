import { initLayout } from './ui.js';
import { MAX_DAYS_AHEAD, MAX_GUESTS, validateStay } from './data.js';
import { addDays, todayISO } from './dates.js';

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

initPicker();
