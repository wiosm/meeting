# Meeting Waiting Screen

A fullscreen meeting waiting-screen web page with configurable title and countdown timer.

## Features

- Editable meeting title
- Optional host name displayed on waiting screen
- Configurable countdown in minutes (default: 5)
- Local MP3 picker (loops while countdown is running)
- Built-in Chrome extension bridge for Google Meet participant activity
- Fullscreen mode on start
- Twitch-inspired "starting soon" visual style (neon timer, live chip, ticker, progress bar)
- Static site ready for Vercel deployment

## Run locally

Since this is a static site, you can open `index.html` directly, or serve it with any local static server.

Example with Python:

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173.

## Meet join/left integration (Chrome extension only)

This page receives participant updates from the included Chrome extension via `window.postMessage`.

Expected event message:

```js
window.postMessage(
  {
    type: 'meet-presence-event',
    event: {
      id: 'evt-123',
      type: 'joined', // or 'left'
      name: 'Alex',
      timestamp: new Date().toISOString(),
    },
  },
  '*'
);
```

You can also send multiple events in one message using `events: [...]`.

Optional snapshot message (used by included extension to show current participant list):

```js
window.postMessage(
  {
    type: 'meet-presence-snapshot',
    participants: ['Alex', 'Sam'],
    timestamp: new Date().toISOString(),
  },
  '*'
);
```

## Deploy to Vercel

This project is static, so deployment is very simple.

### Option A: Vercel Dashboard (recommended)

1. Push this repository to GitHub/GitLab/Bitbucket.
2. In Vercel, click **Add New... → Project**.
3. Import this repository.
4. Keep defaults:
   - **Framework Preset**: Other
   - **Build Command**: _(empty)_
   - **Output Directory**: _(empty)_
5. Click **Deploy**.

Vercel will automatically serve `index.html` as the homepage.

### Option B: Vercel CLI

1. Install CLI:

   ```bash
   npm i -g vercel
   ```

2. From this folder, login:

   ```bash
   vercel login
   ```

3. Run first deployment:

   ```bash
   vercel
   ```

4. For production deployment:

   ```bash
   vercel --prod
   ```

### Notes

- `vercel.json` is already present and includes clean URL behavior.
- No environment variables are required for this static version.
- Every push to your connected branch can trigger an automatic redeploy.

## Included Chrome extension (Meet activity bridge)

A starter extension is included in `chrome-extension/` that attempts to detect participant join/left changes from Google Meet and forwards those events to this page using the `window.postMessage` format shown above.

### Load the extension

If your extension is published to the Chrome Web Store, users can install by opening the store page and clicking **Add to Chrome** (closest to one-click install).

For this local repo version (unpacked), Chrome requires manual loading:

1. Open Chrome and go to [`chrome://extensions`](chrome://extensions).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder's `chrome-extension` directory.

Need a quick guide link? See Chrome's official docs for unpacked installs: https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked

### Configure it

1. Click the extension icon and pin **Meet Activity Bridge**.
2. Open the popup and set your waiting-screen URL (for local use: `http://localhost:4173`).
3. Keep both tabs open:
   - a Google Meet tab (`https://meet.google.com/...`)
   - your waiting-screen page

When the extension detects participant changes, it sends events as:

```json
{
  "type": "meet-presence-event",
  "events": [
    {
      "id": "joined-Alex-...",
      "type": "joined",
      "name": "Alex",
      "timestamp": "2026-04-02T12:30:00Z"
    }
  ]
}
```

It also sends participant snapshots so the web page can show the current user list.

### Quick example: auto-update the web list when someone joins

If your goal is: **"When someone joins the current Meet, update the list on the waiting-screen web page automatically"**, this project already supports that flow.

Use this exact test:

1. Start the waiting screen (`http://localhost:4173`) and click **Start Waiting Screen**.
2. Open Google Meet in another tab and open the **People** panel.
3. Keep both tabs open at the same time.
4. Ask another person to join the Meet.
5. Within a few seconds, you should see:
   - the participant appear in the **Current in meeting** list
   - a new `joined` line in the recent events list
   - joined/left counters update

Why it works:

- `chrome-extension/content.js` reads participant names every 3 seconds.
- It sends join/left events and participant snapshots to `chrome-extension/background.js`.
- The background script forwards those messages to your waiting-screen tab.
- `script.js` receives the message and re-renders the participant list in real time.

If the list does not update, check:

- waiting-screen URL in extension popup matches your page URL origin
- Meet tab + waiting-screen tab are both open
- Meet **People** panel is open (needed for reliable detection)

### Notes and limitations

- Google Meet's internal DOM can change at any time, which may affect detection reliability.
- Meet's internal DOM changes over time; selector updates may be required in `chrome-extension/content.js`.
