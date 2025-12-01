const translations = {};
const fetchedLanguages = {};
const defaultLang = 'en';
let currentLang = detectBrowserLanguage();

function deepGet(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function formatString(template, params = {}) {
  return Object.keys(params).reduce(
    (str, key) => str.replaceAll(`{${key}}`, params[key]),
    template
  );
}

function t(key, params = {}) {
  const pack = translations[currentLang] || {};
  const fallbackPack = translations[defaultLang] || {};
  const value = deepGet(pack, key) ?? deepGet(fallbackPack, key);
  if (typeof value !== 'string') return key;
  return formatString(value, params);
}

async function loadLanguage(lang) {
  if (fetchedLanguages[lang]) return translations[lang];

  try {
    const res = await fetch(`lang/${lang}.json`);
    if (res.ok) {
      translations[lang] = await res.json();
    } else {
      translations[lang] = translations[lang] || {};
    }
  } catch (error) {
    console.warn(`加载语言文件失败: ${lang}`, error);
    translations[lang] = translations[lang] || {};
  }

  fetchedLanguages[lang] = true;
  return translations[lang];
}

async function ensureTranslations(lang) {
  await loadLanguage(lang);
  if (lang !== defaultLang && !translations[defaultLang]) {
    await loadLanguage(defaultLang);
  }
}

function applyTranslations() {
  document.title = t('appTitle');
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((node) => {
    node.setAttribute('aria-label', t(node.dataset.i18nAria));
  });
}

async function setLanguage(lang) {
  currentLang = lang;
  await ensureTranslations(lang);
  applyTranslations();
  if (document.documentElement) document.documentElement.lang = lang;
  if (typeof window.onLanguageChanged === 'function') {
    window.onLanguageChanged(lang);
  }
}

function getLanguage() {
  return currentLang;
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.documentElement) document.documentElement.lang = currentLang;
  ensureTranslations(currentLang).then(applyTranslations);
});

function detectBrowserLanguage() {
  const prefs = navigator.languages || [navigator.language || navigator.userLanguage];
  const normalized = prefs
    .filter(Boolean)
    .map((l) => String(l).toLowerCase());
  for (const lang of normalized) {
    if (lang.startsWith('zh')) return 'zh-CN';
    if (lang.startsWith('ja')) return 'ja';
  }
  return 'en';
}

window.t = t;
window.setLanguage = setLanguage;
window.getLanguage = getLanguage;
window.applyTranslations = applyTranslations;
