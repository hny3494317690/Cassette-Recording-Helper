// Main orchestrator tying together playlist, player, peak, theme, and i18n
(function () {
  const { refs, state } = window.AppState || {};
  if (!refs || !state) return;
  const {
    gapInput,
    leadInput,
    playlistElement,
    nowPlayingLabel,
  } = refs;

  // Keep legacy globals used by utility helpers
  window.gapInput = gapInput;
  window.leadInput = leadInput;
  window.playlistElement = playlistElement;

  const { applyTheme, updateThemeLabel, initThemeSwitch, initLangMenu } = window.AppTheme || {};
  let updateLangMenuHighlight = () => {};

  // Use plain numeric formatting so native number inputs accept/show positives.
  const formatAdjust = (v) => (Number.isFinite(v) ? v.toFixed(1) : '0.0');
  const parseAdjust = (v) => (window.LevelUtils?.parseAdjustDb ? window.LevelUtils.parseAdjustDb(v) : Number.parseFloat(String(v)) || 0);
  window.formatAdjust = formatAdjust;
  window.parseAdjust = parseAdjust;

  if (initLangMenu) {
    updateLangMenuHighlight = initLangMenu();
  }
  if (initThemeSwitch) initThemeSwitch();

  // Initialize feature modules
  window.Playlist?.init();
  window.Peak?.init();

  // Render initial empty state
  window.Playlist?.renderPlaylist();
  window.Playlist?.updateTotalDuration();
  window.Player?.refreshPlayButton?.();

  window.onLanguageChanged = () => {
    window.Playlist?.renderPlaylist();
    window.Playlist?.updateTotalDuration();
    window.Player?.refreshPlayButton();
    updateLangMenuHighlight();
    window.Peak?.setPeakStatus(state.peakStatusKey, state.peakStatusParams);
    updateThemeLabel?.(document.documentElement.classList.contains('theme-dark'));
    if (state.currentIndex < 0) {
      nowPlayingLabel.textContent = t('nowPlaying.idle');
    } else if (state.isInGap) {
      nowPlayingLabel.textContent = t('nowPlaying.gap', { seconds: state.gapDurationSec });
      const elapsed = Math.min((performance.now() - state.gapStartTime) / 1000, state.gapDurationSec);
      window.Playlist?.updateGapProgress(elapsed, state.gapDurationSec);
    } else if (state.isInLead) {
      nowPlayingLabel.textContent = t('nowPlaying.lead', { seconds: state.leadDurationSec.toFixed(1) });
      const elapsed = Math.min((performance.now() - state.leadStartTime) / 1000, state.leadDurationSec);
      window.Playlist?.updateGapProgress(elapsed, state.leadDurationSec, false, true);
    } else {
      const currentTrack = state.playlist[state.currentIndex];
      nowPlayingLabel.textContent = t('nowPlaying.track', { name: currentTrack?.name || '' });
      window.Playlist?.updateGapProgress(0, 0, true);
    }
  };
})();
