const shouldTrackMeet = location.hostname === 'meet.google.com';

bootstrapMeetBridge();

function bootstrapMeetBridge() {
  if (window.__meetAttendanceBridgeInitialized) {
    return;
  }

  window.__meetAttendanceBridgeInitialized = true;
  registerRuntimeMessageBridge();

  if (shouldTrackMeet) {
    startMeetActivityTracker();
  }
}

function registerRuntimeMessageBridge() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'inject-window-post-message') {
      window.postMessage(message.payload, message.targetOrigin || '*');
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });
}

function isRuntimeAvailable() {
  return Boolean(chrome?.runtime?.id);
}

function sendMessageSafely(payload) {
  if (!isRuntimeAvailable()) {
    return false;
  }

  chrome.runtime.sendMessage(payload, () => {
    void chrome.runtime.lastError;
  });

  return true;
}

function startMeetActivityTracker() {
  if (window.__meetAttendanceTrackerStarted) {
    return;
  }
  window.__meetAttendanceTrackerStarted = true;

  let previousSet = new Set();

  const poll = () => {
    if (!isRuntimeAvailable()) {
      clearInterval(intervalId);
      return;
    }

    const currentNames = readParticipantNames();
    const currentSet = new Set(currentNames);
    const joined = currentNames.filter((name) => !previousSet.has(name));
    const left = [...previousSet].filter((name) => !currentSet.has(name));

    if (joined.length || left.length) {
      const now = new Date().toISOString();
      const events = [
        ...joined.map((name) => ({
          id: `joined-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: 'joined',
          name,
          timestamp: now,
        })),
        ...left.map((name) => ({
          id: `left-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: 'left',
          name,
          timestamp: now,
        })),
      ];

      sendMessageSafely({ type: 'meet-events', events });
    }

    sendMessageSafely({
      type: 'meet-snapshot',
      participants: currentNames,
      timestamp: new Date().toISOString(),
    });

    previousSet = currentSet;
  };

  const intervalId = setInterval(poll, 3000);
  setTimeout(poll, 1500);
}

function readParticipantNames() {
  const selectorGroups = [
    '[data-participant-id][aria-label]',
    '[data-participant-id][data-participant-name]',
    '[data-participant-id][data-name]',
    '[data-self-name]',
    '[role="listitem"] [aria-label]',
    '[data-participant-id] [data-name]',
    '[data-participant-id] [data-participant-name]',
    '[role="listitem"] [data-name]',
    '[data-participant-id] [dir="auto"]',
    '[role="listitem"] [dir="auto"]',
    '[role="listitem"] [data-participant-id] [dir="auto"]',
  ];

  const names = selectorGroups.flatMap((selector) => {
    return Array.from(document.querySelectorAll(selector))
      .map((el) => readNameFromElement(el))
      .filter(Boolean);
  });

  const inferredSelfNames = inferSelfNamesFromMeetUi();
  const accountChipName = readSelfNameFromAccountChip();

  return [...new Set([...names, ...inferredSelfNames, accountChipName])].filter(Boolean).slice(0, 100);
}

function readNameFromElement(el) {
  const raw =
    el.getAttribute('data-participant-name') ||
    el.getAttribute('data-name') ||
    el.getAttribute('data-self-name') ||
    el.getAttribute('title') ||
    el.getAttribute('aria-label') ||
    el.textContent ||
    '';

  return normalizeParticipantName(extractPrimaryDisplayName(raw));
}

function extractPrimaryDisplayName(value) {
  return String(value).split(/[\n,]/)[0].trim();
}

function normalizeParticipantName(value) {
  const clean = String(value)
    .replace(/\((you|tu|vous)\)/gi, '')
    .replace(/\b(you|tu|vous)\b/gi, '')
    .replace(/\bMuted\b/gi, '')
    .replace(/\bUnmuted\b/gi, '')
    .replace(/\bPresenter\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/[,:\-•]+$/g, '')
    .trim();

  if (!clean || clean.length > 80) {
    return '';
  }

  if (isNonParticipantLabel(clean)) {
    return '';
  }

  return clean;
}

function isNonParticipantLabel(value) {
  const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();

  const exactUiLabels = new Set([
    'meeting details',
    'people',
    'activities',
    'settings',
    'search',
    'chat',
    'raise hand',
    'google meet',
    'more options',
    'more actions',
    'present now',
    'no participants detected yet.',
    'welcome to',
  ]);

  if (exactUiLabels.has(normalized)) {
    return true;
  }

  if (/(joined|left)\s*[•·-]\s*\d{1,2}:\d{2}/i.test(normalized)) {
    return true;
  }

  if (/\b(joined|left)\s*[•·-]\s*\d{1,2}:\d{2}(?::\d{2})?(\s*[ap]m)?\b/i.test(normalized)) {
    return true;
  }

  if (/can't unmute someone else/i.test(normalized)) {
    return true;
  }

  if (/^your microphone is turned (off|on)\.?$/i.test(normalized)) {
    return true;
  }

  if (/^(host controls|meeting host|captions|reactions|breakout rooms)$/i.test(normalized)) {
    return true;
  }

  return false;
}

function extractNameFromAriaLabel(value) {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  const youPatterns = [/\(You\)/i, /\bYou\b/i, /\(Tu\)/i, /\bTú\b/i, /\(Vous\)/i];

  if (!youPatterns.some((pattern) => pattern.test(trimmed))) {
    return '';
  }

  const stripped = trimmed
    .replace(/\(You\)/gi, '')
    .replace(/\bYou\b/gi, '')
    .replace(/\(Tu\)/gi, '')
    .replace(/\bTú\b/gi, '')
    .replace(/\(Vous\)/gi, '')
    .replace(/,\s*$/g, '')
    .trim();

  return normalizeParticipantName(stripped);
}

function inferSelfNamesFromMeetUi() {
  const ariaSelectors = [
    '[data-participant-id][aria-label]',
    '[role="listitem"] [aria-label]',
    '[aria-label*="(You)"]',
    '[aria-label*=" You"]',
    '[aria-label*="(Tu)"]',
    '[aria-label*="(Vous)"]',
  ];

  const inferred = ariaSelectors.flatMap((selector) =>
    Array.from(document.querySelectorAll(selector)).map((el) =>
      extractNameFromAriaLabel(el.getAttribute('aria-label') || '')
    )
  );

  return inferred.filter(Boolean);
}

function readSelfNameFromAccountChip() {
  const accountButton = document.querySelector('a[aria-label*="Google Account"], button[aria-label*="Google Account"]');
  if (!accountButton) {
    return '';
  }

  const label = accountButton.getAttribute('aria-label') || '';
  const matched = label.match(/Google Account[:\s]+(.+)/i);
  if (!matched?.[1]) {
    return '';
  }

  return normalizeParticipantName(matched[1]);
}
