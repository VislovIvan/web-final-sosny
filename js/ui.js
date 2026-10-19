// Общие действия всех страниц: тема и меню для телефона

const THEME_KEY = 'sosny.theme';

export function initLayout() {
  initTheme();
  initMenu();
}

function initTheme() {
  const button = document.querySelector('.theme-toggle');
  if (!button) return;
  const root = document.documentElement;
  const sync = () => button.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));

  sync();
  button.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    sync();
    try {
      localStorage.setItem(THEME_KEY, root.dataset.theme);
    } catch {
      // Без хранилища тема переключается, но не запоминается
    }
  });
}

function initMenu() {
  const header = document.querySelector('.site-header');
  const toggle = header?.querySelector('.menu-toggle');
  if (!toggle) return;

  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
  const setOpen = (open) => {
    header.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };

  toggle.addEventListener('click', () => setOpen(!isOpen()));
  header.querySelectorAll('.site-nav a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });
  // На широком экране навигация видна всегда, открытое состояние телефона не нужно
  matchMedia('(min-width: 760px)').addEventListener('change', () => setOpen(false));
}

// Элемент с атрибутами и детьми; строки становятся текстом, а не разметкой
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const STROKE = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2 };

const ICONS = {
  check: [['path', { d: 'M3 8.5l3 3 7-7', ...STROKE }]],
  lock: [
    ['path', { d: 'M5 7V5a3 3 0 0 1 6 0v2', ...STROKE }],
    ['rect', { x: 3, y: 7, width: 10, height: 8, rx: 1, fill: 'currentColor' }],
  ],
  arrow: [['path', { d: 'M2 8h11M9 4l4 4-4 4', ...STROKE }]],
  back: [['path', { d: 'M14 8H3M7 4L3 8l4 4', ...STROKE }]],
  refresh: [
    ['path', { d: 'M13 8a5 5 0 1 1-1.5-3.5', ...STROKE }],
    ['path', { d: 'M12 1v4H8', ...STROKE }],
  ],
};

export function icon(name, className = 'icon') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  for (const [tag, attrs] of ICONS[name]) {
    const shape = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) shape.setAttribute(key, String(value));
    svg.append(shape);
  }
  return svg;
}

const priceFormat = new Intl.NumberFormat('ru-RU');

export function formatPrice(value) {
  return `${priceFormat.format(value)} ₽`;
}

// plural(2, ['ночь', 'ночи', 'ночей']) → 'ночи'
export function plural(count, [one, few, many]) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

// Одно сообщение в области aria-live: kind = 'error', 'ok' или пусто
export function showMessage(container, text, kind = '') {
  container.replaceChildren();
  if (!text) return;
  const className = ['notice', 'appear', kind && `notice-${kind}`].filter(Boolean).join(' ');
  container.append(el('p', { class: className, text }));
}
