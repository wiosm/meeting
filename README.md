# Meeting Waiting Screen

A fullscreen meeting waiting-screen web page with configurable title and countdown timer.

## Features

- Editable meeting title
- Configurable countdown in minutes (default: 5)
- Local MP3 picker (loops while countdown is running)
- Optional Meet event feed URL + token fields (for webhook relay integration)
- In-page Google Workspace token setup guide (expandable help section)
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

## Meet join/left feed integration

This page can show participant activity if you provide a backend feed URL.

It can also receive events directly from a Chrome extension via `window.postMessage`.

### Why backend is required

Google Meet event delivery is typically handled server-side (for example via Google Workspace Events + Pub/Sub + your backend), then your backend exposes a safe endpoint for this webpage.

### Expected feed response

Set **Meet event feed URL** in setup, and return either:

```json
[
  { "id": "evt-1", "type": "joined", "name": "Alex", "timestamp": "2026-04-02T12:30:00Z" },
  { "id": "evt-2", "type": "left", "name": "Sam", "timestamp": "2026-04-02T12:32:00Z" }
]
```

or:

```json
{
  "events": [
    { "id": "evt-1", "type": "joined", "name": "Alex", "timestamp": "2026-04-02T12:30:00Z" }
  ]
}
```

Notes:
- `type` must be `joined` or `left`.
- Events are polled every 5 seconds.
- Endpoint must allow browser CORS.

### Optional Chrome extension bridge

If you already have (or build) a Chrome extension that detects Google Meet attendance changes, it can send events to this page with:

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

### Notes and limitations

- Google Meet's internal DOM can change at any time, which may affect detection reliability.
- For production-grade accuracy, prefer the backend/webhook approach described earlier.
