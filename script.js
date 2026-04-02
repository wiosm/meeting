const form = document.getElementById('configForm');
const titleInput = document.getElementById('meetingTitle');
const minutesInput = document.getElementById('meetingMinutes');
const titlePreview = document.getElementById('titlePreview');
const waitingTitle = document.getElementById('meetingTitleDisplay');
const countdownDisplay = document.getElementById('countdownDisplay');
const ringProgress = document.getElementById('ringProgress');
const configPanel = document.getElementById('configPanel');
const waitingPanel = document.getElementById('waitingPanel');
const resetBtn = document.getElementById('resetBtn');

const digitMap = {
  m1: countdownDisplay.querySelector('[data-digit="m1"]'),
  m2: countdownDisplay.querySelector('[data-digit="m2"]'),
  s1: countdownDisplay.querySelector('[data-digit="s1"]'),
  s2: countdownDisplay.querySelector('[data-digit="s2"]'),
};

const RING_RADIUS = 102;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

let totalSeconds = 5 * 60;
let endTime = null;
let timerId = null;
let lastRenderedTime = '05:00';

ringProgress.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
ringProgress.style.strokeDashoffset = '0';

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

const setRingProgress = (secondsLeft) => {
  const ratio = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, ratio)));
  ringProgress.style.strokeDashoffset = dashOffset.toString();
};

const updateTimer = () => {
  const now = Date.now();
  const diff = Math.max(0, Math.ceil((endTime - now) / 1000));
  const nextDisplay = toMMSS(diff);

  if (nextDisplay !== lastRenderedTime) {
    setTimerDigits(nextDisplay);
    lastRenderedTime = nextDisplay;
  }

  setRingProgress(diff);

  if (diff <= 0) {
    clearInterval(timerId);
    timerId = null;
    lastRenderedTime = '00:00';
    setTimerDigits('00:00');
    document.title = 'Meeting should begin now';
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
  document.title = `${meetingTitle} · Waiting Screen`;

  configPanel.classList.add('hidden');
  waitingPanel.classList.remove('hidden');

  totalSeconds = minutes * 60;
  endTime = Date.now() + totalSeconds * 1000;

  setTimerDigits(toMMSS(totalSeconds));
  setRingProgress(totalSeconds);
  updateTimer();

  clearInterval(timerId);
  timerId = setInterval(updateTimer, 250);

  void openFullscreen();
};

const reset = () => {
  clearInterval(timerId);
  timerId = null;
  totalSeconds = 5 * 60;

  configPanel.classList.remove('hidden');
  waitingPanel.classList.add('hidden');

  setTimerDigits('05:00');
  setRingProgress(totalSeconds);
  lastRenderedTime = '05:00';
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

resetBtn.addEventListener('click', reset);
