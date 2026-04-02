if (location.hostname === 'meet.google.com') {
  startMeetActivityTracker();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'inject-window-post-message') {
    window.postMessage(message.payload, message.targetOrigin || '*');
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

function startMeetActivityTracker() {
  if (window.__meetAttendanceTrackerStarted) {
    return;
  }
  window.__meetAttendanceTrackerStarted = true;

  let previousSet = new Set();

  const poll = () => {
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

      chrome.runtime.sendMessage({ type: 'meet-events', events }, () => {
        void chrome.runtime.lastError;
      });
    }

    chrome.runtime.sendMessage(
      { type: 'meet-snapshot', participants: currentNames, timestamp: new Date().toISOString() },
      () => {
        void chrome.runtime.lastError;
      }
    );

    previousSet = currentSet;
  };

  setInterval(poll, 3000);
  setTimeout(poll, 1500);
}

function readParticipantNames() {
  const selectorGroups = [
    '[data-participant-id][aria-label]',
    '[data-self-name]',
    '[role="listitem"] [aria-label]',
    '[data-participant-id] [data-name]',
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
    el.getAttribute('data-name') ||
    el.getAttribute('data-self-name') ||
    el.getAttribute('aria-label') ||
    el.textContent ||
    '';

  return normalizeParticipantName(raw);
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

  if (/^(meeting details|people|activities|settings|search|chat|raise hand)$/i.test(clean)) {
    return '';
  }

  return clean;
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
