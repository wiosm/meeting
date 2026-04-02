const form = document.getElementById('configForm');
const titleInput = document.getElementById('meetingTitle');
const minutesInput = document.getElementById('meetingMinutes');
const hostInput = document.getElementById('meetingHost');
const tickerMessageInput = document.getElementById('tickerMessage');
const titleFormatInput = document.getElementById('titleFormat');
const titleLineSizesInput = document.getElementById('titleLineSizes');
const backgroundThemeInput = document.getElementById('backgroundTheme');
const gentleVisualsInput = document.getElementById('gentleVisuals');
const gentleVisualsWaitingInput = document.getElementById('gentleVisualsWaiting');
const musicPresetInput = document.getElementById('meetingMusicPreset');
const musicInput = document.getElementById('meetingMusic');
const previewMusicBtn = document.getElementById('previewMusicBtn');
const previewMusicStatus = document.getElementById('previewMusicStatus');
const titlePreview = document.getElementById('titlePreview');
const waitingTitle = document.getElementById('meetingTitleDisplay');
const hostDisplay = document.getElementById('meetingHostDisplay');
const countdownStage = document.getElementById('countdownStage');
const inProgressStage = document.getElementById('inProgressStage');
const countdownDisplay = document.getElementById('countdownDisplay');
const barProgress = document.getElementById('barProgress');
const configPanel = document.getElementById('configPanel');
const waitingPanel = document.getElementById('waitingPanel');
const editConfigBtn = document.getElementById('editConfigBtn');
const tickerText = document.getElementById('tickerText');
const tickerTrack = document.getElementById('tickerTrack');
const presenceStatus = document.getElementById('presenceStatus');
const presenceEvents = document.getElementById('presenceEvents');
const presencePeople = document.getElementById('presencePeople');
const joinedCountEl = document.getElementById('joinedCount');
const leftCountEl = document.getElementById('leftCount');
const presencePanel = document.getElementById('presencePanel');

const digitMap = {
  m1: countdownDisplay.querySelector('[data-digit="m1"]'),
  m2: countdownDisplay.querySelector('[data-digit="m2"]'),
  s1: countdownDisplay.querySelector('[data-digit="s1"]'),
  s2: countdownDisplay.querySelector('[data-digit="s2"]'),
};
const BACKGROUND_AUDIO_VOLUME = 0.8;
const AUDIO_FADE_SECONDS = 12;

let totalSeconds = 5 * 60;
let endTime = null;
let timerId = null;
let lastRenderedTime = '05:00';
let selectedAudioUrl = null;
let localAudioUrl = null;
let backgroundAudio = null;
let previewAudio = null;
let joinedCount = 0;
let leftCount = 0;
let knownEventIds = new Set();
let extensionPresenceActive = false;
let hasReceivedPresenceEvent = false;
let inProgressShown = false;
let countdownPageTitle = 'Meeting Waiting Screen';
const musicLabelByUrl = new Map(
  Array.from(musicPresetInput.options)
    .filter((option) => option.value)
    .map((option) => [option.value, option.textContent.trim()]),
);

const formatTitle = (rawTitle, format) => {
  const normalized = rawTitle
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

  if (!normalized) {
    return 'iOS Daily Standup';
  }

  if (format === 'uppercase') {
    return normalized.toUpperCase();
  }

  if (format === 'titlecase') {
    return normalized
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return normalized;
};

const flattenTitle = (title) => title.replace(/\s*\n\s*/g, ' • ');
const formatHost = (rawHost) => rawHost.trim().replace(/\s+/g, ' ');
const parseLineSizes = (lineSizesText, lineCount) => {
  const sizeRows = lineSizesText
    .split('\n')
    .map((value) => Number.parseInt(value.trim(), 10));

  return Array.from({ length: lineCount }, (_, index) => {
    const requestedSize = sizeRows[index];
    if (!Number.isFinite(requestedSize)) {
      return 100;
    }
    return Math.max(50, Math.min(180, requestedSize));
  });
};

const renderTitleWithSizes = (target, formattedTitle, lineSizesText) => {
  const lines = formattedTitle.split('\n').filter((line) => line.trim().length > 0);
  const safeLines = lines.length ? lines : ['iOS Daily Standup'];
  const sizes = parseLineSizes(lineSizesText, safeLines.length);

  target.innerHTML = '';

  safeLines.forEach((line, index) => {
    const lineEl = document.createElement('span');
    lineEl.className = 'title-line';
    lineEl.textContent = line;
    lineEl.style.fontSize = `${sizes[index]}%`;
    target.append(lineEl);
  });
};

const toMMSS = (secondsLeft) => {
  const mins = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, '0');
  const secs = Math.floor(secondsLeft % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
};

const setTimerDigits = (formattedTime) => {
  const [mins, secs] = formattedTime.split(':');
  const nextDigits = {
    m1: mins[0],
    m2: mins[1],
    s1: secs[0],
    s2: secs[1],
  };

  Object.entries(nextDigits).forEach(([key, value]) => {
    const el = digitMap[key];
    if (el.textContent === value) {
      return;
    }

    el.textContent = value;
    el.classList.remove('digit-change');
    void el.offsetWidth;
    el.classList.add('digit-change');
  });
};

const syncSelectedAudio = () => {
  selectedAudioUrl = localAudioUrl || musicPresetInput.value || null;
  updatePreviewStatus();
};

const updatePreviewStatus = () => {
  if (!selectedAudioUrl) {
    previewMusicStatus.textContent = 'No track selected.';
    previewMusicBtn.textContent = 'Preview Music';
    return;
  }

  const trackName = localAudioUrl ? 'Local upload' : musicLabelByUrl.get(selectedAudioUrl) || 'Selected track';
  const isPlaying = Boolean(previewAudio && !previewAudio.paused);
  previewMusicStatus.textContent = isPlaying ? `Previewing: ${trackName}` : `Selected: ${trackName}`;
  previewMusicBtn.textContent = isPlaying ? 'Stop Preview' : 'Preview Music';
};

const showCountdownState = () => {
  inProgressShown = false;
  countdownStage.classList.remove('hidden');
  countdownStage.hidden = false;
  inProgressStage.classList.add('hidden');
  inProgressStage.hidden = true;
};

const showInProgressState = () => {
  inProgressShown = true;
  countdownStage.classList.add('hidden');
  countdownStage.hidden = true;
  inProgressStage.classList.remove('hidden');
  inProgressStage.hidden = false;
};

const returnToConfig = async () => {
  clearInterval(timerId);
  timerId = null;
  endTime = null;
  stopBackgroundAudio();
  stopPreviewAudio();
  showCountdownState();
  waitingPanel.classList.add('hidden');
  configPanel.classList.remove('hidden');
  countdownPageTitle = 'Meeting Waiting Screen';
  document.title = countdownPageTitle;

  if (document.fullscreenElement && document.exitFullscreen) {
    try {
      await document.exitFullscreen();
    } catch (error) {
      console.warn('Exit fullscreen failed:', error);
    }
  }
};

const setTickerMessage = (message) => {
  const normalized = message.trim();
  tickerText.setAttribute('aria-label', normalized);
  tickerTrack.textContent = `${normalized} •`;
};

const stopPreviewAudio = () => {
  if (!previewAudio) {
    updatePreviewStatus();
    return;
  }
  previewAudio.pause();
  previewAudio.currentTime = 0;
  previewAudio = null;
  updatePreviewStatus();
};

const togglePreviewAudio = async () => {
  if (!selectedAudioUrl) {
    updatePreviewStatus();
    return;
  }

  if (previewAudio && !previewAudio.paused) {
    stopPreviewAudio();
    return;
  }

  stopPreviewAudio();
  const audio = new Audio(selectedAudioUrl);
  audio.volume = 0.8;
  previewAudio = audio;

  audio.addEventListener('ended', () => {
    previewAudio = null;
    updatePreviewStatus();
  });

  try {
    await audio.play();
  } catch (error) {
    console.warn('Music preview failed:', error);
    previewMusicStatus.textContent = 'Preview blocked by browser. Click page and try again.';
    previewAudio = null;
    previewMusicBtn.textContent = 'Preview Music';
    return;
  }

  updatePreviewStatus();
};

const setBarProgress = (secondsLeft) => {
  const elapsedRatio = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 1;
  barProgress.style.width = `${Math.max(0, Math.min(1, elapsedRatio)) * 100}%`;
};

const applyBackgroundAudioFade = (secondsLeft) => {
  if (!backgroundAudio) {
    return;
  }
  if (secondsLeft <= AUDIO_FADE_SECONDS) {
    const ratio = Math.max(0, secondsLeft / AUDIO_FADE_SECONDS);
    backgroundAudio.volume = BACKGROUND_AUDIO_VOLUME * ratio;
    return;
  }
  backgroundAudio.volume = BACKGROUND_AUDIO_VOLUME;
};

const setGentleVisuals = (isEnabled) => {
  gentleVisualsInput.checked = isEnabled;
  gentleVisualsWaitingInput.checked = isEnabled;
  applyVisualMode(isEnabled);
};

const updateTimer = () => {
  const now = Date.now();
  const diff = Math.max(0, Math.ceil((endTime - now) / 1000));
  const nextDisplay = toMMSS(diff);

  if (nextDisplay !== lastRenderedTime) {
    setTimerDigits(nextDisplay);
    lastRenderedTime = nextDisplay;
  }

  setBarProgress(diff);
  applyBackgroundAudioFade(diff);

  if (diff > 0 && inProgressShown) {
    showCountdownState();
  }

  if (diff > 0 && document.title !== countdownPageTitle) {
    document.title = countdownPageTitle;
  }

  if (diff <= 0) {
    clearInterval(timerId);
    timerId = null;
    lastRenderedTime = '00:00';
    showInProgressState();
    stopBackgroundAudio();
    setTickerMessage('You are live now • Meeting room should be ready • Let attendees in');
    document.title = 'Meeting in progress';
  }
};

const stopBackgroundAudio = () => {
  if (!backgroundAudio) {
    return;
  }

  backgroundAudio.pause();
  backgroundAudio.currentTime = 0;
  backgroundAudio = null;
};

const startBackgroundAudio = async () => {
  stopBackgroundAudio();
  if (!selectedAudioUrl) {
    return;
  }

  const audio = new Audio(selectedAudioUrl);
  audio.loop = true;
  audio.volume = BACKGROUND_AUDIO_VOLUME;
  backgroundAudio = audio;

  try {
    await audio.play();
  } catch (error) {
    console.warn('Audio autoplay failed:', error);
    setTickerMessage('Music could not autoplay. Click anywhere on the page to allow playback.');
  }
};

const openFullscreen = async () => {
  const el = document.documentElement;

  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    }
  } catch (error) {
    console.warn('Fullscreen request failed:', error);
  }
};

const formatEventTime = (timestamp) => {
  if (!timestamp) {
    return 'now';
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return 'now';
  }

  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const appendPresenceEvent = (event) => {
  const type = (event.type || '').toLowerCase();
  const person = event.name || event.displayName || 'Someone';
  const eventId = event.id || `${type}:${person}:${event.timestamp || Date.now()}`;

  if (knownEventIds.has(eventId)) {
    return;
  }
  knownEventIds.add(eventId);

  if (type === 'joined') {
    joinedCount += 1;
  } else if (type === 'left') {
    leftCount += 1;
  } else {
    return;
  }
  hasReceivedPresenceEvent = true;

  joinedCountEl.textContent = String(joinedCount);
  leftCountEl.textContent = String(leftCount);

  const item = document.createElement('li');
  const verb = type === 'joined' ? 'joined' : 'left';
  item.textContent = `${person} ${verb} • ${formatEventTime(event.timestamp)}`;
  presenceEvents.prepend(item);

  while (presenceEvents.childElementCount > 20) {
    presenceEvents.removeChild(presenceEvents.lastElementChild);
  }
};

const normalizeMessageEvent = (payload) => {
  if (!payload || (payload.type !== 'meet-presence-event' && payload.type !== 'meet-presence-snapshot')) {
    return [];
  }

  if (Array.isArray(payload.events)) {
    return payload.events;
  }

  if (payload.event && typeof payload.event === 'object') {
    return [payload.event];
  }

  return [];
};

const resetPresence = () => {
  joinedCount = 0;
  leftCount = 0;
  knownEventIds = new Set();
  hasReceivedPresenceEvent = false;
  joinedCountEl.textContent = '0';
  leftCountEl.textContent = '0';
  presenceEvents.textContent = '';
  presencePeople.textContent = '';
  presenceStatus.textContent = 'Waiting for Chrome extension events.';
};

const handleExtensionPresenceMessage = (messageEvent) => {
  const payload = messageEvent.data;
  if (!payload || (payload.type !== 'meet-presence-event' && payload.type !== 'meet-presence-snapshot')) {
    return;
  }

  const events = normalizeMessageEvent(payload);
  setPresenceVisibility();
  events.forEach(appendPresenceEvent);
  renderPresencePeople(payload.participants);

  if (!extensionPresenceActive) {
    extensionPresenceActive = true;
  }

  presenceStatus.textContent = 'Connected to extension events.';
};

const renderPresencePeople = (participants) => {
  if (!Array.isArray(participants)) {
    return;
  }

  const normalized = [...new Set(participants.map((name) => String(name).trim()).filter(Boolean))];
  presencePeople.textContent = '';

  if (!normalized.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No participants detected yet.';
    presencePeople.append(empty);
    return;
  }

  normalized.slice(0, 25).forEach((name) => {
    const item = document.createElement('li');
    item.textContent = name;
    presencePeople.append(item);
  });

  if (!hasReceivedPresenceEvent && joinedCount === 0 && normalized.length > 0) {
    joinedCount = normalized.length;
    joinedCountEl.textContent = String(joinedCount);
  }
};

const setPresenceVisibility = () => {
  presencePanel.classList.toggle('presence-hidden', false);

  if (!extensionPresenceActive) {
    presenceStatus.textContent =
      'Waiting for extension events. Keep Meet + waiting screen tabs open, and open the People panel in Meet.';
  }
};

const applyBackgroundTheme = (themeName) => {
  const allowedThemes = new Set(['nebula', 'sunset', 'matrix', 'frost']);
  const nextTheme = allowedThemes.has(themeName) ? themeName : 'nebula';
  document.body.dataset.bgTheme = nextTheme;
};

const applyVisualMode = (isGentle) => {
  document.body.dataset.visualMode = isGentle ? 'gentle' : 'normal';
};

const startCountdown = (meetingTitle, lineSizes, minutes, hostName, tickerMessage) => {
  const oneLineTitle = flattenTitle(meetingTitle);
  const trackName = localAudioUrl ? 'Local upload' : musicLabelByUrl.get(selectedAudioUrl) || 'No music';

  renderTitleWithSizes(waitingTitle, meetingTitle, lineSizes);
  if (hostName) {
    hostDisplay.textContent = `Hosted by ${hostName}`;
    hostDisplay.classList.remove('hidden');
  } else {
    hostDisplay.classList.add('hidden');
    hostDisplay.textContent = '';
  }

  const customTicker = tickerMessage.trim();
  setTickerMessage(customTicker || `${oneLineTitle} • Track: ${trackName}`);
  countdownPageTitle = `${oneLineTitle} · Waiting Screen`;
  document.title = countdownPageTitle;

  configPanel.classList.add('hidden');
  waitingPanel.classList.remove('hidden');

  totalSeconds = minutes * 60;
  endTime = Date.now() + totalSeconds * 1000;
  showCountdownState();

  setTimerDigits(toMMSS(totalSeconds));
  setBarProgress(totalSeconds);
  updateTimer();

  clearInterval(timerId);
  timerId = setInterval(updateTimer, 250);
  stopPreviewAudio();
  void startBackgroundAudio();
  setPresenceVisibility();

  void openFullscreen();
};


const updateTitlePreview = () => {
  renderTitleWithSizes(
    titlePreview,
    formatTitle(titleInput.value, titleFormatInput.value),
    titleLineSizesInput.value,
  );
};

titleInput.addEventListener('input', updateTitlePreview);
titleFormatInput.addEventListener('change', updateTitlePreview);
titleLineSizesInput.addEventListener('input', updateTitlePreview);
backgroundThemeInput.addEventListener('change', () => {
  applyBackgroundTheme(backgroundThemeInput.value);
});
gentleVisualsInput.addEventListener('change', () => {
  setGentleVisuals(gentleVisualsInput.checked);
});
gentleVisualsWaitingInput.addEventListener('change', () => {
  setGentleVisuals(gentleVisualsWaitingInput.checked);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const meetingTitle = formatTitle(titleInput.value, titleFormatInput.value);
  const lineSizes = titleLineSizesInput.value;
  const minutes = Number.parseInt(minutesInput.value, 10);
  const hostName = formatHost(hostInput.value);
  const tickerMessage = tickerMessageInput.value;

  if (!minutes || minutes < 1) {
    minutesInput.focus();
    return;
  }

  extensionPresenceActive = false;
  resetPresence();
  startCountdown(meetingTitle, lineSizes, minutes, hostName, tickerMessage);
});

musicPresetInput.addEventListener('change', () => {
  stopPreviewAudio();
  syncSelectedAudio();
  updateTitlePreview();
});

musicInput.addEventListener('change', () => {
  const [selectedFile] = musicInput.files || [];

  if (localAudioUrl) {
    URL.revokeObjectURL(localAudioUrl);
    localAudioUrl = null;
  }

  if (selectedFile) {
    localAudioUrl = URL.createObjectURL(selectedFile);
  }

  stopPreviewAudio();
  syncSelectedAudio();
  updateTitlePreview();
});

previewMusicBtn.addEventListener('click', () => {
  void togglePreviewAudio();
});
editConfigBtn.addEventListener('click', () => {
  void returnToConfig();
});

window.addEventListener('beforeunload', () => {
  stopBackgroundAudio();
  stopPreviewAudio();

  if (localAudioUrl) {
    URL.revokeObjectURL(localAudioUrl);
  }
});

window.addEventListener('message', handleExtensionPresenceMessage);

syncSelectedAudio();
applyBackgroundTheme(backgroundThemeInput.value);
if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  setGentleVisuals(true);
} else {
  setGentleVisuals(gentleVisualsInput.checked);
}
updateTitlePreview();
