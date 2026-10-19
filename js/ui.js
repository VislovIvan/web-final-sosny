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
