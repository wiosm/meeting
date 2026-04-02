const DEFAULT_TARGET_URL = 'http://localhost:4173';

chrome.runtime.onInstalled.addListener(async () => {
  const { targetUrl } = await chrome.storage.sync.get({ targetUrl: DEFAULT_TARGET_URL });
  if (!targetUrl) {
    await chrome.storage.sync.set({ targetUrl: DEFAULT_TARGET_URL });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'meet-events' && Array.isArray(message.events)) {
    forwardMeetEvents(message.events)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'meet-snapshot' && Array.isArray(message.participants)) {
    forwardMeetSnapshot(message.participants, message.timestamp)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'get-target-url') {
    chrome.storage.sync
      .get({ targetUrl: DEFAULT_TARGET_URL })
      .then(({ targetUrl }) => sendResponse({ ok: true, targetUrl }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'set-target-url' && typeof message.targetUrl === 'string') {
    chrome.storage.sync
      .set({ targetUrl: message.targetUrl.trim() || DEFAULT_TARGET_URL })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function forwardMeetEvents(events) {
  const { targetUrl } = await chrome.storage.sync.get({ targetUrl: DEFAULT_TARGET_URL });
  const targetOrigin = new URL(targetUrl).origin;
  const tabs = await chrome.tabs.query({});

  const targetTabs = tabs.filter((tab) => {
    if (!tab.url) {
      return false;
    }

    try {
      return new URL(tab.url).origin === targetOrigin;
    } catch {
      return false;
    }
  });

  if (!targetTabs.length) {
    return {
      ok: false,
      error: `No open tab found for ${targetOrigin}. Open your waiting screen first.`,
    };
  }

  const payload = {
    type: 'meet-presence-event',
    events,
  };

  await Promise.all(
    targetTabs.map((tab) =>
      chrome.tabs.sendMessage(tab.id, {
        type: 'inject-window-post-message',
        payload,
        targetOrigin,
      })
    )
  );

  return { ok: true, deliveredToTabs: targetTabs.length, eventCount: events.length };
}

async function forwardMeetSnapshot(participants, timestamp) {
  const { targetUrl } = await chrome.storage.sync.get({ targetUrl: DEFAULT_TARGET_URL });
  const targetOrigin = new URL(targetUrl).origin;
  const tabs = await chrome.tabs.query({});

  const targetTabs = tabs.filter((tab) => {
    if (!tab.url) {
      return false;
    }

    try {
      return new URL(tab.url).origin === targetOrigin;
    } catch {
      return false;
    }
  });

  if (!targetTabs.length) {
    return {
      ok: false,
      error: `No open tab found for ${targetOrigin}. Open your waiting screen first.`,
    };
  }

  const payload = {
    type: 'meet-presence-snapshot',
    participants,
    timestamp,
  };

  await Promise.all(
    targetTabs.map((tab) =>
      chrome.tabs.sendMessage(tab.id, {
        type: 'inject-window-post-message',
        payload,
        targetOrigin,
      })
    )
  );

  return { ok: true, deliveredToTabs: targetTabs.length, participantCount: participants.length };
}
