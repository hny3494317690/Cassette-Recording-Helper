// Playlist and list-related UI logic
(function () {
  const { refs, state } = window.AppState || {};
  if (!refs || !state) return;

  const {
    fileInput,
    dropZone,
    gapInput,
    playlistElement,
    totalDurationElement,
    playAllButton,
    togglePlayButton,
    stopPlayButton,
    clearButton,
    nowPlayingLabel,
    template,
    globalProgressBar,
    globalProgressText,
    gapProgressRow,
    gapProgressBar,
    gapProgressText,
    leadInput,
    lockToggle,
    levelCheckToggle,
  } = refs;

  const { formatAdjustDb, parseAdjustDb, applyTrackGain, computeTrackLevels } = window.LevelUtils || {};
  const formatAdjust = (v) => (Number.isFinite(v) ? v.toFixed(1) : '0.0');
  const parseAdjust = (v) => (parseAdjustDb ? parseAdjustDb(v) : Number.parseFloat(String(v)) || 0);

  // Helper to keep DOM updates in one place
  const dom = {
    renderEmpty() {
      const empty = document.createElement('li');
      empty.textContent = t('emptyList');
      empty.className = 'empty';
      playlistElement.appendChild(empty);
      state.currentIndex = -1;
      nowPlayingLabel.textContent = t('nowPlaying.idle');
      updateTotalDuration();
    },
  };

  function applyDragLockState() {
    const canDrag = !lockToggle?.checked;
    toggleSortable(canDrag);
  }

  function setTrackGain(track) {
    applyTrackGain?.(track, state.currentHowl, state.currentIndex, state.playlist);
  }

  async function runLevelCheck() {
    if (!state.playlist.length) return;
    if (levelCheckToggle) levelCheckToggle.disabled = true;
    for (const track of state.playlist) {
      await computeTrackLevels?.(track, window.Player?.ensureAudioContext);
    }
    renderPlaylist();
    if (levelCheckToggle) levelCheckToggle.disabled = false;
  }

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
    state.playlist.push(track);
    renderPlaylist();
    probeDuration(track);
    if (state.autoLevelCheck) {
      computeTrackLevels?.(track, window.Player?.ensureAudioContext).then(() => renderPlaylist());
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
    if (state.playlist.length === 0) {
      dom.renderEmpty();
      return;
    }

    state.playlist.forEach((track, index) => {
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
        track.adjustDb = parseAdjustDb ? parseAdjustDb(input.value) : parseAdjust(input.value);
        input.value = formatAdjust(track.adjustDb);
        setTrackGain(track);
      };
      input.addEventListener('input', (e) => {
        e.stopPropagation();
        track.adjustDb = parseAdjustDb ? parseAdjustDb(input.value) : parseAdjust(input.value);
        setTrackGain(track);
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
        if (index !== state.currentIndex) return;
        const tTrack = state.playlist[state.currentIndex];
        const dur = tTrack?.duration ?? (state.currentHowl ? state.currentHowl.duration() : 0);
        if (!Number.isFinite(dur) || dur <= 0) return;
        const ratio = progress.value / 1000;
        if (state.currentHowl) {
          state.currentHowl.seek(Math.min(dur * ratio, dur));
        }
        updateGlobalProgress();
      });
      node.appendChild(progress);

      node.addEventListener('click', () => selectTrack(index, false));
      if (index === state.currentIndex) node.classList.add('active');

      playlistElement.appendChild(node);
    });

    updateTrackProgressUI();
    updateTotalDuration();
    ensureSortable();
    applyDragLockState();
  }

  function deleteTrack(index) {
    if (index < 0 || index >= state.playlist.length) return;
    const [removed] = state.playlist.splice(index, 1);
    if (removed) URL.revokeObjectURL(removed.url);
    if (state.currentIndex === index) {
      window.Player?.stopPlayback();
    } else if (state.currentIndex > index) {
      state.currentIndex -= 1;
    }
    renderPlaylist();
  }

  function selectTrack(index, autoplay = false) {
    if (index < 0 || index >= state.playlist.length) return;
    window.Peak?.stopSnippet();
    state.peakInfo = null;
    window.Peak?.setPeakControlsEnabled(false);
    window.Peak?.setPeakStatus('peakNeedAnalyze');
    window.Player?.clearGapState();
    state.currentIndex = index;
    const track = state.playlist[index];
    track.finished = false;
    nowPlayingLabel.textContent = t('nowPlaying.track', { name: track.name });
    highlightActive();
    window.Player?.loadHowl(track);
    window.Player?.refreshPlayButton();
    window.Peak?.setPeakStatus('peakNeedAnalyze');
    window.Peak?.setPeakControlsEnabled(false);
    window.Peak?.clearSpectrum();
    if (autoplay) {
      if (!state.hasPlayedOnce) {
        const leadSeconds = getLeadSeconds();
        if (leadSeconds > 0) {
          window.Player?.startLeadGap(leadSeconds);
        } else {
          window.Player?.playCurrent();
        }
      } else {
        window.Player?.playCurrent();
      }
    } else {
      const leadSeconds = getLeadSeconds();
      if (leadSeconds > 0) {
        window.Player?.clearLeadState();
        updateGapProgress(0, leadSeconds, true);
      }
    }
    updateTrackProgressUI();
    updateGlobalProgress();
  }

  function highlightActive() {
    const nodes = playlistElement.querySelectorAll('.track');
    nodes.forEach((node, idx) => node.classList.toggle('active', idx === state.currentIndex));
  }

  function ensureSortable() {
    if (!window.Sortable || state.sortable) return;
    state.sortable = window.Sortable.create(playlistElement, {
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
    if (from < 0 || to < 0 || from >= state.playlist.length || to >= state.playlist.length) return;
    const [moved] = state.playlist.splice(from, 1);
    state.playlist.splice(to, 0, moved);
    if (state.currentIndex === from) state.currentIndex = to;
    else if (state.currentIndex > from && state.currentIndex <= to) state.currentIndex -= 1;
    else if (state.currentIndex < from && state.currentIndex >= to) state.currentIndex += 1;
    renderPlaylist();
  }

  function toggleSortable(enabled) {
    if (state.sortable) {
      state.sortable.option('disabled', !enabled);
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

  function updateTrackProgressUI() {
    const nodes = playlistElement.querySelectorAll('.track');
    nodes.forEach((node) => {
      const idx = Number(node.dataset.index);
      const slider = node.querySelector('.track-progress');
      if (!slider) return;
      const track = state.playlist[idx];
      const isCurrent = idx === state.currentIndex;
      if (track?.finished) {
        slider.disabled = false;
        slider.value = 1000;
        slider.classList.toggle('done', true);
        return;
      }
      if (isCurrent && state.isInGap) {
        slider.disabled = false;
        slider.value = 1000;
        slider.classList.toggle('done', true);
        return;
      }
      if (!isCurrent) {
        slider.disabled = false;
        if (track?.finished || idx < state.currentIndex || (track?.status === 'ready' && idx < state.currentIndex)) {
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
        (state.currentHowl && state.currentIndex === idx ? state.currentHowl.duration() : undefined);
      const pos = state.currentHowl && state.currentIndex === idx ? state.currentHowl.seek() || 0 : 0;
      if (Number.isFinite(dur) && dur > 0) {
        slider.value = Math.min(1000, Math.max(0, Math.round((pos / dur) * 1000)));
        slider.classList.toggle('done', false);
      } else {
        slider.value = 0;
        slider.classList.toggle('done', !!track?.finished);
      }
    });
  }

  function computeDurations() {
    const gapSeconds = getGapSeconds();
    const leadSeconds = getLeadSeconds();
    const trackSeconds = state.playlist.reduce((sum, track) => {
      if (track.status === 'ready' && Number.isFinite(track.duration)) return sum + track.duration;
      if (state.playlist[state.currentIndex] === track && state.currentHowl && Number.isFinite(state.currentHowl.duration())) {
        return sum + state.currentHowl.duration();
      }
      return sum;
    }, 0);
    const pending = state.playlist.some((t) => t.status === 'pending');
    const gapInsertions = Math.max(0, state.playlist.length - 1);
    return { totalSeconds: leadSeconds + trackSeconds + gapInsertions * gapSeconds, gapSeconds, leadSeconds, pending };
  }

  function updateTotalDuration() {
    const duration = computeDurations();
    if (state.playlist.length === 0) {
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

  function updateGapProgress(elapsed, total, hide = false, isLead = false) {
    if (!gapProgressRow || !gapProgressBar || !gapProgressText) return;
    const showing = isLead ? state.isInLead : state.isInGap;
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

  function updateGlobalProgress() {
    const { totalSeconds, gapSeconds, leadSeconds } = computeDurations();
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
      if (globalProgressBar) globalProgressBar.style.width = '0%';
      if (globalProgressText) globalProgressText.textContent = '00:00 / 00:00';
      return;
    }

    let elapsed = 0;
    if (state.currentIndex >= 0) {
      if (state.leadDurationSec > 0) {
        const leadElapsed = Math.min((performance.now() - state.leadStartTime) / 1000, state.leadDurationSec);
        elapsed += leadElapsed;
        updateGapProgress(leadElapsed, state.leadDurationSec, false, true);
        if (leadElapsed < state.leadDurationSec) {
          if (globalProgressBar) globalProgressBar.style.width = `${Math.min(100, (elapsed / totalSeconds) * 100)}%`;
          if (globalProgressText) globalProgressText.textContent = `${formatDuration(elapsed)} / ${formatDuration(totalSeconds)}`;
          return;
        }
      } else if (leadSeconds > 0) {
        elapsed += leadSeconds;
      }

      const finished = state.playlist.slice(0, state.currentIndex).reduce((sum, t) => sum + (Number.isFinite(t.duration) ? t.duration : 0), 0);
      elapsed += finished;
      elapsed += gapSeconds * state.currentIndex;

      if (state.isInGap) {
        const currentTrack = state.playlist[state.currentIndex];
        elapsed += Number.isFinite(currentTrack?.duration) ? currentTrack.duration : 0;
        const gapElapsed = Math.min((performance.now() - state.gapStartTime) / 1000, state.gapDurationSec);
        elapsed += gapElapsed;
        updateGapProgress(gapElapsed, state.gapDurationSec);
      } else {
        const track = state.playlist[state.currentIndex];
        const dur =
          Number.isFinite(track?.duration) && track.duration > 0
            ? track.duration
            : state.currentHowl && Number.isFinite(state.currentHowl.duration())
            ? state.currentHowl.duration()
            : 0;
        const pos = state.currentHowl ? state.currentHowl.seek() || 0 : 0;
        elapsed += Math.min(pos, dur || 0);
        updateGapProgress(0, 0, true);
        if (dur > 0 && pos >= dur && state.currentIndex >= 0) {
          const slider = playlistElement.querySelector(`.track[data-index="${state.currentIndex}"] .track-progress`);
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

  function init() {
    fileInput?.addEventListener('change', (event) => {
      handleIncomingFiles(event.target.files);
      fileInput.value = '';
    });

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

    gapInput?.addEventListener('input', () => {
      normalizeGapInput(false);
      updateTotalDuration();
    });
    gapInput?.addEventListener('blur', () => {
      normalizeGapInput(true);
      updateTotalDuration();
    });

    leadInput?.addEventListener('input', () => {
      normalizeLeadInput(false);
      updateTotalDuration();
    });
    leadInput?.addEventListener('blur', () => {
      normalizeLeadInput(true);
      updateTotalDuration();
    });

    playAllButton?.addEventListener('click', () => {
      if (state.playlist.length === 0) return;
      selectTrack(0, true);
    });

    togglePlayButton?.addEventListener('click', () => {
      if (state.currentIndex < 0 && state.playlist.length > 0) {
        selectTrack(0, true);
        return;
      }
      if (state.currentHowl) {
        if (state.currentHowl.playing()) {
          window.Player?.pauseCurrent();
        } else {
          window.Player?.playCurrent();
        }
      }
    });

    stopPlayButton?.addEventListener('click', () => window.Player?.stopPlayback());

    clearButton?.addEventListener('click', () => {
      window.Player?.stopPlayback();
      state.playlist.splice(0, state.playlist.length).forEach((item) => URL.revokeObjectURL(item.url));
      renderPlaylist();
    });

    window.addEventListener('beforeunload', () => {
      state.playlist.forEach((item) => URL.revokeObjectURL(item.url));
    });

    if (lockToggle) {
      lockToggle.checked = false;
      lockToggle.addEventListener('change', applyDragLockState);
    }
    applyDragLockState();

    if (levelCheckToggle) {
      const savedAuto = localStorage.getItem('autoLevelCheck');
      state.autoLevelCheck = savedAuto === '1';
      levelCheckToggle.checked = state.autoLevelCheck;
      levelCheckToggle.addEventListener('change', () => {
        state.autoLevelCheck = levelCheckToggle.checked;
        localStorage.setItem('autoLevelCheck', state.autoLevelCheck ? '1' : '0');
        if (state.autoLevelCheck) runLevelCheck();
      });
    }
  }

  window.Playlist = {
    init,
    handleIncomingFiles,
    queueTrack,
    renderPlaylist,
    deleteTrack,
    selectTrack,
    highlightActive,
    ensureSortable,
    reorder,
    toggleSortable,
    applyDragLockState,
    updateTrackProgressUI,
    updateTotalDuration,
    computeDurations,
    updateGlobalProgress,
    updateGapProgress,
  };
})();
