// Player and playback controls
(function () {
  const { refs, state } = window.AppState || {};
  if (!refs || !state) return;
  const {
    nowPlayingLabel,
    togglePlayButton,
    gapProgressRow,
    gapProgressBar,
    gapProgressText,
  } = refs;

  function ensureAudioContext() {
    if (!state.audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      state.audioCtx = new Ctx();
    }
    return state.audioCtx;
  }

  function refreshPlayButton() {
    const playing = state.currentHowl?.playing?.() || false;
    if (togglePlayButton) togglePlayButton.textContent = playing ? t('pause') : t('playPauseButton');
  }

  function loadHowl(track) {
    if (!window.Howl) {
      nowPlayingLabel.textContent = t('playerLibMissing');
      return;
    }
    stopHowl();
    state.currentHowl = new Howl({
      src: [track.url],
      html5: true,
      preload: true,
      onload() {
        if (!Number.isFinite(track.duration)) {
          const dur = state.currentHowl.duration();
          if (Number.isFinite(dur)) {
            track.duration = dur;
            track.status = 'ready';
            window.Playlist?.renderPlaylist();
          }
        }
        window.Playlist?.updateTotalDuration();
      },
      onend: handleTrackEnded,
    });
    const applyTrackGainLocal = window.LevelUtils?.applyTrackGain;
    if (applyTrackGainLocal) applyTrackGainLocal(track, state.currentHowl, state.currentIndex, state.playlist);
  }

  function playCurrent() {
    if (!state.currentHowl) return;
    clearGapState();
    clearLeadState();
    state.currentHowl.play();
    startProgressTimer();
    refreshPlayButton();
    state.hasPlayedOnce = true;
  }

  function pauseCurrent() {
    if (state.currentHowl) state.currentHowl.pause();
    stopProgressTimer();
    refreshPlayButton();
  }

  function stopHowl() {
    stopProgressTimer();
    if (state.currentHowl) {
      state.currentHowl.stop();
      state.currentHowl.unload();
      state.currentHowl = null;
    }
  }

  function handleTrackEnded() {
    const currentTrack = state.playlist[state.currentIndex];
    if (currentTrack && !Number.isFinite(currentTrack.duration) && state.currentHowl) {
      const dur = state.currentHowl.duration();
      if (Number.isFinite(dur)) {
        currentTrack.duration = dur;
        currentTrack.status = 'ready';
      }
    }
    const gapSeconds = getGapSeconds();
    const shouldPause = gapSeconds > 0 && state.currentIndex >= 0 && state.currentIndex < state.playlist.length - 1;
    if (shouldPause) {
      nowPlayingLabel.textContent = t('nowPlaying.gap', { seconds: gapSeconds });
      clearGapState();
      state.isInGap = true;
      state.gapStartTime = performance.now();
      state.gapDurationSec = gapSeconds;
      gapProgressRow.hidden = false;
      state.gapTimer = window.setTimeout(playNext, gapSeconds * 1000);
      state.gapInterval = window.setInterval(window.Playlist?.updateGlobalProgress, 100);
      window.Playlist?.updateGapProgress(0, gapSeconds);
      window.Playlist?.updateTrackProgressUI();
      return;
    }
    playNext();
  }

  function playNext() {
    clearGapState();
    clearLeadState();
    if (state.currentIndex < state.playlist.length - 1) {
      window.Playlist?.selectTrack(state.currentIndex + 1, true);
    } else {
      const last = state.playlist[state.currentIndex];
      if (last) last.finished = true;
      nowPlayingLabel.textContent = t('nowPlaying.done');
      stopHowl();
      window.Playlist?.highlightActive();
      window.Playlist?.updateTrackProgressUI();
      refreshPlayButton();
    }
  }

  function stopPlayback() {
    window.Peak?.stopSnippet();
    clearGapState();
    clearLeadState();
    stopHowl();
    nowPlayingLabel.textContent = t('nowPlaying.idle');
    state.currentIndex = -1;
    state.hasPlayedOnce = false;
    window.Playlist?.updateTrackProgressUI();
    window.Playlist?.updateGlobalProgress();
    refreshPlayButton();
    window.Peak?.setPeakStatus('peakIdle');
  }

  function startProgressTimer() {
    stopProgressTimer();
    state.progressTimer = window.setInterval(() => {
      window.Playlist?.updateTrackProgressUI();
      window.Playlist?.updateGlobalProgress();
    }, 200);
  }

  function stopProgressTimer() {
    if (state.progressTimer) {
      window.clearInterval(state.progressTimer);
      state.progressTimer = null;
    }
  }

  function clearGapState() {
    if (state.gapTimer) {
      window.clearTimeout(state.gapTimer);
      state.gapTimer = null;
    }
    if (state.gapInterval) {
      window.clearInterval(state.gapInterval);
      state.gapInterval = null;
    }
    state.isInGap = false;
    state.gapDurationSec = 0;
    state.gapStartTime = 0;
    window.Playlist?.updateGapProgress(0, 0, true);
  }

  function clearLeadState() {
    if (state.leadTimer) {
      window.clearTimeout(state.leadTimer);
      state.leadTimer = null;
    }
    if (state.leadInterval) {
      window.clearInterval(state.leadInterval);
      state.leadInterval = null;
    }
    state.leadDurationSec = 0;
    state.leadStartTime = 0;
    state.isInLead = false;
  }

  function startLeadGap(seconds) {
    clearGapState();
    clearLeadState();
    state.leadDurationSec = seconds;
    state.leadStartTime = performance.now();
    state.isInLead = true;
    gapProgressRow.hidden = false;
    state.gapTimer = null;
    state.leadTimer = window.setTimeout(() => {
      clearLeadState();
      playCurrent();
    }, seconds * 1000);
    state.leadInterval = window.setInterval(window.Playlist?.updateGlobalProgress, 100);
    window.Playlist?.updateGapProgress(0, seconds, false, true);
    nowPlayingLabel.textContent = t('nowPlaying.lead', { seconds: seconds.toFixed(1) });
  }

  window.Player = {
    ensureAudioContext,
    refreshPlayButton,
    loadHowl,
    playCurrent,
    pauseCurrent,
    stopPlayback,
    stopHowl,
    handleTrackEnded,
    playNext,
    startLeadGap,
    clearGapState,
    clearLeadState,
    startProgressTimer,
    stopProgressTimer,
  };
})();
