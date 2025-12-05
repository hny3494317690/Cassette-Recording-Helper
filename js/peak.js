// Peak analysis and waveform playback
(function () {
  const { refs, state } = window.AppState || {};
  if (!refs || !state) return;
  const {
    analyzePeakButton,
    playPeakFromStartButton,
    togglePeakPlayButton,
    peakStatus,
    peakWaveform,
  } = refs;

  const peakMarker = (() => {
    if (!peakWaveform) return null;
    const marker = document.createElement('div');
    marker.className = 'peak-marker';
    peakWaveform.appendChild(marker);
    return marker;
  })();

  function formatSeconds(value) {
    if (!Number.isFinite(value)) return '0:00';
    const minutes = Math.floor(value / 60);
    const seconds = (value % 60).toFixed(1).padStart(4, '0');
    return `${minutes}:${seconds}`;
  }

  function setPeakControlsEnabled(enabled) {
    if (playPeakFromStartButton) playPeakFromStartButton.disabled = !enabled;
    if (togglePeakPlayButton) togglePeakPlayButton.disabled = !enabled;
  }

  function setPeakStatus(key, params) {
    if (!peakStatus) return;
    if (typeof key === 'string') {
      state.peakStatusKey = key;
      state.peakStatusParams = params;
      peakStatus.textContent = t(key, params);
    } else {
      peakStatus.textContent = key;
    }
  }

  function updatePeakTimeUI(current = 0, total = 0) {
    const currentEl = document.getElementById('peakCurrentTime');
    const totalEl = document.getElementById('peakTotalTime');
    const progressFill = document.querySelector('.peak-progress .progress-bar');
    if (currentEl) currentEl.textContent = formatSeconds(current).replace(/\.0$/, '');
    if (totalEl) totalEl.textContent = formatSeconds(total || 0).replace(/\.0$/, '');
    if (progressFill) {
      const pct = total > 0 ? Math.min(1, Math.max(0, current / total)) * 100 : 0;
      progressFill.style.width = `${pct}%`;
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
    if (state.spectrumTimer) {
      cancelAnimationFrame(state.spectrumTimer);
      state.spectrumTimer = null;
    }
    if (state.snippetAnimation) {
      cancelAnimationFrame(state.snippetAnimation);
      state.snippetAnimation = null;
    }
    if (state.peakSurferTimeHandler && state.peakSurfer) {
      state.peakSurfer.un('timeupdate', state.peakSurferTimeHandler);
    }
    state.peakSurferTimeHandler = null;
    state.peakTargetEnd = null;
    if (state.peakSurfer) {
      state.peakSurfer.destroy();
      state.peakSurfer = null;
      state.peakSurferReady = false;
    }
    updatePeakTimeUI(0, 0);
    updatePeakMarker(null, 0);
  }

  function stopSnippet() {
    if (state.snippetSource) {
      try {
        state.snippetSource.stop();
      } catch (e) {
        // ignore
      }
      state.snippetSource.disconnect();
      state.snippetSource = null;
    }
    if (state.snippetGain) {
      state.snippetGain.disconnect();
      state.snippetGain = null;
    }
    if (state.analyser) {
      state.analyser.disconnect();
      state.analyser = null;
    }
    clearSpectrum();
  }

  function resizePeakCanvas() {
    const rect = peakWaveform?.getBoundingClientRect();
    if (!rect) return;
    const dpr = window.devicePixelRatio || 1;
    state.peakDpr = dpr;
    state.peakCanvasWidth = Math.max(320, Math.floor(rect.width));
    state.peakCanvasHeight = Math.max(160, Math.floor(rect.height || 200));
    if (state.peakSurfer?.drawer) {
      state.peakSurfer.setOptions({ height: state.peakCanvasHeight });
      state.peakSurfer.drawer.containerWidth = state.peakCanvasWidth;
      state.peakSurfer.drawer.containerHeight = state.peakCanvasHeight;
      state.peakSurfer.drawer.updateSize();
      state.peakSurfer.drawBuffer();
    }
  }

  async function handlePeakAnalysis() {
    if (state.currentIndex < 0 || !state.playlist[state.currentIndex]) {
      setPeakStatus('peakNoTrack');
      state.peakInfo = null;
      return;
    }
    const track = state.playlist[state.currentIndex];
    if (!track.file) {
      setPeakStatus('peakNoTrack');
      state.peakInfo = null;
      return;
    }
    const ctx = window.Player?.ensureAudioContext();
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
      state.peakInfo = { trackId: track.id, time: peakTime, start, end, buffer: audioBuffer, duration: audioBuffer.duration };
      updatePeakTimeUI(start, audioBuffer.duration);
      updatePeakMarker(peakTime, audioBuffer.duration);
      if (window.WaveSurfer && peakWaveform) {
        if (state.peakSurfer) {
          state.peakSurfer.destroy();
          state.peakSurfer = null;
          state.peakSurferReady = false;
        }
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent')?.trim() || '#6ba2ff';
        const height = state.peakCanvasHeight || 200;
        state.peakSurferReady = false;
        const surferFactory = window.createPeakSurfer || ((opts) => WaveSurfer.create(opts));
        state.peakSurfer = surferFactory({
          container: peakWaveform,
          height,
          waveColor: 'rgb(255, 220, 60)',
          progressColor: 'rgba(80, 200, 120, 0.9)',
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
        state.peakSurfer.once('ready', () => {
          state.peakSurferReady = true;
          const surferDuration = state.peakSurfer.getDuration ? state.peakSurfer.getDuration() : track.duration || audioBuffer.duration || 1;
          const startPos = state.peakInfo?.start || 0;
          if (state.peakSurferTimeHandler && state.peakSurfer) {
            state.peakSurfer.un('timeupdate', state.peakSurferTimeHandler);
          }
          state.peakSurferTimeHandler = (time) => {
            updatePeakTimeUI(time, surferDuration);
            updatePeakMarker(state.peakInfo?.time, surferDuration);
            if (state.peakTargetEnd != null && time >= state.peakTargetEnd - 0.02) {
              const endPoint = state.peakTargetEnd;
              state.peakTargetEnd = null;
              state.peakSurfer.pause();
              if (typeof endPoint === 'number') state.peakSurfer.setTime(endPoint);
            }
          };
          state.peakSurfer.on('timeupdate', state.peakSurferTimeHandler);
          updatePeakTimeUI(startPos, surferDuration);
          if (surferDuration > 0) {
            const ratio = Math.min(1, Math.max(0, startPos / surferDuration));
            if (typeof state.peakSurfer.seekTo === 'function') {
              state.peakSurfer.seekTo(ratio);
            } else if (typeof state.peakSurfer.setTime === 'function') {
              state.peakSurfer.setTime(startPos);
            }
          }
        });
        state.peakSurfer.once('error', () => {
          state.peakSurferReady = false;
        });
        state.peakSurfer.on('interaction', () => {
          const surferDuration = state.peakSurfer.getDuration ? state.peakSurfer.getDuration() : audioBuffer.duration || track.duration || 0;
          const pos = state.peakSurfer.getCurrentTime ? state.peakSurfer.getCurrentTime() : 0;
          state.peakPausedAt = pos;
          updatePeakTimeUI(pos, surferDuration);
        });
        state.peakSurfer.on('seeking', () => {
          const surferDuration = state.peakSurfer.getDuration ? state.peakSurfer.getDuration() : audioBuffer.duration || track.duration || 0;
          const pos = state.peakSurfer.getCurrentTime ? state.peakSurfer.getCurrentTime() : 0;
          state.peakPausedAt = pos;
          updatePeakTimeUI(pos, surferDuration);
        });
        state.peakSurfer.load(track.url);
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
      state.peakInfo = null;
      setPeakControlsEnabled(false);
    }
  }

  function playPeakExcerpt(reset = false) {
    if (!state.peakInfo || !state.playlist[state.currentIndex] || state.playlist[state.currentIndex].id !== state.peakInfo.trackId) {
      setPeakStatus('peakTrackChanged');
      setPeakControlsEnabled(false);
      return;
    }
    if (state.currentHowl?.playing?.()) {
      window.Player?.pauseCurrent();
    }
    const totalDuration = state.peakInfo.buffer.duration;
    const baseStart = reset ? state.peakInfo.start : (state.peakSurfer?.getCurrentTime?.() ?? state.peakPausedAt ?? state.peakInfo.start);
    const start = Math.max(0, Math.min(totalDuration - 0.05, baseStart));
    const duration = Math.min(15, Math.max(0.05, totalDuration - start));
    const end = Math.min(totalDuration, start + duration);
    state.peakTargetEnd = null;
    if (state.peakSurfer) {
      const playWithSurfer = () => {
        if (!state.peakSurfer) return;
        const surferDuration = state.peakSurfer.getDuration ? state.peakSurfer.getDuration() : totalDuration;
        const currentPos = state.peakSurfer.getCurrentTime ? state.peakSurfer.getCurrentTime() : start;
        const chosenStart = reset ? start : currentPos;
        const safeStart = Math.max(0, Math.min(surferDuration - 0.01, chosenStart));
        const safeEnd = Math.min(surferDuration, end);
        state.peakTargetEnd = safeEnd;
        state.peakPausedAt = 0;
        state.peakSurfer.stop();
        state.peakSurfer.setTime(safeStart);
        updatePeakTimeUI(safeStart, surferDuration);
        state.peakSurfer.play(safeStart, safeEnd);
        state.peakSurfer.once('finish', () => {
          // Keep analysis result text; no status change.
        });
      };
      if (state.peakSurferReady) {
        playWithSurfer();
      } else {
        state.peakSurfer.once('ready', playWithSurfer);
      }
    } else {
      const ctx = window.Player?.ensureAudioContext();
      if (!ctx) {
        setPeakStatus('peakUnsupported');
        return;
      }
      stopSnippet();
      state.analyser = ctx.createAnalyser();
      state.analyser.fftSize = 1024;
      state.analyser.smoothingTimeConstant = 0.7;
      state.snippetGain = ctx.createGain();
      state.snippetGain.gain.value = 1;
      state.snippetSource = ctx.createBufferSource();
      state.snippetSource.buffer = state.peakInfo.buffer;
      state.snippetSource.connect(state.analyser);
      state.analyser.connect(state.snippetGain);
      state.snippetGain.connect(ctx.destination);
      state.snippetSource.start(0, start, duration);
      state.peakPausedAt = 0;
      const startedAt = ctx.currentTime;
      const tick = () => {
        const elapsed = ctx.currentTime - startedAt;
        const currentPos = Math.min(end, start + elapsed);
        updatePeakTimeUI(currentPos, totalDuration);
        if (elapsed < duration && state.snippetSource) {
          state.snippetAnimation = requestAnimationFrame(tick);
        }
      };
      state.snippetAnimation = requestAnimationFrame(tick);
      state.snippetSource.onended = () => {
        stopSnippet();
      };
    }
  }

  function togglePeakPlayback() {
    if (!state.peakInfo || !state.playlist[state.currentIndex] || state.playlist[state.currentIndex].id !== state.peakInfo.trackId) {
      setPeakStatus('peakTrackChanged');
      setPeakControlsEnabled(false);
      return;
    }
    if (state.peakSurfer && typeof state.peakSurfer.isPlaying === 'function') {
      if (state.peakSurfer.isPlaying()) {
        state.peakPausedAt = state.peakSurfer.getCurrentTime ? state.peakSurfer.getCurrentTime() : 0;
        state.peakSurfer.pause();
        return;
      }
      playPeakExcerpt(false);
      return;
    }
    if (state.snippetSource) {
      stopSnippet();
      return;
    }
    playPeakExcerpt(false);
  }

  function init() {
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
  }

  window.Peak = {
    init,
    formatSeconds,
    setPeakControlsEnabled,
    setPeakStatus,
    updatePeakTimeUI,
    updatePeakMarker,
    clearSpectrum,
    stopSnippet,
    resizePeakCanvas,
    handlePeakAnalysis,
    playPeakExcerpt,
    togglePeakPlayback,
  };
})();
