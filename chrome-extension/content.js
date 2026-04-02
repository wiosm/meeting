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
  let previousSet = new Set();

  const poll = () => {
    const currentNames = readParticipantNames();
    if (!currentNames.length) {
      return;
    }

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
  const selectors = [
    '[data-participant-id][aria-label]',
    '[data-self-name]',
    '[role="listitem"] [aria-label]',
  ];

  const names = selectors.flatMap((selector) =>
    Array.from(document.querySelectorAll(selector))
      .map((el) =>
        normalizeParticipantName(
          el.getAttribute('data-self-name') || el.getAttribute('aria-label') || ''
        )
      )
      .filter(Boolean)
  );

  return [...new Set(names)].slice(0, 100);
}

function normalizeParticipantName(value) {
  const clean = value
    .replace(/\(You\)/gi, '')
    .replace(/\bMuted\b/gi, '')
    .replace(/\bUnmuted\b/gi, '')
    .replace(/\bPresenter\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean || clean.length > 80) {
    return '';
  }

  if (/^(meeting details|people|activities|settings|search)$/i.test(clean)) {
    return '';
  }

  return clean;
}
