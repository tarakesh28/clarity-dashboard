# Signal — your personal models/day/habits site

Plain HTML/CSS/JS. No build step, no dependencies to install, no database.

**This is live on GitHub Pages right now** — that's the real app, the one actually used day to day, not a future plan. Everything under "Testing changes on your phone" below is for previewing an edit on your phone before pushing it live; it isn't how you host or use the app.

## Files
- `index.html` / `app.js` — the "Today" page: pinned mental models, day list, habit (with backward day-nav), Notes
- `models.html` — mental models library: add new, pin up to 2, unpin all
- `model.html` — one mental model's detail page: notes feed, pin toggle, delete
- `habits.html` / `habits-list.js` — every habit with streak/days-done/last-logged/total-time insights
- `habit.html` / `habit-detail.js` — one habit's detail page: backward day log, edit, month/year views, day-detail modal
- `journal.html` / `journal.js` — every daily note as a simple preview card, newest first
- `models-data.js` — the two seed mental models (only read once, to seed storage the first time)
- `emoji-data.js` — icon picker choices (icon field also takes free typed/pasted text, 0–3 chars)
- `nav.js` — shared sidebar, injected on every page; collapse-to-icons toggle
- `styles.css` — all visual design
- `data.js` — storage layer: local storage, recurring-task engine, journal, backup export/import
- `assets/` — mental-model images, sound effects, self-hosted fonts (`assets/fonts/`), and the app icon (`assets/icons/`)
- `manifest.json` — lets phones install this as a standalone app instead of a browser bookmark
- `serve.json` — config for `npx serve` only, disables a default behavior that was breaking local testing (see testing section below); irrelevant to GitHub Pages, which doesn't read it

## Hosting (already set up)
This is how the live site above is actually configured — kept here for reference, e.g. if you ever need to redeploy, move to a new repo, or set this up again from scratch:
1. Create a repository. If this is personal data, decide deliberately: a **public** repo means anyone with the link can view it; a **private** repo's Pages site is normally only viewable signed into that GitHub account (or may not publish at all, depending on plan).
2. Upload everything here, keeping `assets/` as a folder.
3. **Settings → Pages** → source = `main` branch, root. Save.
4. The site is at `https://yourusername.github.io/reponame/`.
5. To push an update: replace the changed files in the repo (or push via git) — GitHub Pages picks it up automatically, usually within a minute or so.
6. On the phone: open that URL in Safari → Share → Add to Home Screen. It launches full-screen with no browser chrome, like a real app icon — no App Store step, and updating just means reopening the app after step 5, no re-adding the icon.

The *code* here is reachable by anyone who has or guesses the exact link; your *data* still isn't — it never leaves your phone/laptop's own local storage, nothing is transmitted to or read by GitHub. That's "private" in the sense that matters for your actual entries, just not a secret address. Safari normally clears a site's local storage after 7 days of no visits, but a Home Screen–installed site is exempted from that specific timer and gets its own usage-based allowance instead, so daily use keeps it well clear of any cleanup.

## How your data works (Tier 0 + Tier 1)
- Everything lives in your browser's local storage.
- **Download backup** saves everything — day list, habits, journal, mental models (including any images you added, stored as embedded image data) — as one `.json` file.
- **Restore from backup** merges by record, never blindly overwrites, and auto-downloads a safety backup of your current state first.
- Tier 2 (auto-sync through your own GitHub repo) is still intentionally not built.

## Known, deliberate limits
- Mental model images you add are stored as embedded data — fine for a personal handful, but very large or very many images could approach the browser's storage limit.
- Local storage is **per-origin** — the GitHub Pages URL, a `npx serve` LAN address, and `localhost` are all separate storage buckets that don't share data automatically, even though they're all "this app." Switching hosts means starting fresh there unless you **Download backup** on the old one and **Restore from backup** on the new one. See the testing section below for what this means for local testing specifically.

## Testing changes on your phone before pushing to GitHub Pages
No files needed for this — `npx` fetches and runs `serve` on demand each time, nothing gets installed into the project (no `package.json`, no `node_modules`, nothing to add to a `.gitignore`).

1. From this folder: `npx serve`.
2. It prints two URLs — a `localhost` one (for your laptop) and an **"On Your Network"** one like `http://192.168.1.23:3000` — that second one is what your phone needs, since "localhost" on your phone would mean the phone itself, not your laptop.
3. Phone and laptop need to be on the **same Wi-Fi**. Open that network URL in Safari on the phone.
4. Stop it any time with Ctrl+C — nothing was installed, nothing left behind.

**One limit worth knowing:** actually installing as a standalone home-screen app (the manifest/PWA behavior) generally needs a real secure context — plain "localhost" counts, but a LAN address like `192.168.1.23` typically doesn't in Chrome/Safari. Everyday testing (layout, buttons, saving data) all works fine over the LAN URL; for confirming the *install-as-standalone-app* behavior specifically, that still needs the real GitHub Pages HTTPS link.

**Another limit worth knowing, now actually solved:** a habit or mental model's detail page (`habit.html?id=...`, `model.html?slug=...`) used to report "not found" under `npx serve`, even for something created in that exact same session. Root cause: `serve` has a default behavior called `cleanUrls` that redirects any `.html` URL to its extension-less form (`habit.html` → `/habit`) — and when the original URL had a query string, that redirect drops the query string along with the extension, landing on `/habit` with no `id` at all. Nothing wrong in the app's own links; this was `serve` itself rewriting the URL before the page ever got a chance to read it. Fixed via `serve.json` in this folder — turning `cleanUrls` off directly (`"cleanUrls": false`) stops that specific redirect, but `cleanUrls` also happens to control *two* things at once in `serve`'s handler: turning it off also stopped `/` from automatically finding `index.html` (visiting the site's root then shows a plain file listing instead), and stopped any other bare, extension-less URL (an old bookmark or browser-history entry saved from before this fix, back when that's exactly what the broken redirect used to produce) from resolving at all. `serve.json`'s `rewrites` list handles both explicitly — `/` and every bare page name are mapped straight to their real `.html` file — so nothing needs `cleanUrls` turned back on to work. `npx serve` picks all of this up automatically, no flag needed. GitHub Pages doesn't do any of this kind of redirect/rewriting and never did, so the live site was never affected by any part of it.

