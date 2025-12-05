const fileInput = document.getElementById('audioInput');
const dropZone = document.querySelector('.file-drop');
const gapInput = document.getElementById('gapInput');
const playlistElement = document.getElementById('playlist');
const totalDurationElement = document.getElementById('totalDuration');
const playAllButton = document.getElementById('playAll');
const togglePlayButton = document.getElementById('togglePlay');
const stopPlayButton = document.getElementById('stopPlay');
const clearButton = document.getElementById('clearList');
const nowPlayingLabel = document.getElementById('nowPlaying');
const template = document.getElementById('playlistItemTemplate');
const globalProgressBar = document.getElementById('globalProgressBar');
const globalProgressText = document.getElementById('globalProgressText');
const gapProgressRow = document.getElementById('gapProgressRow');
const gapProgressBar = document.getElementById('gapProgressBar');
const gapProgressText = document.getElementById('gapProgressText');
const leadInput = document.getElementById('leadInput');
const langButton = document.getElementById('langButton');
const langMenu = document.getElementById('langMenu');
let updateLangMenuHighlight = () => {};
const lockToggle = document.getElementById('lockReorder');
const levelCheckToggle = document.getElementById('levelCheckToggle');
const themeSwitch = document.getElementById('themeSwitch');
const themeLabel = document.querySelector('.theme-emoji'); // holds sun/moon emoji
const analyzePeakButton = document.getElementById('analyzePeak');
const playPeakFromStartButton = document.getElementById('playPeakFromStart');
const togglePeakPlayButton = document.getElementById('togglePeakPlay');
const peakStatus = document.getElementById('peakStatus');
const peakWaveform = document.getElementById('peakWaveform');
const peakCtx = null;
const peakCurrentTimeEl = null;
const peakTotalTimeEl = null;
const peakProgressFill = null;
const peakMarker = (() => {
  if (!peakWaveform) return null;
  const marker = document.createElement('div');
  marker.className = 'peak-marker';
  peakWaveform.appendChild(marker);
  return marker;
})();
const { formatAdjustDb, parseAdjustDb, applyTrackGain, computeTrackLevels } = window.LevelUtils || {};
// Use plain numeric formatting so native number inputs accept/show positives.
const formatAdjust = (v) => (Number.isFinite(v) ? v.toFixed(1) : '0.0');
const parseAdjust = (v) => (parseAdjustDb ? parseAdjustDb(v) : Number.parseFloat(String(v)) || 0);
const applyTrackGainLocal = (track) => applyTrackGain?.(track, currentHowl, currentIndex, playlist);
const computeTrackLevelsLocal = (track) => computeTrackLevels?.(track, ensureAudioContext);

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

function formatSeconds(value) {
  if (!Number.isFinite(value)) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = (value % 60).toFixed(1).padStart(4, '0');
  return `${minutes}:${seconds}`;
}

function applyDragLockState() {
  const canDrag = !lockToggle?.checked;
  toggleSortable(canDrag);
}

function setPeakControlsEnabled(enabled) {
  if (playPeakFromStartButton) playPeakFromStartButton.disabled = !enabled;
  if (togglePeakPlayButton) togglePeakPlayButton.disabled = !enabled;
}

function ensureAudioContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function setPeakStatus(key, params) {
  if (!peakStatus) return;
  if (typeof key === 'string') {
    peakStatusKey = key;
    peakStatusParams = params;
    peakStatus.textContent = t(key, params);
  } else {
    peakStatus.textContent = key;
  }
}

function updatePeakTimeUI(current = 0, total = 0) {
  if (peakCurrentTimeEl) peakCurrentTimeEl.textContent = formatSeconds(current).replace(/\.0$/, '');
  if (peakTotalTimeEl) peakTotalTimeEl.textContent = formatSeconds(total || 0).replace(/\.0$/, '');
  if (peakProgressFill) {
    const pct = total > 0 ? Math.min(1, Math.max(0, current / total)) * 100 : 0;
    peakProgressFill.style.width = `${pct}%`;
  }
}

function updatePeakMarker(time = null, total = 0) {
  if (!peakMarker) return;
  if (!Number.isFinite(time) || !total) {
    peakMarker.style.left = '-9999px';
    return;
  }
  const pct = Math.min(1, Math.max(0, time / total)) * 100;
  peakMarker.style.left = `${pct}%`;
}

function clearSpectrum() {
  if (spectrumTimer) {
    cancelAnimationFrame(spectrumTimer);
    spectrumTimer = null;
  }
  if (snippetAnimation) {
    cancelAnimationFrame(snippetAnimation);
    snippetAnimation = null;
  }
  if (peakSurferTimeHandler && peakSurfer) {
    peakSurfer.un('timeupdate', peakSurferTimeHandler);
  }
  peakSurferTimeHandler = null;
  peakTargetEnd = null;
  if (peakSurfer) {
    peakSurfer.destroy();
    peakSurfer = null;
    peakSurferReady = false;
  }
  updatePeakTimeUI(0, 0);
  updatePeakMarker(null, 0);
}

function stopSnippet() {
  if (snippetSource) {
    try {
      snippetSource.stop();
    } catch (e) {
      // ignore
    }
    snippetSource.disconnect();
    snippetSource = null;
  }
  if (snippetGain) {
    snippetGain.disconnect();
    snippetGain = null;
  }
  if (analyser) {
    analyser.disconnect();
    analyser = null;
  }
  clearSpectrum();
}

function resizePeakCanvas() {
  const rect = peakWaveform?.getBoundingClientRect();
  if (!rect) return;
  const dpr = window.devicePixelRatio || 1;
  peakDpr = dpr;
  peakCanvasWidth = Math.max(320, Math.floor(rect.width));
  peakCanvasHeight = Math.max(160, Math.floor(rect.height || 200));
  if (peakSurfer?.drawer) {
    peakSurfer.setOptions({ height: peakCanvasHeight });
    peakSurfer.drawer.containerWidth = peakCanvasWidth;
    peakSurfer.drawer.containerHeight = peakCanvasHeight;
    peakSurfer.drawer.updateSize();
    peakSurfer.drawBuffer();
  }
}

const playlist = [];
let sortable = null;
let draggedIndex = null;
let currentIndex = -1;
let gapTimer = null;
let gapInterval = null;
let leadTimer = null;
let leadInterval = null;
let gapStartTime = 0;
let gapDurationSec = 0;
let leadStartTime = 0;
let leadDurationSec = 0;
let isInGap = false;
let isInLead = false;
let currentHowl = null;
let progressTimer = null;
let hasPlayedOnce = false;
let audioCtx = null;
let peakInfo = null;
let peakStatusKey = 'peakIdle';
let peakStatusParams = undefined;
let spectrumTimer = null;
let snippetSource = null;
let analyser = null;
let snippetGain = null;
let snippetAnimation = null;
let peakDpr = window.devicePixelRatio || 1;
let peakCanvasWidth = 0;
let peakCanvasHeight = 0;
let peakSurfer = null;
let peakSurferReady = false;
let peakSurferTimeHandler = null;
let peakTargetEnd = null;
let autoLevelCheck = false;
let peakPausedAt = 0;

fileInput.addEventListener('change', (event) => {
  handleIncomingFiles(event.target.files);
  fileInput.value = '';
});

if (langButton && langMenu) {
  updateLangMenuHighlight = (lang = getLanguage()) => {
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
}

if (dropZone) {
  dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragover');
    if (event.dataTransfer?.files?.length) {
      handleIncomingFiles(event.dataTransfer.files);
    }
  });
}

gapInput.addEventListener('input', () => {
  normalizeGapInput(false);
  updateTotalDuration();
});
gapInput.addEventListener('blur', () => {
  normalizeGapInput(true);
  updateTotalDuration();
});

leadInput.addEventListener('input', () => {
  normalizeLeadInput(false);
  updateTotalDuration();
});
leadInput.addEventListener('blur', () => {
  normalizeLeadInput(true);
  updateTotalDuration();
});

playAllButton.addEventListener('click', () => {
  if (playlist.length === 0) return;
  selectTrack(0, true);
});

togglePlayButton.addEventListener('click', () => {
  if (currentIndex < 0 && playlist.length > 0) {
    selectTrack(0, true);
    return;
  }
  if (currentHowl) {
    if (currentHowl.playing()) {
      pauseCurrent();
    } else {
      playCurrent();
    }
  }
});

stopPlayButton.addEventListener('click', () => stopPlayback());

clearButton.addEventListener('click', () => {
  stopPlayback();
  playlist.splice(0, playlist.length).forEach((item) => URL.revokeObjectURL(item.url));
  renderPlaylist();
});

window.addEventListener('beforeunload', () => {
  playlist.forEach((item) => URL.revokeObjectURL(item.url));
});

if (lockToggle) {
  lockToggle.checked = false; // default to unlocked every time
  lockToggle.addEventListener('change', applyDragLockState);
}
applyDragLockState();

async function runLevelCheck() {
  if (!playlist.length) return;
  if (levelCheckToggle) levelCheckToggle.disabled = true;
  for (const track of playlist) {
    await computeTrackLevelsLocal(track);
  }
  renderPlaylist();
  if (levelCheckToggle) levelCheckToggle.disabled = false;
}

if (levelCheckToggle) {
  const savedAuto = localStorage.getItem('autoLevelCheck');
  autoLevelCheck = savedAuto === '1';
  levelCheckToggle.checked = autoLevelCheck;
  levelCheckToggle.addEventListener('change', () => {
    autoLevelCheck = levelCheckToggle.checked;
    localStorage.setItem('autoLevelCheck', autoLevelCheck ? '1' : '0');
    if (autoLevelCheck) runLevelCheck();
  });
}

if (themeSwitch) {
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

if (analyzePeakButton) {
  analyzePeakButton.addEventListener('click', () => {
    analyzePeakButton.disabled = true;
    setPeakControlsEnabled(false);
    resizePeakCanvas();
    handlePeakAnalysis().finally(() => {
      analyzePeakButton.disabled = false;
    });
  });
}

if (playPeakFromStartButton) {
  playPeakFromStartButton.addEventListener('click', () => {
    playPeakExcerpt(true);
  });
}

if (togglePeakPlayButton) {
  togglePeakPlayButton.addEventListener('click', () => {
    togglePeakPlayback();
  });
}

window.addEventListener('resize', () => {
  resizePeakCanvas();
});

setPeakStatus('peakIdle');
setPeakControlsEnabled(false);

function handleIncomingFiles(fileList) {
  const files = Array.from(fileList || []);
  files.forEach(queueTrack);
}

function queueTrack(file) {
  if (!file) return;
  const track = {
    id: createId(),
    name: file.name,
    type: file.type || guessFormat(file.name),
    file,
    url: URL.createObjectURL(file),
    duration: null,
    status: 'pending',
    finished: false,
    avgDb: null,
    peakDb: null,
    adjustDb: 0,
  };
  playlist.push(track);
  renderPlaylist();
  probeDuration(track);
  if (autoLevelCheck) {
    computeTrackLevelsLocal(track).then(() => renderPlaylist());
  }
}

function probeDuration(track) {
  const probe = document.createElement('audio');
  probe.preload = 'metadata';
  probe.src = track.url;

  const cleanup = () => {
    probe.removeAttribute('src');
    probe.load();
  };

  probe.addEventListener(
    'loadedmetadata',
    () => {
      track.duration = Number.isFinite(probe.duration) ? probe.duration : null;
      track.status = Number.isFinite(probe.duration) ? 'ready' : 'error';
      cleanup();
      renderPlaylist();
    },
    { once: true }
  );

  probe.addEventListener(
    'error',
    () => {
      track.duration = null;
      track.status = 'error';
      cleanup();
      renderPlaylist();
    },
    { once: true }
  );
}

function renderPlaylist() {
  playlistElement.innerHTML = '';
  if (playlist.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = t('emptyList');
    empty.className = 'empty';
    playlistElement.appendChild(empty);
    currentIndex = -1;
    nowPlayingLabel.textContent = t('nowPlaying.idle');
    updateTotalDuration();
  return;
}

  playlist.forEach((track, index) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.index = String(index);
    node.dataset.id = track.id;
    const number = node.querySelector('.track-number');
    if (number) number.textContent = `${index + 1}.`;
    node.querySelector('.track-title').textContent = track.name;
    node.querySelector('.track-duration').textContent = formatTrackDuration(track);
    node.querySelector('.track-format').textContent = track.type || t('audioFile');
    const dragHandle = node.querySelector('.drag-handle');
    if (dragHandle) {
      const label = t('dragHandle');
      dragHandle.textContent = label;
      dragHandle.setAttribute('aria-label', label);
      dragHandle.setAttribute('title', label);
    }

    const deleteButton = node.querySelector('.track-delete');
    deleteButton?.addEventListener('click', (event) => {
      event.stopPropagation();
      deleteTrack(index);
    });
    if (deleteButton) {
      deleteButton.textContent = t('delete');
      deleteButton.setAttribute('aria-label', t('deleteThis'));
    }

    const levels = document.createElement('div');
    levels.className = 'track-levels';
    const values = document.createElement('span');
    values.className = 'level-values';
    const avgText = Number.isFinite(track.avgDb) ? track.avgDb.toFixed(1) : '--';
    const peakText = Number.isFinite(track.peakDb) ? track.peakDb.toFixed(1) : '--';
    values.textContent = t('levelSummary', { avg: avgText, peak: peakText });
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.1';
    input.inputMode = 'decimal';
    input.value = formatAdjust(Number.isFinite(track.adjustDb) ? track.adjustDb : 0);
    input.title = t('adjustLevel');
    input.setAttribute('aria-label', t('adjustLevel'));
    input.addEventListener('click', (e) => e.stopPropagation());
    const applyInput = () => {
      track.adjustDb = parseAdjust(input.value);
      input.value = formatAdjust(track.adjustDb);
      applyTrackGainLocal(track);
    };
    input.addEventListener('input', (e) => {
      e.stopPropagation();
      track.adjustDb = parseAdjust(input.value);
      applyTrackGainLocal(track);
    });
    input.addEventListener('blur', applyInput);
    levels.append(values, input);
    const trackRow = node.querySelector('.track-row');
    if (trackRow) {
      const insertBeforeNode = dragHandle || node.querySelector('.track-delete') || null;
      trackRow.insertBefore(levels, insertBeforeNode);
    } else {
      node.appendChild(levels);
    }

    const progress = document.createElement('input');
    progress.type = 'range';
    progress.min = 0;
    progress.max = 1000;
    progress.step = 1;
    progress.className = 'track-progress';
    progress.value = 0;
    progress.addEventListener('click', (e) => e.stopPropagation());
    progress.addEventListener('input', (e) => {
      e.stopPropagation();
      if (index !== currentIndex) return;
      const t = playlist[currentIndex];
      const dur = t?.duration ?? (currentHowl ? currentHowl.duration() : 0);
      if (!Number.isFinite(dur) || dur <= 0) return;
      const ratio = progress.value / 1000;
      if (currentHowl) {
        currentHowl.seek(Math.min(dur * ratio, dur));
      }
      updateGlobalProgress();
    });
    node.appendChild(progress);

    node.addEventListener('click', () => selectTrack(index, false));
    if (index === currentIndex) node.classList.add('active');

    playlistElement.appendChild(node);
  });

  updateTrackProgressUI();
  updateTotalDuration();
  ensureSortable();
  applyDragLockState();
}

function deleteTrack(index) {
  if (index < 0 || index >= playlist.length) return;
  const [removed] = playlist.splice(index, 1);
  if (removed) URL.revokeObjectURL(removed.url);
  if (currentIndex === index) {
    stopPlayback();
  } else if (currentIndex > index) {
    currentIndex -= 1;
  }
  renderPlaylist();
}

function selectTrack(index, autoplay = false) {
  if (index < 0 || index >= playlist.length) return;
  stopSnippet();
  peakInfo = null;
  setPeakControlsEnabled(false);
  setPeakStatus('peakNeedAnalyze');
  clearGapState();
  currentIndex = index;
  const track = playlist[index];
  track.finished = false;
  nowPlayingLabel.textContent = t('nowPlaying.track', { name: track.name });
  highlightActive();
  loadHowl(track);
  refreshPlayButton();
  if (peakStatus) setPeakStatus('peakNeedAnalyze');
  setPeakControlsEnabled(false);
  clearSpectrum();
  if (autoplay) {
    if (!hasPlayedOnce) {
      const leadSeconds = getLeadSeconds();
      if (leadSeconds > 0) {
        startLeadGap(leadSeconds);
      } else {
        playCurrent();
      }
    } else {
      playCurrent();
    }
  }
  if (!autoplay) {
    const leadSeconds = getLeadSeconds();
    if (leadSeconds > 0) {
      clearLeadState();
      updateGapProgress(0, leadSeconds, true);
    }
  }
  updateTrackProgressUI();
  updateGlobalProgress();
}

function highlightActive() {
  const nodes = playlistElement.querySelectorAll('.track');
  nodes.forEach((node, idx) => node.classList.toggle('active', idx === currentIndex));
}

function handleTrackEnded() {
  const currentTrack = playlist[currentIndex];
  if (currentTrack && !Number.isFinite(currentTrack.duration) && currentHowl) {
    const dur = currentHowl.duration();
    if (Number.isFinite(dur)) {
      currentTrack.duration = dur;
      currentTrack.status = 'ready';
    }
  }
  const gapSeconds = getGapSeconds();
  const shouldPause = gapSeconds > 0 && currentIndex >= 0 && currentIndex < playlist.length - 1;
  if (shouldPause) {
    nowPlayingLabel.textContent = t('nowPlaying.gap', { seconds: gapSeconds });
    clearGapState();
    isInGap = true;
    gapStartTime = performance.now();
    gapDurationSec = gapSeconds;
    gapProgressRow.hidden = false;
    gapTimer = window.setTimeout(playNext, gapSeconds * 1000);
    gapInterval = window.setInterval(updateGlobalProgress, 100);
    updateGapProgress(0, gapSeconds);
    updateTrackProgressUI();
    return;
  }
  playNext();
}

function playNext() {
  clearGapState();
  clearLeadState();
  if (currentIndex < playlist.length - 1) {
    selectTrack(currentIndex + 1, true);
  } else {
    const last = playlist[currentIndex];
    if (last) last.finished = true;
    nowPlayingLabel.textContent = t('nowPlaying.done');
    stopHowl();
    highlightActive();
    updateTrackProgressUI();
    refreshPlayButton();
  }
}

function stopPlayback() {
  stopSnippet();
  clearGapState();
  clearLeadState();
  stopHowl();
  nowPlayingLabel.textContent = t('nowPlaying.idle');
  currentIndex = -1;
  hasPlayedOnce = false;
  updateTrackProgressUI();
  updateGlobalProgress();
  refreshPlayButton();
  setPeakStatus('peakIdle');
}

function clearGapState() {
  if (gapTimer) {
    window.clearTimeout(gapTimer);
    gapTimer = null;
  }
  if (gapInterval) {
    window.clearInterval(gapInterval);
    gapInterval = null;
  }
  isInGap = false;
  gapDurationSec = 0;
  gapStartTime = 0;
  updateGapProgress(0, 0, true);
}

function clearLeadState() {
  if (leadTimer) {
    window.clearTimeout(leadTimer);
    leadTimer = null;
  }
  if (leadInterval) {
    window.clearInterval(leadInterval);
    leadInterval = null;
  }
  leadDurationSec = 0;
  leadStartTime = 0;
  isInLead = false;
}

function updateTrackProgressUI() {
  const nodes = playlistElement.querySelectorAll('.track');
  nodes.forEach((node) => {
    const idx = Number(node.dataset.index);
    const slider = node.querySelector('.track-progress');
    if (!slider) return;
    const track = playlist[idx];
    const isCurrent = idx === currentIndex;
    if (track?.finished) {
      slider.disabled = false;
      slider.value = 1000;
      slider.classList.toggle('done', true);
      return;
    }
    if (isCurrent && isInGap) {
      slider.disabled = false;
      slider.value = 1000;
      slider.classList.toggle('done', true);
      return;
    }
    if (!isCurrent) {
      slider.disabled = false;
      if (track?.finished || idx < currentIndex || (track?.status === 'ready' && idx < currentIndex)) {
        slider.value = 1000;
        slider.classList.toggle('done', true);
      } else {
        slider.value = 0;
        slider.classList.toggle('done', false);
      }
      return;
    }
    slider.disabled = false;
    const dur =
      track?.duration ??
      (currentHowl && currentIndex === idx ? currentHowl.duration() : undefined);
    const pos = currentHowl && currentIndex === idx ? currentHowl.seek() || 0 : 0;
    if (Number.isFinite(dur) && dur > 0) {
      slider.value = Math.min(1000, Math.max(0, Math.round((pos / dur) * 1000)));
      slider.classList.toggle('done', false);
    } else {
      slider.value = 0;
      slider.classList.toggle('done', !!track?.finished);
    }
  });
}

function updateTotalDuration() {
  const duration = computeDurations();
  if (playlist.length === 0) {
    totalDurationElement.textContent = '00:00';
    totalDurationElement.removeAttribute('title');
    return;
  }
  totalDurationElement.textContent = duration.pending
    ? t('durationCalculating')
    : formatDuration(duration.totalSeconds);
  totalDurationElement.title = duration.pending
    ? t('durationPendingTooltip')
    : t('durationApproxTooltip', {
        duration: formatDuration(duration.totalSeconds),
        seconds: Math.round(duration.totalSeconds),
      });
}

function computeDurations() {
  const gapSeconds = getGapSeconds();
  const leadSeconds = getLeadSeconds();
  const trackSeconds = playlist.reduce((sum, track) => {
    if (track.status === 'ready' && Number.isFinite(track.duration)) return sum + track.duration;
    if (playlist[currentIndex] === track && currentHowl && Number.isFinite(currentHowl.duration())) {
      return sum + currentHowl.duration();
    }
    return sum;
  }, 0);
  const pending = playlist.some((t) => t.status === 'pending');
  const gapInsertions = Math.max(0, playlist.length - 1);
  return { totalSeconds: leadSeconds + trackSeconds + gapInsertions * gapSeconds, gapSeconds, leadSeconds, pending };
}

function updateGlobalProgress() {
  const { totalSeconds, gapSeconds, leadSeconds } = computeDurations();
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    if (globalProgressBar) globalProgressBar.style.width = '0%';
    if (globalProgressText) globalProgressText.textContent = '00:00 / 00:00';
    return;
  }

  let elapsed = 0;
  if (currentIndex >= 0) {
    if (leadDurationSec > 0) {
      const leadElapsed = Math.min((performance.now() - leadStartTime) / 1000, leadDurationSec);
      elapsed += leadElapsed;
      updateGapProgress(leadElapsed, leadDurationSec, false, true);
      if (leadElapsed < leadDurationSec) {
        if (globalProgressBar) globalProgressBar.style.width = `${Math.min(100, (elapsed / totalSeconds) * 100)}%`;
        if (globalProgressText) globalProgressText.textContent = `${formatDuration(elapsed)} / ${formatDuration(totalSeconds)}`;
        return;
      }
    } else if (leadSeconds > 0) {
      elapsed += leadSeconds;
    }

    const finished = playlist.slice(0, currentIndex).reduce((sum, t) => sum + (Number.isFinite(t.duration) ? t.duration : 0), 0);
    elapsed += finished;
    elapsed += gapSeconds * currentIndex;

    if (isInGap) {
      const currentTrack = playlist[currentIndex];
      elapsed += Number.isFinite(currentTrack?.duration) ? currentTrack.duration : 0;
      const gapElapsed = Math.min((performance.now() - gapStartTime) / 1000, gapDurationSec);
      elapsed += gapElapsed;
      updateGapProgress(gapElapsed, gapDurationSec);
    } else {
      const track = playlist[currentIndex];
      const dur =
        Number.isFinite(track?.duration) && track.duration > 0
          ? track.duration
          : currentHowl && Number.isFinite(currentHowl.duration())
          ? currentHowl.duration()
          : 0;
      const pos = currentHowl ? currentHowl.seek() || 0 : 0;
      elapsed += Math.min(pos, dur || 0);
      updateGapProgress(0, 0, true);
      if (dur > 0 && pos >= dur && currentIndex >= 0) {
        const slider = playlistElement.querySelector(`.track[data-index="${currentIndex}"] .track-progress`);
        if (slider) {
          slider.value = 1000;
          slider.classList.add('done');
        }
      }
    }
  }

  const percent = Math.min(100, Math.max(0, (elapsed / totalSeconds) * 100));
  if (globalProgressBar) globalProgressBar.style.width = `${percent}%`;
  if (globalProgressText) globalProgressText.textContent = `${formatDuration(elapsed)} / ${formatDuration(totalSeconds)}`;
}

function updateGapProgress(elapsed, total, hide = false, isLead = false) {
  if (!gapProgressRow || !gapProgressBar || !gapProgressText) return;
  const showing = isLead ? isInLead : isInGap;
  if (hide || !showing || total <= 0) {
    gapProgressRow.hidden = true;
    gapProgressBar.style.width = '0%';
    gapProgressText.textContent = t('gapCountdown', { seconds: 0 });
    return;
  }
  const percent = 100 - Math.min(100, Math.max(0, (elapsed / total) * 100));
  gapProgressRow.hidden = false;
  gapProgressBar.style.width = `${percent}%`;
  gapProgressText.textContent = t('gapCountdown', {
    seconds: Math.max(0, total - elapsed).toFixed(1),
  });
}

function ensureSortable() {
  if (!window.Sortable || sortable) return;
  sortable = window.Sortable.create(playlistElement, {
    animation: 150,
    handle: '.drag-handle',
    ghostClass: 'drag-ghost',
    chosenClass: 'drag-chosen',
    onEnd(evt) {
      if (evt.oldIndex === evt.newIndex) return;
      reorder(evt.oldIndex, evt.newIndex);
    },
  });
}

function reorder(from, to) {
  if (from < 0 || to < 0 || from >= playlist.length || to >= playlist.length) return;
  const [moved] = playlist.splice(from, 1);
  playlist.splice(to, 0, moved);
  if (currentIndex === from) currentIndex = to;
  else if (currentIndex > from && currentIndex <= to) currentIndex -= 1;
  else if (currentIndex < from && currentIndex >= to) currentIndex += 1;
  renderPlaylist();
}

function refreshPlayButton() {
  const playing = currentHowl?.playing?.() || false;
  togglePlayButton.textContent = playing ? t('pause') : t('playPauseButton');
}

function toggleSortable(enabled) {
  if (sortable) {
    sortable.option('disabled', !enabled);
    const dragHandles = playlistElement.querySelectorAll('.drag-handle');
    dragHandles.forEach((el) => el.classList.toggle('disabled', !enabled));
    const rows = playlistElement.querySelectorAll('.track');
    rows.forEach((row) => row.classList.toggle('drag-locked', !enabled));
  }
}


function formatTrackDuration(track) {
  if (track.status === 'pending') return t('loadingDuration');
  if (track.status === 'error' || !Number.isFinite(track.duration)) return t('unreadable');
  return formatDuration(track.duration);
}

function loadHowl(track) {
  if (!window.Howl) {
    nowPlayingLabel.textContent = t('playerLibMissing');
    return;
  }
  stopHowl();
  currentHowl = new Howl({
    src: [track.url],
    html5: true,
    preload: true,
    onload() {
      if (!Number.isFinite(track.duration)) {
        const dur = currentHowl.duration();
        if (Number.isFinite(dur)) {
          track.duration = dur;
          track.status = 'ready';
          renderPlaylist();
        }
      }
      updateTotalDuration();
    },
    onend: handleTrackEnded,
  });
  applyTrackGainLocal(track);
}
function playCurrent() {
  if (!currentHowl) return;
  clearGapState();
  clearLeadState();
  currentHowl.play();
  startProgressTimer();
  refreshPlayButton();
  hasPlayedOnce = true;
}

function pauseCurrent() {
  if (currentHowl) currentHowl.pause();
  stopProgressTimer();
  refreshPlayButton();
}

function stopHowl() {
  stopProgressTimer();
  if (currentHowl) {
    currentHowl.stop();
    currentHowl.unload();
    currentHowl = null;
  }
}

function startProgressTimer() {
  stopProgressTimer();
  progressTimer = window.setInterval(() => {
    updateTrackProgressUI();
    updateGlobalProgress();
  }, 200);
}

function stopProgressTimer() {
  if (progressTimer) {
    window.clearInterval(progressTimer);
    progressTimer = null;
  }
}

function startLeadGap(seconds) {
  clearGapState();
  clearLeadState();
  leadDurationSec = seconds;
  leadStartTime = performance.now();
  isInLead = true;
  gapProgressRow.hidden = false;
  gapTimer = null;
  leadTimer = window.setTimeout(() => {
    clearLeadState();
    playCurrent();
  }, seconds * 1000);
  leadInterval = window.setInterval(updateGlobalProgress, 100);
  updateGapProgress(0, seconds, false, true);
  nowPlayingLabel.textContent = t('nowPlaying.lead', { seconds: seconds.toFixed(1) });
}

async function handlePeakAnalysis() {
  if (currentIndex < 0 || !playlist[currentIndex]) {
    setPeakStatus('peakNoTrack');
    peakInfo = null;
    return;
  }
  const track = playlist[currentIndex];
  if (!track.file) {
    setPeakStatus('peakNoTrack');
    peakInfo = null;
    return;
  }
  const ctx = ensureAudioContext();
  if (!ctx) {
    setPeakStatus('peakUnsupported');
    return;
  }
  setPeakStatus('peakAnalyzing');
  try {
    const arrayBuffer = await track.file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    let maxVal = 0;
    let maxIndex = 0;
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch += 1) {
      const data = audioBuffer.getChannelData(ch);
      for (let i = 0; i < data.length; i += 1) {
        const v = Math.abs(data[i]);
        if (v > maxVal) {
          maxVal = v;
          maxIndex = i;
        }
      }
    }
    const peakTime = maxIndex / audioBuffer.sampleRate;
    const windowSec = 15;
    const start = Math.max(0, peakTime - windowSec / 2);
    const end = Math.min(audioBuffer.duration, start + windowSec);
    peakInfo = { trackId: track.id, time: peakTime, start, end, buffer: audioBuffer, duration: audioBuffer.duration };
    updatePeakTimeUI(start, audioBuffer.duration);
    updatePeakMarker(peakTime, audioBuffer.duration);
    if (window.WaveSurfer && peakWaveform) {
      if (peakSurfer) {
        peakSurfer.destroy();
        peakSurfer = null;
        peakSurferReady = false;
      }
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent')?.trim() || '#6ba2ff';
      const height = peakCanvasHeight || 200;
      peakSurferReady = false;
      const gradients = window.buildPeakGradients ? window.buildPeakGradients(height) : null;
      if (window.createPeakSurfer) {
        peakSurfer = window.createPeakSurfer({ container: peakWaveform, height, accent });
      } else {
        peakSurfer = WaveSurfer.create({
          container: peakWaveform,
          waveColor: gradients?.waveColor || accent,
          progressColor: gradients?.progressColor || 'rgba(80, 200, 120, 0.9)',
          height,
          responsive: true,
          normalize: false,
          interact: true,
          dragToSeek: true,
          cursorColor: '#57BAB6',
          cursorWidth: 3,
          minPxPerSec: 0,
          fillParent: true,
          hideScrollbar: true,
          autoCenter: false,
          splitChannels: true,
          splitChannelsOptions: {
            overlay: false,
            relativeNormalization: false,
            channelGap: 0,
          },
        });
      }
      peakSurfer.once('ready', () => {
        peakSurferReady = true;
        const surferDuration = peakSurfer.getDuration ? peakSurfer.getDuration() : track.duration || audioBuffer.duration || 1;
        const startPos = peakInfo?.start || 0;
        if (peakSurferTimeHandler && peakSurfer) {
          peakSurfer.un('timeupdate', peakSurferTimeHandler);
        }
        peakSurferTimeHandler = (time) => {
          updatePeakTimeUI(time, surferDuration);
          updatePeakMarker(peakInfo?.time, surferDuration);
          if (peakTargetEnd != null && time >= peakTargetEnd - 0.02) {
            const endPoint = peakTargetEnd;
            peakTargetEnd = null;
            peakSurfer.pause();
            if (typeof endPoint === 'number') peakSurfer.setTime(endPoint);
          }
        };
        peakSurfer.on('timeupdate', peakSurferTimeHandler);
        updatePeakTimeUI(startPos, surferDuration);
        if (surferDuration > 0) {
          const ratio = Math.min(1, Math.max(0, startPos / surferDuration));
          if (typeof peakSurfer.seekTo === 'function') {
            peakSurfer.seekTo(ratio);
          } else if (typeof peakSurfer.setTime === 'function') {
            peakSurfer.setTime(startPos);
          }
        }
      });
      peakSurfer.once('error', () => {
        peakSurferReady = false;
      });
      peakSurfer.on('interaction', () => {
        const surferDuration = peakSurfer.getDuration ? peakSurfer.getDuration() : audioBuffer.duration || track.duration || 0;
        const pos = peakSurfer.getCurrentTime ? peakSurfer.getCurrentTime() : 0;
        peakPausedAt = pos;
        updatePeakTimeUI(pos, surferDuration);
      });
      peakSurfer.on('seeking', () => {
        const surferDuration = peakSurfer.getDuration ? peakSurfer.getDuration() : audioBuffer.duration || track.duration || 0;
        const pos = peakSurfer.getCurrentTime ? peakSurfer.getCurrentTime() : 0;
        peakPausedAt = pos;
        updatePeakTimeUI(pos, surferDuration);
      });
      peakSurfer.load(track.url);
    }
    setPeakControlsEnabled(true);
    setPeakStatus('peakResult', {
      time: formatSeconds(peakTime),
      start: formatSeconds(start),
      end: formatSeconds(end),
    });
  } catch (error) {
    console.error('Peak analysis failed', error);
    setPeakStatus('peakError');
    peakInfo = null;
    setPeakControlsEnabled(false);
  }
}

function drawSpectrum() {
  if (!analyser || !peakCtx || !peakCanvas) return;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const width = peakCanvas.width;
  const height = peakCanvas.height;
  const barWidth = Math.max(2, Math.floor((width / bufferLength) * 1.5));
  const styles = getComputedStyle(document.documentElement);
  const bg = styles.getPropertyValue('--panel')?.trim() || '#0b0f18';
  const barColor = styles.getPropertyValue('--accent')?.trim() || '#6ba2ff';

  const render = () => {
    spectrumTimer = requestAnimationFrame(render);
    analyser.getByteFrequencyData(dataArray);
    peakCtx.fillStyle = bg;
    peakCtx.fillRect(0, 0, width, height);
    let x = 0;
    for (let i = 0; i < bufferLength; i += 1) {
      const v = dataArray[i] / 255;
      const barHeight = v * (height - 4);
      peakCtx.fillStyle = barColor;
      peakCtx.fillRect(x, height - barHeight, barWidth, barHeight);
      x += barWidth + 1;
      if (x > width) break;
    }
  };
  render();
}

function playPeakExcerpt(reset = false) {
  if (!peakInfo || !playlist[currentIndex] || playlist[currentIndex].id !== peakInfo.trackId) {
    setPeakStatus('peakTrackChanged');
    setPeakControlsEnabled(false);
    return;
  }
  if (currentHowl?.playing?.()) {
    pauseCurrent();
  }
  const totalDuration = peakInfo.buffer.duration;
  const baseStart = reset ? peakInfo.start : (peakSurfer?.getCurrentTime?.() ?? peakPausedAt ?? peakInfo.start);
  const start = Math.max(0, Math.min(totalDuration - 0.05, baseStart));
  const duration = Math.min(15, Math.max(0.05, totalDuration - start));
  const end = Math.min(totalDuration, start + duration);
  peakTargetEnd = null;
  if (peakSurfer) {
    const playWithSurfer = () => {
      if (!peakSurfer) return;
      const surferDuration = peakSurfer.getDuration ? peakSurfer.getDuration() : totalDuration;
      const currentPos = peakSurfer.getCurrentTime ? peakSurfer.getCurrentTime() : start;
      const chosenStart = reset ? start : currentPos;
      const safeStart = Math.max(0, Math.min(surferDuration - 0.01, chosenStart));
      const safeEnd = Math.min(surferDuration, end);
      peakTargetEnd = safeEnd;
      peakPausedAt = 0;
      peakSurfer.stop();
      peakSurfer.setTime(safeStart);
      updatePeakTimeUI(safeStart, surferDuration);
      peakSurfer.play(safeStart, safeEnd);
      peakSurfer.once('finish', () => {
        // Keep analysis result text; no status change.
      });
    };
    if (peakSurferReady) {
      playWithSurfer();
    } else {
      peakSurfer.once('ready', playWithSurfer);
    }
  } else {
    const ctx = ensureAudioContext();
    if (!ctx) {
      setPeakStatus('peakUnsupported');
      return;
    }
    stopSnippet();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.7;
    snippetGain = ctx.createGain();
    snippetGain.gain.value = 1;
    snippetSource = ctx.createBufferSource();
    snippetSource.buffer = peakInfo.buffer;
    snippetSource.connect(analyser);
    analyser.connect(snippetGain);
    snippetGain.connect(ctx.destination);
    snippetSource.start(0, start, duration);
    peakPausedAt = 0;
    const startedAt = ctx.currentTime;
    const tick = () => {
      const elapsed = ctx.currentTime - startedAt;
      const currentPos = Math.min(end, start + elapsed);
      updatePeakTimeUI(currentPos, totalDuration);
      if (elapsed < duration && snippetSource) {
        snippetAnimation = requestAnimationFrame(tick);
      }
    };
    snippetAnimation = requestAnimationFrame(tick);
    snippetSource.onended = () => {
      stopSnippet();
      // Keep analysis result text; no status change.
    };
  }
  }

function togglePeakPlayback() {
  if (!peakInfo || !playlist[currentIndex] || playlist[currentIndex].id !== peakInfo.trackId) {
    setPeakStatus('peakTrackChanged');
    setPeakControlsEnabled(false);
    return;
  }
  if (peakSurfer && typeof peakSurfer.isPlaying === 'function') {
    if (peakSurfer.isPlaying()) {
      peakPausedAt = peakSurfer.getCurrentTime ? peakSurfer.getCurrentTime() : 0;
      peakSurfer.pause();
      return;
    }
    playPeakExcerpt(false);
    return;
  }
  if (snippetSource) {
    stopSnippet();
    return;
  }
  playPeakExcerpt(false);
}

window.onLanguageChanged = () => {
  renderPlaylist();
  updateTotalDuration();
  refreshPlayButton();
  updateLangMenuHighlight();
  setPeakStatus(peakStatusKey, peakStatusParams);
  updateThemeLabel(document.documentElement.classList.contains('theme-dark'));
  if (currentIndex < 0) {
    nowPlayingLabel.textContent = t('nowPlaying.idle');
  } else if (isInGap) {
    nowPlayingLabel.textContent = t('nowPlaying.gap', { seconds: gapDurationSec });
    const elapsed = Math.min((performance.now() - gapStartTime) / 1000, gapDurationSec);
    updateGapProgress(elapsed, gapDurationSec);
  } else if (isInLead) {
    nowPlayingLabel.textContent = t('nowPlaying.lead', { seconds: leadDurationSec.toFixed(1) });
    const elapsed = Math.min((performance.now() - leadStartTime) / 1000, leadDurationSec);
    updateGapProgress(elapsed, leadDurationSec, false, true);
  } else {
    const currentTrack = playlist[currentIndex];
    nowPlayingLabel.textContent = t('nowPlaying.track', { name: currentTrack?.name || '' });
    updateGapProgress(0, 0, true);
  }
};
