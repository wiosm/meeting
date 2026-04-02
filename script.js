const form = document.getElementById('configForm');
const titleInput = document.getElementById('meetingTitle');
const minutesInput = document.getElementById('meetingMinutes');
const titlePreview = document.getElementById('titlePreview');
const waitingTitle = document.getElementById('meetingTitleDisplay');
const countdownDisplay = document.getElementById('countdownDisplay');
const configPanel = document.getElementById('configPanel');
const waitingPanel = document.getElementById('waitingPanel');
const resetBtn = document.getElementById('resetBtn');

let endTime = null;
let timerId = null;

const toMMSS = (secondsLeft) => {
  const mins = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, '0');
  const secs = Math.floor(secondsLeft % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
};

const updateTimer = () => {
  const now = Date.now();
  const diff = Math.max(0, Math.ceil((endTime - now) / 1000));
  countdownDisplay.textContent = toMMSS(diff);

  if (diff <= 0) {
    clearInterval(timerId);
    timerId = null;
    countdownDisplay.textContent = '00:00';
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

  endTime = Date.now() + minutes * 60 * 1000;
  updateTimer();

  clearInterval(timerId);
  timerId = setInterval(updateTimer, 250);

  void openFullscreen();
};

const reset = () => {
  clearInterval(timerId);
  timerId = null;
  configPanel.classList.remove('hidden');
  waitingPanel.classList.add('hidden');
  countdownDisplay.textContent = '05:00';
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
