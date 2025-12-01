function formatDuration(value) {
  if (!Number.isFinite(value) || value <= 0) return '00:00';
  const totalSeconds = Math.round(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function guessFormat(name) {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop()?.toUpperCase() : '音频';
}

function createId() {
  return crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeGapInput(forceDefault) {
  const val = parseFloat(gapInput.value);
  if (Number.isNaN(val)) {
    if (forceDefault) gapInput.value = '3.0';
    return;
  }
  const safe = Math.max(0, val);
  gapInput.value = safe.toFixed(1);
}

function getGapSeconds() {
  const val = parseFloat(gapInput.value);
  if (Number.isNaN(val)) return 3;
  return Math.max(0, parseFloat(val.toFixed(1)));
}

function normalizeLeadInput(forceDefault) {
  const val = parseFloat(leadInput.value);
  if (Number.isNaN(val)) {
    if (forceDefault) leadInput.value = '3.0';
    return;
  }
  const safe = Math.max(0, val);
  leadInput.value = safe.toFixed(1);
}

function getLeadSeconds() {
  const val = parseFloat(leadInput.value);
  if (Number.isNaN(val)) return 3;
  return Math.max(0, parseFloat(val.toFixed(1)));
}
