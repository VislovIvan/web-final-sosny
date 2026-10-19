// Погода на базе через Open-Meteo: без ключа, с таймаутом и отменой запроса

const API_URL = 'https://api.open-meteo.com/v1/forecast';
const BASE_POINT = { latitude: 61.04, longitude: 30.12 };
const TIMEOUT_MS = 8000;

export const FORECAST_DAYS = 16;

const WMO = {
  0: 'Ясно',
  1: 'Преимущественно ясно',
  2: 'Переменная облачность',
  3: 'Пасмурно',
  45: 'Туман',
  48: 'Туман с изморозью',
  51: 'Слабая морось',
  53: 'Морось',
  55: 'Сильная морось',
  56: 'Ледяная морось',
  57: 'Сильная ледяная морось',
  61: 'Небольшой дождь',
  63: 'Дождь',
  65: 'Сильный дождь',
  66: 'Ледяной дождь',
  67: 'Сильный ледяной дождь',
  71: 'Небольшой снег',
  73: 'Снег',
  75: 'Сильный снег',
  77: 'Снежная крупа',
  80: 'Небольшой ливень',
  81: 'Ливень',
  82: 'Сильный ливень',
  85: 'Небольшой снегопад',
  86: 'Сильный снегопад',
  95: 'Гроза',
  96: 'Гроза с небольшим градом',
  99: 'Гроза с сильным градом',
};

export class WeatherError extends Error {}

export function describeWeather(code) {
  return WMO[code] ?? 'Без описания';
}

// Группа кода WMO для значка: ясно, облачно, туман, дождь, снег, гроза
export function weatherKind(code) {
  if (!Number.isFinite(code)) return 'cloud';
  if (code <= 1) return 'sun';
  if (code <= 3) return 'cloud';
  if (code <= 48) return 'fog';
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  return 'rain';
}

export function formatTemperature(value) {
  const rounded = Math.round(value) || 0;
  return `${rounded > 0 ? '+' : ''}${rounded}\u202f°C`;
}

async function request(params, signal) {
  const url = `${API_URL}?${new URLSearchParams({ ...BASE_POINT, timezone: 'auto', ...params })}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const stop = () => controller.abort();
  signal?.addEventListener('abort', stop, { once: true });
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new WeatherError(`Сервис погоды ответил ошибкой ${response.status}.`);
    return await response.json();
  } catch (error) {
    // Запрос отменила сама страница: ошибку не показываем
    if (signal?.aborted) throw error;
    if (error instanceof WeatherError) throw error;
    if (error.name === 'AbortError') throw new WeatherError(`Сервис погоды не ответил за ${TIMEOUT_MS / 1000} секунд.`);
    if (error instanceof SyntaxError) throw new WeatherError('Сервис погоды прислал непонятный ответ.');
    throw new WeatherError('Нет связи с сервисом погоды.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}

export async function fetchCurrentWeather(signal) {
  const data = await request({
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
    wind_speed_unit: 'ms',
  }, signal);
  const now = data?.current;
  if (!now || !Number.isFinite(now.temperature_2m)) throw new WeatherError('Сервис погоды прислал неполные данные.');
  return {
    temperature: now.temperature_2m,
    feelsLike: now.apparent_temperature,
    wind: now.wind_speed_10m,
    code: now.weather_code,
    time: now.time,
  };
}

// Прогноз по дням: Map «YYYY-MM-DD» → { min, max, code }, неполные дни пропускаются
export async function fetchDailyForecast(signal) {
  const data = await request({
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    forecast_days: FORECAST_DAYS,
  }, signal);
  const daily = data?.daily;
  if (!daily || !Array.isArray(daily.time)) throw new WeatherError('Сервис погоды прислал неполные данные.');
  const days = new Map();
  daily.time.forEach((date, index) => {
    const min = daily.temperature_2m_min?.[index];
    const max = daily.temperature_2m_max?.[index];
    if (Number.isFinite(min) && Number.isFinite(max)) days.set(date, { min, max, code: daily.weather_code?.[index] });
  });
  return days;
}
