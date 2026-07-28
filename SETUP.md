# Setup — getting The Board indexed

Do these in order. Steps 1–4 take about twenty minutes and are the whole
difference between one URL and a few hundred.

---

## 1. Add the router to `index.html`

Open `index.html`. Find the very end of your existing `<script>` block —
the last lines are the intro-animation IIFE, ending with `})();` followed by
`</script>`. Immediately **after** that closing `</script>`, paste:

```html
<script>
  ...entire contents of router-seo.js...
</script>
```

Then edit one line near the top of what you pasted:

```js
const CANONICAL_ORIGIN = "https://theboard-roanlayland.vercel.app";
```

Change it the moment you buy a domain. Nothing else in `index.html` changes.

**Test locally:** `npx serve .` then click into a player. The address bar
should read `/player/bijan-robinson`. Hit browser back — you should land on
the board. Reload on the player URL — it should open straight to that player.

---

## 2. Drop in the config files

Copy into the repo root, next to `index.html`:

```
vercel.json          clean URLs, SPA fallback, cache headers
package.json         so `npm run build` works
prerender.mjs        the build script
preview.png          social share card (1200×630)
.github/workflows/refresh.yml
```

Then uncomment the two `og:image` lines already sitting in your `<head>`:

```html
<meta property="og:image" content="https://YOURDOMAIN/preview.png">
<meta name="twitter:image" content="https://YOURDOMAIN/preview.png">
```

`preview.png` was built with DejaVu Condensed because Barlow Condensed isn't
installed here. If you want it pixel-perfect, rebuild the same layout in
Figma with Barlow Condensed at 1200×630 and overwrite the file.

---

## 3. Run the build

```bash
node prerender.mjs
```

It reads your published sheets and writes:

```
rankings/12-team-ppr.html   … 15 rankings landing pages
player/<slug>.html          … one per ranked player
deep-dives/<slug>.html      … one per article, per lane
sitemap.xml  robots.txt  feed.xml
```

Commit all of it. Vercel serves the static file on a hard load (fast, fully
crawlable) and `router-seo.js` boots the live app over the top.

Set `SITE_URL` if you're on a custom domain:

```bash
SITE_URL=https://yourdomain.com node prerender.mjs
```

---

## 4. Register with search engines

1. [Google Search Console](https://search.google.com/search-console) → add the
   property → verify by DNS or by uploading the HTML file Vercel will serve.
2. Sitemaps → submit `sitemap.xml`.
3. URL Inspection → paste your homepage → **Request indexing**. Do the same for
   two or three rankings pages. This is the fastest path to a first crawl.
4. Repeat at [Bing Webmaster Tools](https://www.bing.com/webmasters) — it takes
   about four minutes and feeds ChatGPT and Copilot search results.

---

## 5. Keep it fresh

The GitHub Action reruns the build every morning at 11:00 UTC and pushes if
anything changed, which triggers a Vercel deploy. You can also run it by hand:
**Actions → Refresh from Google Sheets → Run workflow**.

Set the repo variable `SITE_URL` (Settings → Secrets and variables → Actions →
Variables) once you have a domain.

The live board still reads the sheet directly on every page load, so your own
edits show up instantly for humans. The prerender only exists so crawlers see
current numbers too.

---

## 6. Analytics

Vercel → your project → Analytics → Enable. Then add before `</body>`:

```html
<script defer src="/_vercel/insights/script.js"></script>
```

Free tier is enough. Watch which rankings pages get impressions in Search
Console and write toward whatever is already getting them.
