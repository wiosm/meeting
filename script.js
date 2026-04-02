const form = document.getElementById('configForm');
const titleInput = document.getElementById('meetingTitle');
const minutesInput = document.getElementById('meetingMinutes');
const titleFormatInput = document.getElementById('titleFormat');
const titleLineSizesInput = document.getElementById('titleLineSizes');
const musicPresetInput = document.getElementById('meetingMusicPreset');
const musicInput = document.getElementById('meetingMusic');
const webhookUrlInput = document.getElementById('meetWebhookUrl');
const webhookTokenInput = document.getElementById('meetWebhookToken');
const titlePreview = document.getElementById('titlePreview');
const waitingTitle = document.getElementById('meetingTitleDisplay');
const countdownDisplay = document.getElementById('countdownDisplay');
const barProgress = document.getElementById('barProgress');
const configPanel = document.getElementById('configPanel');
const waitingPanel = document.getElementById('waitingPanel');
const tickerText = document.getElementById('tickerText');
const presenceStatus = document.getElementById('presenceStatus');
const presenceEvents = document.getElementById('presenceEvents');
const joinedCountEl = document.getElementById('joinedCount');
const leftCountEl = document.getElementById('leftCount');
const presencePanel = document.getElementById('presencePanel');

const digitMap = {
  m1: countdownDisplay.querySelector('[data-digit="m1"]'),
  m2: countdownDisplay.querySelector('[data-digit="m2"]'),
  s1: countdownDisplay.querySelector('[data-digit="s1"]'),
  s2: countdownDisplay.querySelector('[data-digit="s2"]'),
};

let totalSeconds = 5 * 60;
let endTime = null;
let timerId = null;
let lastRenderedTime = '05:00';
let selectedAudioUrl = null;
let localAudioUrl = null;
let backgroundAudio = null;
let joinedCount = 0;
let leftCount = 0;
let knownEventIds = new Set();
let webhookPollId = null;
let extensionPresenceActive = false;

const formatTitle = (rawTitle, format) => {
  const normalized = rawTitle
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

  if (!normalized) {
    return 'Meeting Starts Soon';
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
  const safeLines = lines.length ? lines : ['Meeting Starts Soon'];
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
};

const setBarProgress = (secondsLeft) => {
  const elapsedRatio = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 1;
  barProgress.style.width = `${Math.max(0, Math.min(1, elapsedRatio)) * 100}%`;
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

  if (diff <= 0) {
    clearInterval(timerId);
    timerId = null;
    lastRenderedTime = '00:00';
    setTimerDigits('00:00');
    stopBackgroundAudio();
    tickerText.textContent = 'You are live now • Meeting room should be ready • Let attendees in';
    document.title = 'Meeting should begin now';
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
  audio.volume = 0.8;
  backgroundAudio = audio;

  try {
    await audio.play();
  } catch (error) {
    console.warn('Audio autoplay failed:', error);
    tickerText.textContent =
      'Music could not autoplay. Click anywhere on the page to allow playback.';
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

const normalizeEvents = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.events)) {
    return payload.events;
  }

  return [];
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
  if (!payload || payload.type !== 'meet-presence-event') {
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
  joinedCountEl.textContent = '0';
  leftCountEl.textContent = '0';
  presenceEvents.textContent = '';
  presenceStatus.textContent = 'Waiting for extension or webhook events.';
};

const stopWebhookPolling = () => {
  if (!webhookPollId) {
    return;
  }

  clearInterval(webhookPollId);
  webhookPollId = null;
};

const handleExtensionPresenceMessage = (messageEvent) => {
  const events = normalizeMessageEvent(messageEvent.data);
  if (!events.length) {
    return;
  }

  setPresenceVisibility('extension');
  events.forEach(appendPresenceEvent);

  if (!extensionPresenceActive) {
    extensionPresenceActive = true;
  }

  presenceStatus.textContent = `Receiving extension events • Last update ${formatEventTime(new Date())}`;
};

const setPresenceVisibility = (url) => {
  const hasWebhookUrl = Boolean(url);
  presencePanel.classList.toggle('presence-hidden', false);

  if (!hasWebhookUrl && !extensionPresenceActive) {
    presenceStatus.textContent = 'Waiting for extension events. Keep Meet + waiting screen tabs open.';
  }
};

const fetchWebhookEvents = async (url, token) => {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Feed request failed with ${response.status}`);
  }

  const payload = await response.json();
  const events = normalizeEvents(payload);
  events.forEach(appendPresenceEvent);

  presenceStatus.textContent = `Connected to feed • Last checked ${formatEventTime(new Date())}`;
};

const startWebhookPolling = (url, token) => {
  stopWebhookPolling();
  setPresenceVisibility(url);

  if (!url) {
    presenceStatus.textContent = 'Waiting for extension events. Keep Meet + waiting screen tabs open.';
    return;
  }

  presenceStatus.textContent = 'Connecting to event feed...';

  const runFetch = async () => {
    try {
      await fetchWebhookEvents(url, token);
    } catch (error) {
      console.warn('Event feed error:', error);
      presenceStatus.textContent =
        'Feed connection failed. Check URL/token or backend availability.';
    }
  };

  void runFetch();
  webhookPollId = setInterval(() => {
    void runFetch();
  }, 5000);
};

const startCountdown = (meetingTitle, lineSizes, minutes, webhookUrl, webhookToken) => {
  const oneLineTitle = flattenTitle(meetingTitle);

  renderTitleWithSizes(waitingTitle, meetingTitle, lineSizes);
  tickerText.textContent = `${oneLineTitle} • Audio check • Camera check • Screen share ready`;
  document.title = `${oneLineTitle} · Waiting Screen`;

  configPanel.classList.add('hidden');
  waitingPanel.classList.remove('hidden');

  totalSeconds = minutes * 60;
  endTime = Date.now() + totalSeconds * 1000;

  setTimerDigits(toMMSS(totalSeconds));
  setBarProgress(totalSeconds);
  updateTimer();

  clearInterval(timerId);
  timerId = setInterval(updateTimer, 250);
  void startBackgroundAudio();
  startWebhookPolling(webhookUrl, webhookToken);

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

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const meetingTitle = formatTitle(titleInput.value, titleFormatInput.value);
  const lineSizes = titleLineSizesInput.value;
  const minutes = Number.parseInt(minutesInput.value, 10);
  const webhookUrl = webhookUrlInput.value.trim();
  const webhookToken = webhookTokenInput.value.trim();

  if (!minutes || minutes < 1) {
    minutesInput.focus();
    return;
  }

  extensionPresenceActive = false;
  resetPresence();
  startCountdown(meetingTitle, lineSizes, minutes, webhookUrl, webhookToken);
});

musicPresetInput.addEventListener('change', () => {
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

  syncSelectedAudio();
  updateTitlePreview();
});

window.addEventListener('beforeunload', () => {
  stopWebhookPolling();
  stopBackgroundAudio();

  if (localAudioUrl) {
    URL.revokeObjectURL(localAudioUrl);
  }
});

window.addEventListener('message', handleExtensionPresenceMessage);

syncSelectedAudio();
updateTitlePreview();
