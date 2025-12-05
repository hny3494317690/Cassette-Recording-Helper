(function () {
  function formatAdjustDb(value) {
    if (!Number.isFinite(value)) return '0.0';
    if (value > 0) return `+${value.toFixed(1)}`;
    if (value === 0) return '0.0';
    return value.toFixed(1);
  }

  function parseAdjustDb(value) {
    const num = Number.parseFloat(String(value).replace('+', ''));
    return Number.isFinite(num) ? Number(num.toFixed(1)) : 0;
  }

  function applyTrackGain(track, currentHowl, currentIndex, playlist) {
    if (!track || !currentHowl || playlist[currentIndex]?.id !== track.id) return;
    const gain = Math.max(0, Math.min(2, Math.pow(10, (track.adjustDb || 0) / 20)));
    currentHowl.volume(gain);
  }

  async function computeTrackLevels(track, ensureAudioContext) {
    const ctx = ensureAudioContext();
    if (!ctx || !track?.file) return;
    try {
      const arrayBuffer = await track.file.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      let maxAbs = 0;
      let sumSquares = 0;
      let count = 0;
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch += 1) {
        const data = audioBuffer.getChannelData(ch);
        for (let i = 0; i < data.length; i += 1) {
          const v = data[i];
          const abs = Math.abs(v);
          if (abs > maxAbs) maxAbs = abs;
          sumSquares += v * v;
          count += 1;
        }
      }
      const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
      const toDb = (val) => (val > 0 ? 20 * Math.log10(val) : -Infinity);
      track.avgDb = toDb(rms);
      track.peakDb = toDb(maxAbs);
      track.levelComputed = true;
    } catch (err) {
      console.error('Level check failed', err);
      track.avgDb = null;
      track.peakDb = null;
      track.levelComputed = false;
    }
  }

  window.LevelUtils = { formatAdjustDb, parseAdjustDb, applyTrackGain, computeTrackLevels };
})();
