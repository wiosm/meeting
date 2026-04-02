# Meeting Waiting Screen

A fancy fullscreen waiting-screen web page for meetings with configurable title and countdown timer.

## Features

- Editable meeting title
- Configurable countdown in minutes (default: 5)
- Fullscreen mode on start
- Glassmorphism + animated aurora style UI
- Static site ready for Vercel deployment

## Run locally

Since this is a static site, you can open `index.html` directly, or serve it with any local static server.

Example with Python:

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173.

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repository in Vercel.
3. Deploy using default settings (no build command required).

Vercel will serve `index.html` as the entry page.
