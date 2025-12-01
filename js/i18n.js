const embeddedTranslations = {
  'zh-CN': {
    appTitle: '磁带录制助手',
    tagline: '导入音频、调整顺序、设置空白间隔并直接试听播放列表。',
    importLabel: '导入音轨（flac / wav / mp3 / dsd…）',
    importNote: '（浏览器仅能播放其支持的格式，暂不处理 DRM 文件。）',
    gapLabel: '每两个音轨之间的空白（秒）',
    leadLabel: '前导空白（秒）',
    totalDurationLabel: '总时长：',
    durationCalculating: '计算中…',
    durationPendingTooltip: '等待音轨时长信息',
    durationApproxTooltip: '约 {duration}（{seconds}s）',
    playlistTitle: '播放顺序',
    clearList: '清空列表',
    playlistHint: '拖拽列表项可调整顺序，点击即可在播放器中加载该音轨。',
    playerTitle: '播放器',
    playFromStart: '从头播放',
    playPauseButton: '播放 / 暂停',
    stopButton: '停止',
    progressOverall: '总进度',
    progressGap: '空白',
    langLabel: '语言',
    langZh: '简体中文',
    langEn: '英语',
    langJa: '日语',
    nowPlaying: {
      idle: '尚未选择音轨',
      track: '正在播放：{name}',
      gap: '空白间隔：{seconds}s',
      lead: '前导空白：{seconds}s',
      done: '播放完成',
    },
    emptyList: '尚未导入音轨',
    loadingDuration: '读取中…',
    unreadable: '无法读取',
    audioFile: '音频文件',
    dragHint: '拖拽排序',
    delete: '删除',
    deleteThis: '删除这首歌',
    gapCountdown: '{seconds}s',
    play: '播放',
    pause: '暂停',
    playerLibMissing: '播放器库未加载',
  },
  en: {
    appTitle: 'Cassette Helper',
    tagline: 'Drop your tracks, set friendly gaps, and listen through the list right here.',
    importLabel: 'Import tracks (flac / wav / mp3 / dsd…)',
    importNote: "(The browser only plays formats it supports; DRM files aren’t handled.)",
    gapLabel: 'Silence between songs (sec)',
    leadLabel: 'Lead-in silence (sec)',
    totalDurationLabel: 'Total time:',
    durationCalculating: 'Calculating…',
    durationPendingTooltip: 'Waiting for track lengths',
    durationApproxTooltip: 'About {duration} ({seconds}s)',
    playlistTitle: 'Play order',
    clearList: 'Clear list',
    playlistHint: 'Drag to reorder; click any track to load it in the player.',
    playerTitle: 'Player',
    playFromStart: 'Play from start',
    playPauseButton: 'Play / Pause',
    stopButton: 'Stop',
    progressOverall: 'Overall',
    progressGap: 'Gap',
    langLabel: 'Language',
    langZh: '中文',
    langEn: 'English',
    langJa: '日本語',
    nowPlaying: {
      idle: 'Nothing selected yet',
      track: 'Now playing: {name}',
      gap: 'Gap: {seconds}s',
      lead: 'Lead-in: {seconds}s',
      done: 'All done',
    },
    emptyList: 'No tracks added yet',
    loadingDuration: 'Loading…',
    unreadable: 'Unavailable',
    audioFile: 'Audio file',
    dragHint: 'Drag to reorder',
    delete: 'Delete',
    deleteThis: 'Remove this track',
    gapCountdown: '{seconds}s',
    play: 'Play',
    pause: 'Pause',
    playerLibMissing: 'Player library missing',
  },
  ja: {
    appTitle: 'カセット録音ヘルパー',
    tagline: '曲を放り込んで間をあけて、ここでまとめて再生できます。',
    importLabel: '音源を追加（flac / wav / mp3 / dsd…）',
    importNote: '（ブラウザが再生できる形式のみ対応。DRM 付きは扱えません）',
    gapLabel: '曲間の無音（秒）',
    leadLabel: '頭出しの無音（秒）',
    totalDurationLabel: '合計時間：',
    durationCalculating: '計算中…',
    durationPendingTooltip: '曲の長さ取得待ち',
    durationApproxTooltip: 'だいたい {duration}（{seconds}秒）',
    playlistTitle: '再生順',
    clearList: 'リストを空にする',
    playlistHint: 'ドラッグで並び替え。クリックでプレイヤーに読み込みます。',
    playerTitle: 'プレイヤー',
    playFromStart: '最初から再生',
    playPauseButton: '再生 / 一時停止',
    stopButton: '停止',
    progressOverall: '全体',
    progressGap: '無音',
    langLabel: '言語',
    langZh: '簡体字',
    langEn: '英語',
    langJa: '日本語',
    nowPlaying: {
      idle: 'まだ曲が選ばれていません',
      track: '再生中：{name}',
      gap: '曲間：{seconds}秒',
      lead: '頭出し：{seconds}秒',
      done: '再生完了',
    },
    emptyList: '曲がまだありません',
    loadingDuration: '読み込み中…',
    unreadable: '時間が読めません',
    audioFile: '音声ファイル',
    dragHint: 'ドラッグで並び替え',
    delete: '削除',
    deleteThis: 'この曲を削除',
    gapCountdown: '{seconds}秒',
    play: '再生',
    pause: '一時停止',
    playerLibMissing: 'プレイヤーが読み込めません',
  },
};

const fallbackTranslations = { ...embeddedTranslations };
let translations = { ...embeddedTranslations };
const fetchedLanguages = {};
let currentLang = 'zh-CN';

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
  const pack = translations[currentLang] || translations['zh-CN'] || {};
  const value = deepGet(pack, key) ?? key;
  if (typeof value !== 'string') return key;
  return formatString(value, params);
}

async function loadFallback(lang) {
  if (fetchedLanguages[lang]) return;
  try {
    const res = await fetch(`lang/${lang}.json`);
    if (res.ok) {
      const fileData = await res.json();
      fallbackTranslations[lang] = { ...fallbackTranslations[lang], ...fileData };
      translations[lang] = fallbackTranslations[lang];
    }
  } catch (error) {
    console.warn(`加载语言文件失败: ${lang}`, error);
  }
  fetchedLanguages[lang] = true;
}

async function ensureTranslations(lang) {
  await loadFallback(lang);
  if (!translations[lang]) translations[lang] = fallbackTranslations[lang] || {};
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
  if (typeof window.onLanguageChanged === 'function') {
    window.onLanguageChanged(lang);
  }
}

function getLanguage() {
  return currentLang;
}

document.addEventListener('DOMContentLoaded', () => {
  ensureTranslations(currentLang).then(applyTranslations);
});

window.t = t;
window.setLanguage = setLanguage;
window.getLanguage = getLanguage;
window.applyTranslations = applyTranslations;
