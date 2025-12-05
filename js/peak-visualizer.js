// Helper to build WaveSurfer instances with a smooth gradient (no bars).
(function () {
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  function buildPeakGradients(height = 200) {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const h = Math.max(1, height);

    const build = (stops) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h * 1.35);
      stops.forEach(([offset, color]) => grad.addColorStop(clamp01(offset), color));
      return grad;
    };

    const lineOffset = 0.7;
    const step = 1 / h;
    const waveColor = build([
      [0, 'rgb(255, 244, 178)'], // light yellow
      [lineOffset, 'rgb(220, 190, 90)'],
      [1, 'rgb(120, 95, 35)'],
    ]);

    const progressColor = 'rgba(80, 200, 120, 0.9)'; // green for played portion

    return { waveColor, progressColor };
  }

  function createPeakSurfer({ container, height = 200, accent }) {
    const gradients = buildPeakGradients(height);
    const accentColor = accent || gradients.waveColor;
    return WaveSurfer.create({
      container,
      waveColor: gradients.waveColor || accentColor,
      progressColor: gradients.progressColor,
      height,
      responsive: true,
      normalize: false,
      interact: false,
      dragToSeek: false,
      cursorColor: '#57BAB6',
      cursorWidth: 3,
      minPxPerSec: 0,
      fillParent: true,
      autoCenter: false,
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

  window.buildPeakGradients = buildPeakGradients;
  window.createPeakSurfer = createPeakSurfer;
})();
