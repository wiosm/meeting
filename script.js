const form = document.getElementById('configForm');
const titleInput = document.getElementById('meetingTitle');
const minutesInput = document.getElementById('meetingMinutes');
const musicInput = document.getElementById('meetingMusic');
const titlePreview = document.getElementById('titlePreview');
const waitingTitle = document.getElementById('meetingTitleDisplay');
const countdownDisplay = document.getElementById('countdownDisplay');
const barProgress = document.getElementById('barProgress');
const configPanel = document.getElementById('configPanel');
const waitingPanel = document.getElementById('waitingPanel');
const resetBtn = document.getElementById('resetBtn');
const tickerText = document.getElementById('tickerText');

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
let backgroundAudio = null;

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

const startCountdown = (meetingTitle, minutes) => {
  waitingTitle.textContent = meetingTitle;
  tickerText.textContent = `${meetingTitle} • Audio check • Camera check • Screen share ready`;
  document.title = `${meetingTitle} · Waiting Screen`;

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

  void openFullscreen();
};

const reset = () => {
  clearInterval(timerId);
  timerId = null;
  totalSeconds = 5 * 60;
  stopBackgroundAudio();

  configPanel.classList.remove('hidden');
  waitingPanel.classList.add('hidden');

  setTimerDigits('05:00');
  setBarProgress(totalSeconds);
  lastRenderedTime = '05:00';
  tickerText.textContent =
    'Stream intro mode active • Audio check • Camera check • Screen share ready';
  document.title = 'Meeting Waiting Screen';
};

titleInput.addEventListener('input', () => {
  titlePreview.textContent = titleInput.value.trim() || 'Meeting Starts Soon';
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const meetingTitle = titleInput.value.trim() || 'Meeting Starts Soon';
  const minutes = Number.parseInt(minutesInput.value, 10);

  if (!minutes || minutes < 1) {
    minutesInput.focus();
    return;
  }

  startCountdown(meetingTitle, minutes);
});

musicInput.addEventListener('change', () => {
  const [selectedFile] = musicInput.files || [];

  if (selectedAudioUrl) {
    URL.revokeObjectURL(selectedAudioUrl);
    selectedAudioUrl = null;
  }

  if (!selectedFile) {
    return;
  }

  selectedAudioUrl = URL.createObjectURL(selectedFile);
});

resetBtn.addEventListener('click', reset);

window.addEventListener('beforeunload', () => {
  stopBackgroundAudio();
  if (selectedAudioUrl) {
    URL.revokeObjectURL(selectedAudioUrl);
  }
});
