// Theme and language initialization helpers
(function () {
  const { refs } = window.AppState || {};
  const { themeSwitch, themeLabel, langButton, langMenu } = refs || {};

  function updateThemeLabel(useDark) {
    if (!themeLabel) return;
    const icon = useDark ? '☀️' : '🌙';
    themeLabel.textContent = icon;
  }

  function applyTheme(useDark, persist = true) {
    document.documentElement.classList.toggle('theme-dark', useDark);
    document.body.classList.toggle('dark-mode', useDark);
    if (persist) {
      localStorage.setItem('theme', useDark ? 'dark' : 'light');
      localStorage.setItem('crh-theme', useDark ? 'dark' : 'light');
    }
    if (themeSwitch) themeSwitch.checked = useDark;
    updateThemeLabel(useDark);
  }

  function initThemeSwitch() {
    if (!themeSwitch) return;
    const savedTheme = localStorage.getItem('theme') ?? localStorage.getItem('crh-theme');
    if (savedTheme === 'dark') {
      applyTheme(true, false);
    } else if (savedTheme === 'light') {
      applyTheme(false, false);
    } else {
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
      applyTheme(!!prefersDark, false);
    }
    themeSwitch.addEventListener('change', () => applyTheme(themeSwitch.checked));
  }

  function initLangMenu() {
    if (!langButton || !langMenu) return () => {};
    const updateLangMenuHighlight = (lang = getLanguage()) => {
      langMenu.querySelectorAll('button').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
      });
    };

    langButton.addEventListener('click', () => {
      const isOpen = !langMenu.hasAttribute('hidden');
      if (isOpen) {
        langMenu.setAttribute('hidden', '');
        langButton.setAttribute('aria-expanded', 'false');
      } else {
        langMenu.removeAttribute('hidden');
        langButton.setAttribute('aria-expanded', 'true');
        updateLangMenuHighlight();
      }
    });

    langMenu.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        setLanguage(lang);
        updateLangMenuHighlight(lang);
        langMenu.setAttribute('hidden', '');
        langButton.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', (event) => {
      if (!langMenu.contains(event.target) && !langButton.contains(event.target)) {
        langMenu.setAttribute('hidden', '');
        langButton.setAttribute('aria-expanded', 'false');
      }
    });

    return updateLangMenuHighlight;
  }

  window.AppTheme = { applyTheme, updateThemeLabel, initThemeSwitch, initLangMenu };
})();
