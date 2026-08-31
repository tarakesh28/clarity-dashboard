# Signal — your personal models/day/habits site

Plain HTML/CSS/JS. No build step, no dependencies to install, no database.

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
- `assets/` — the two original cropped mental-model images

## Hosting it on GitHub Pages (free)
1. Create a repository. If this is personal data, decide deliberately: a **public** repo means anyone with the link can view it; a **private** repo's Pages site is normally only viewable signed into that GitHub account (or may not publish at all, depending on plan).
2. Upload everything here, keeping `assets/` as a folder.
3. **Settings → Pages** → source = `main` branch, root. Save.
4. Your site is at `https://yourusername.github.io/reponame/`.

## How your data works (Tier 0 + Tier 1)
- Everything lives in your browser's local storage.
- **Download backup** saves everything — day list, habits, journal, mental models (including any images you added, stored as embedded image data) — as one `.json` file.
- **Restore from backup** merges by record, never blindly overwrites, and auto-downloads a safety backup of your current state first.
- Tier 2 (auto-sync through your own GitHub repo) is still intentionally not built.

## Known, deliberate limits
- Mental model images you add are stored as embedded data — fine for a personal handful, but very large or very many images could approach the browser's storage limit.
- Fonts are still loaded from Google's CDN (`styles.css`'s `@import`), so the site isn't fully offline yet.

## Running this on an iPhone, privately, for free
This is a static site with no server-side code — everything (day list, habits, journal, models) lives in **that browser's** local storage, never sent anywhere. That gives you two honest routes, depending on how "private" you want to be:

**Option A — a public URL, private data.** GitHub Pages (see above) or dragging the folder onto Netlify Drop (app.netlify.com/drop) both give you a free HTTPS URL in seconds. The *code* is reachable by anyone who has or guesses the exact link; your *data* still isn't — it never leaves your phone/laptop's own local storage, nothing is transmitted to GitHub/Netlify or read by them. This is "private" in the sense that matters for your actual entries, just not a secret address.
- Add it to your Home Screen: open the URL in Safari → Share → Add to Home Screen. It launches full-screen with no browser chrome, like a real app icon.
- Updates: whenever files change, upload them to the same repo/Netlify site, then just reopen the app on your phone — no App Store step, no re-adding the icon.

**Option B — nothing public at all.** Run a plain local web server on your laptop (e.g. `python3 -m http.server` from this folder) and reach it from your phone over **Tailscale** (free for personal use, one device-to-device private network — no public URL ever exists, not even an obscure one). Trade-off: your laptop has to be on and the server running for the phone to reach it.

**Storage persistence either way:** Safari normally clears a site's local storage after 7 days of no visits — but a site you've added to the Home Screen is exempted from that specific timer and gets its own usage-based allowance instead, so daily use keeps it well clear of any cleanup.

**Either option:** data is tied to that specific URL's storage — switching hosts (or from Option A to B) means starting fresh there unless you **Download backup** on the old one and **Restore from backup** on the new one.
