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
function applyDragLockState() {
  const canDrag = !lockToggle?.checked;
  toggleSortable(canDrag);
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
  };
  playlist.push(track);
  renderPlaylist();
  probeDuration(track);
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
  clearGapState();
  currentIndex = index;
  const track = playlist[index];
  track.finished = false;
  nowPlayingLabel.textContent = t('nowPlaying.track', { name: track.name });
  highlightActive();
  loadHowl(track);
  refreshPlayButton();
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
  clearGapState();
  clearLeadState();
  stopHowl();
  nowPlayingLabel.textContent = t('nowPlaying.idle');
  currentIndex = -1;
  hasPlayedOnce = false;
  updateTrackProgressUI();
  updateGlobalProgress();
  refreshPlayButton();
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

window.onLanguageChanged = () => {
  renderPlaylist();
  updateTotalDuration();
  refreshPlayButton();
  updateLangMenuHighlight();
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
