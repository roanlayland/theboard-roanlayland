/* ==========================================================================
   THE BOARD — router + SEO layer   v3
   --------------------------------------------------------------------------
   HOW TO INSTALL
   Paste this entire block inside a SECOND <script> tag, immediately before
   </body> in index.html — i.e. directly after your existing script. It patches
   the app in place, so you don't have to change a single line above it.

       <script>
         ... your existing app ...
       </script>

       <script>
         ... this file ...
       </script>
     </body>

   WHAT IT ADDS
     • A real URL for every view:
         /                                  overall board
         /rankings/wr                       position board
         /rankings/12-team-half-ppr         a scoring/size preset
         /player/bijan-robinson             player profile
         /values/nabers-value               an article
         /trade-analyzer  /draft-room       tools
     • Working browser back/forward buttons
     • Per-view <title>, meta description, canonical, OG + Twitter cards
     • JSON-LD structured data (Article / WebPage / Breadcrumbs)
     • Format state is shareable:  ?teams=12&scoring=half-ppr&roster=superflex
     • Copy-link + share buttons on player and article views
     • Boots straight into a view when a prerendered page hands it a route
     • Trims the splash screen, which was costing ~2s of Largest Contentful Paint
   ========================================================================== */
(function () {
  "use strict";

  /* --- the one thing to edit: your production origin, no trailing slash --- */
  const CANONICAL_ORIGIN = location.origin;
  const BRAND = "The Board";

  /* ---- Methodology page content. Single source of truth: prerender.mjs
     reads this constant straight out of this file, so edit it here only. ---- */
  const METHODOLOGY_HTML = `<div class="article-head">
  <div class="deep-dive-badge">Methodology</div>
  <h1 class="article-title">Why These Rankings Change When Your League Does</h1>
  <p class="article-dek">Thirty boards instead of one list. What goes into a value, how the tiers are calculated, and where the arguments live.</p>
  <div class="dd-byline"><div class="dd-avatar">RL</div><div class="dd-byline-meta"><b>Roan Layland</b>Updated for the 2026 season</div></div>
</div>
<div class="article-body">
  <p>Every set of rankings you will read this summer is a single list. One number per player, handed to an 8-team half-PPR league and a 16-team superflex league alike, with a note near the bottom telling you to adjust for your format.</p>
  <p>Adjusting for format is the hardest arithmetic in fantasy football. It is also the part nobody does at the draft table, because there is no time and no reliable way to do it in your head.</p>
  <p>This board does it in advance. Five team sizes, three scoring formats, two roster types: thirty separate boards, each built from scratch with its own values, tiers and drop-offs. Change a setting at the top of the page and you are not re-sorting one list. You are loading a different board.</p>
  <p class="pullquote">One list cannot be right for thirty different leagues.</p>

  <h2>What goes into a value</h2>
  <p>Prior production comes first, measured in points per game rather than season totals. A player who missed four games should not be penalised twice for it.</p>
  <p>Positional finish sits alongside it. A receiver averaging 16.2 points means one thing if that was WR7 in a high-scoring year and something else if it was WR14. Several seasons are read together, so no single outlier decides a projection on its own.</p>
  <p>Offensive environment comes next. A player&rsquo;s ceiling is limited by how often his team reaches scoring position. Every player carries his team&rsquo;s points per game and its projected change from last season. That is the difference between a target hog on an offense about to improve and a target hog on one about to fall apart.</p>
  <p>Those feed a projection published as three numbers rather than one: floor, projection, ceiling. A 15.0 that swings between 9 and 22 is a different roster decision than a 15.0 that stays between 13 and 17. A ranking that shows you only the 15.0 cannot tell you which one you are drafting.</p>
  <p>ADP is used last, as a check rather than an input. Where the board disagrees with the market by three spots or more, the row says so: green where the market is late, red where the room is reaching. Those disagreements are the point of having a board at all.</p>

  <h2>Replacement level</h2>
  <p>A player&rsquo;s value is not what he scores. It is what he scores above the player you could have had for free.</p>
  <p>In an 8-team league, the worst starting running back is genuinely good. There are sixteen starting jobs and the waiver wire still holds real contributors. In a 16-team league, the worst starting running back is somebody&rsquo;s handcuff. Same production, different value, because the baseline moved.</p>
  <p>This is why the Value column is not points. It is an asset score, rebuilt at every league size rather than scaled from one master number. It is what the trade analyzer totals, what the draft room sorts by, and what the tiers are cut from.</p>

  <h2>Quarterbacks and superflex</h2>
  <p>Quarterbacks get one deliberate exception. PPR settings barely affect quarterback scoring, so quarterback values ignore the scoring tab entirely.</p>
  <p>Superflex is what moves them, and it moves them a long way. In a league where you can start two quarterbacks, the position stops being optional and becomes the scarcest thing on the board. Change that setting and everything above the quarterbacks reshuffles.</p>

  <h2>How the tiers are made</h2>
  <p>Tiers here are calculated, not drawn by hand. Thirty boards would mean thirty sets of tiers, and nobody maintains that manually. Anyone claiming to has drawn one set and copied it across the rest.</p>
  <p>The method is optimal one-dimensional clustering. Given a list of values and a target number of tiers, it finds the exact split points that minimise the spread within each tier, which is the same as maximising the drop-off between them. It is exact rather than approximate, and it has no random element, so the same data always produces the same tiers.</p>
  <p class="pullquote">A tier break should mark a real cliff, not a round number.</p>
  <p>The simpler approach, breaking whenever the gap between two players exceeds some threshold, fails in a predictable way. An absolute threshold splits the top of the board into fragments, where gaps between elite players are naturally large, then leaves the entire back half in one undifferentiated block. A percentage threshold does the reverse. Clustering handles both ends without being told to, because it solves the whole board at once instead of judging one gap at a time.</p>
  <p>Two players with identical values are never split into different tiers. If the math wants a break between them, the break moves.</p>

  <h2>Where the board ends</h2>
  <p>A player appears only if his value clears zero, meaning he projects to be worth more than a freely available replacement, both at the 10-team baseline and at the size you have selected.</p>
  <p>Shallow leagues raise replacement level. A player who is marginally positive in a 10-team can go negative in an 8-team, and he correctly disappears. The board stops where value stops, rather than at a round number like 200.</p>

  <h2>Reading the board</h2>
  <p>Range bars are scaled within the tab you are on, not across the whole board. That keeps the widths comparable among the players you are actually choosing between. A tight end&rsquo;s range against a running back&rsquo;s on a shared scale would tell you nothing useful.</p>
  <p>Volatility is neutral. It runs from 0 to 100 and measures how wide a player&rsquo;s range of outcomes is, not how good they are. A 78 is not a warning. It is a wide spread: a problem if you are protecting a lead in November, and what you want if you are chasing one.</p>

  <h2>Draft pick values</h2>
  <p>Pick values come off the live board rather than a fixed curve. A pick is worth the average value of the players ranked around that slot, two back and one forward, so it moves as the rankings move and adjusts to league size automatically.</p>
  <p>Picks are stored as overall numbers rather than round and slot. Overall pick 15 is 2.05 in a 10-team and 2.07 in an 8-team, and it is priced correctly in both.</p>

  <h2>Where the arguments live</h2>
  <p>Numbers tell you what a player is worth. They do not tell you why, and why is where drafts are won.</p>
  <p>Deep Dives are long breakdowns of the players shaping the top of the board, the names where being right or wrong decides a season. Values covers where the market is leaving points on the table. Overpriced is the same instinct reversed, aimed at names the room is reaching for a round early. Bold Predictions are the calls worth being wrong about loudly.</p>
  <p>Each one is tied to a specific player and a specific number on the board.</p>

  <h2>What this does not do</h2>
  <p>Projections are wrong. All of them, every season. What this method buys you is not certainty about individual players; it is that the structure around them is right. The tiers break where the board breaks. The values reflect your league instead of somebody else&rsquo;s. Where the market and the board disagree, you can see exactly where.</p>
  <p>The board also knows nothing about your roster. A value is a price, not a recommendation. If it calls a trade even and you need a running back this week, take the running back.</p>
  <p>Use it for the part of drafting that is arithmetic, and it gives you back the time for the part that is judgement.</p>
</div>`;

  /* ---------------------------------------------------------------- utils */
  const slugify = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['’.]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const SECTION_SLUG = {
    "Rankings": "rankings",
    "Deep Dives": "deep-dives",
    "Values": "values",
    "Overpriced": "overpriced",
    "Bold Predictions": "bold-predictions",
    "Trade Analyzer": "trade-analyzer",
    "Methodology": "methodology",
    "Draft Room": "draft-room"
  };
  const SLUG_SECTION = Object.fromEntries(
    Object.entries(SECTION_SLUG).map(([k, v]) => [v, k])
  );
  const LANES = ["Deep Dives", "Values", "Overpriced", "Bold Predictions"];

  const SCORING_SLUG = { full_ppr: "ppr", half_ppr: "half-ppr", non_ppr: "non-ppr" };
  const SCORING_LABEL = { full_ppr: "PPR", half_ppr: "Half-PPR", non_ppr: "Non-PPR" };

  const articleSlug = (a) => slugify((a && (a.id || a.title)) || "");
  const clip = (s, n) => {
    s = String(s || "").replace(/\s+/g, " ").trim();
    return s.length <= n ? s : s.slice(0, n - 1).replace(/[\s,;:.—-]+$/, "") + "…";
  };

  /* --------------------------------------------------------------- paths */
  function fmtQuery() {
    const q = new URLSearchParams();
    if (activeTeams !== "10") q.set("teams", activeTeams);
    if (activeFormat !== "full_ppr") q.set("scoring", SCORING_SLUG[activeFormat]);
    if (activeRoster === "superflex") q.set("roster", "superflex");
    const s = q.toString();
    return s ? "?" + s : "";
  }

  function rankingsPath() {
    return active && active !== "ALL" ? "/rankings/" + active.toLowerCase() : "/";
  }

  function pathFor(state) {
    switch (state.type) {
      case "player":  return "/player/" + state.slug;
      case "article": return "/" + SECTION_SLUG[state.section] + "/" + state.slug;
      case "section": return "/" + SECTION_SLUG[state.section] +
        (state.section === "Trade Analyzer" && state.mode === "picks" ? "/picks" : "");
      default:        return rankingsPath();
    }
  }

  /* ------------------------------------------------------- route parsing */
  function parseRankingsSlug(sl) {
    const out = { tab: "ALL" };
    if (!sl || sl === "overall" || sl === "all") return out;
    const parts = sl.split("-");
    parts.forEach((p, i) => {
      const up = p.toUpperCase();
      if (["QB", "RB", "WR", "TE"].includes(up)) out.tab = up;
      else if (/^\d+$/.test(p) && parts[i + 1] === "team") out.teams = p;
      else if (p === "superflex") out.roster = "superflex";
    });
    if (/(^|-)half-ppr(-|$)/.test(sl)) out.scoring = "half_ppr";
    else if (/(^|-)(non-ppr|standard)(-|$)/.test(sl)) out.scoring = "non_ppr";
    else if (/(^|-)ppr(-|$)/.test(sl)) out.scoring = "full_ppr";
    return out;
  }

  function parseRoute() {
    const seg = location.pathname.replace(/^\/|\/$/g, "").split("/").filter(Boolean);
    const qp = new URLSearchParams(location.search);
    const fmt = {};
    if (["8", "10", "12", "14", "16"].includes(qp.get("teams"))) fmt.teams = qp.get("teams");
    const sc = (qp.get("scoring") || "").toLowerCase();
    if (sc) {
      if (/half/.test(sc)) fmt.scoring = "half_ppr";
      else if (/non|standard/.test(sc)) fmt.scoring = "non_ppr";
      else if (/ppr/.test(sc)) fmt.scoring = "full_ppr";
    }
    if ((qp.get("roster") || "").toLowerCase() === "superflex") fmt.roster = "superflex";

    if (!seg.length) return Object.assign({ type: "rankings", tab: "ALL" }, fmt);

    const head = seg[0].toLowerCase();

    if (head === "rankings")
      return Object.assign({ type: "rankings" }, parseRankingsSlug((seg[1] || "").toLowerCase()), fmt);

    if (head === "player")
      return Object.assign({ type: "player", slug: (seg[1] || "").toLowerCase() }, fmt);

    const section = SLUG_SECTION[head];
    if (section === "Trade Analyzer")
      return Object.assign({ type: "section", section,
        mode: (seg[1] || "").toLowerCase() === "picks" ? "picks" : "players" }, fmt);

    if (section === "Draft Room" || section === "Methodology")
      return Object.assign({ type: "section", section }, fmt);

    if (section && LANES.includes(section))
      return seg[1]
        ? Object.assign({ type: "article", section, slug: seg[1].toLowerCase() }, fmt)
        : Object.assign({ type: "section", section }, fmt);

    return Object.assign({ type: "rankings", tab: "ALL" }, fmt);
  }

  /* ------------------------------------------------- format param apply */
  function setPicker(id, val) {
    const el = document.getElementById(id);
    if (el && val != null) el.value = val;
  }

  function applyFormat(r) {
    const teams   = r.teams   || "10";
    const scoring = r.scoring || "full_ppr";
    const roster  = r.roster  || "1qb";
    let touched = false;
    if (teams   !== activeTeams)  { activeTeams  = teams;   setPicker("teams-picker",  teams);   touched = true; }
    if (scoring !== activeFormat) { activeFormat = scoring; setPicker("format-picker", scoring); touched = true; }
    if (roster  !== activeRoster) { activeRoster = roster;  setPicker("roster-picker", roster);  touched = true; }
    if (touched) {
      if (typeof updateMeta === "function") updateMeta();
      if (typeof updateTitle === "function") updateTitle(SCORING_LABEL[activeFormat]);
    }
    return touched;
  }

  /* ---------------------------------------------------- history plumbing */
  let suppress = false;
  let currentState = { type: "rankings", tab: "ALL" };

  function go(state, opts) {
    currentState = state;
    const url = pathFor(state) + fmtQuery();
    const here = location.pathname + location.search;
    if (suppress || (opts && opts.replace) || here === url) {
      history.replaceState({ tb: true }, "", url);
    } else {
      history.pushState({ tb: true }, "", url);
    }
    applyMeta(state);
  }

  function goBack(fallbackState) {
    applyRoute(fallbackState);
  }

  function applyRoute(r) {
    suppress = true;
    try {
      applyFormat(r);

      if (r.type === "player") {
        const p = PLAYERS.find((x) => slugify(x.name) === r.slug);
        if (p) {
          if (activeSection !== "Rankings") showSection("Rankings");
          detail(p.name);
          currentState = { type: "player", slug: r.slug, name: p.name };
        } else {
          showSection("Rankings");
          currentState = { type: "rankings", tab: active };
        }
      } else if (r.type === "article") {
        showSection(r.section);
        const item = (DEEP_DIVE_DATA[r.section] || []).find((a) => articleSlug(a) === r.slug);
        if (item) {
          openArticle(item);
          currentState = { type: "article", section: r.section, slug: r.slug, item };
        } else {
          currentState = { type: "section", section: r.section };
        }
      } else if (r.type === "section") {
        if (r.section === "Trade Analyzer" && r.mode && typeof tradeMode !== "undefined") tradeMode = r.mode;
        showSection(r.section);
        currentState = { type: "section", section: r.section, mode: r.mode };
      } else {
        active = r.tab || "ALL";
        showSection("Rankings");
        currentState = { type: "rankings", tab: active };
      }
    } finally {
      suppress = false;
    }
    history.replaceState({ tb: true }, "", location.pathname + location.search);
    applyMeta(currentState);
    dropSeoBlock();
  }

  window.addEventListener("popstate", () => applyRoute(parseRoute()));

  /* -------------------------------------------------------- meta writing */
  function tag(sel, attr, val) {
    let el = document.head.querySelector(sel);
    if (!el) {
      el = document.createElement(sel.startsWith("link") ? "link" : "meta");
      const m = sel.match(/\[(.+?)=["'](.+?)["']\]/);
      if (m) el.setAttribute(m[1], m[2]);
      document.head.appendChild(el);
    }
    el.setAttribute(attr, val);
  }

  function scopeLabel() {
    const bits = [];
    if (activeTeams !== "10") bits.push(activeTeams + "-Team");
    bits.push(SCORING_LABEL[activeFormat]);
    if (activeRoster === "superflex") bits.push("Superflex");
    return bits.join(" ");
  }

  function playerLine(p) {
    const g = (k) => (typeof getFormatValue === "function" ? getFormatValue(p, k) : "");
    const v = typeof getPlayerValue === "function" ? getPlayerValue(p) : "";
    const rank = OVERALL_RANKS && OVERALL_RANKS.get ? OVERALL_RANKS.get(p.name) : null;
    const bits = [];
    if (rank) bits.push("Overall #" + rank);
    if (g("proj")) bits.push("proj " + Number(g("proj")).toFixed(1));
    if (g("floor") && g("ceiling"))
      bits.push("range " + Number(g("floor")).toFixed(1) + "–" + Number(g("ceiling")).toFixed(1));
    if (v !== "" && v != null) bits.push("value " + Math.round(Number(v)));
    return bits.join(", ");
  }

  function metaFor(state) {
    const scope = scopeLabel();
    if (state.type === "player") {
      const p = PLAYERS.find((x) => x.name === state.name || slugify(x.name) === state.slug);
      if (p) {
        const pos = [p.pos, p.team].filter(Boolean).join(" · ");
        return {
          title: `${p.name} 2026 Fantasy Outlook — Projection, Floor, Ceiling & Trade Value | ${BRAND}`,
          desc: clip(
            `${p.name} (${pos}) 2026 ${scope} fantasy rankings: ${playerLine(p)}. ${p.blurb || ""}`,
            158
          )
        };
      }
    }
    if (state.type === "article" && state.item) {
      return {
        title: `${state.item.title} | ${BRAND}`,
        desc: clip(state.item.dek || state.item.body || "", 158)
      };
    }
    if (state.type === "section") {
      const s = state.section;
      if (s === "Trade Analyzer") {
        if (state.mode === "picks")
          return {
            title: `Fantasy Football Draft Pick Trade Value Calculator 2026 | ${BRAND}`,
            desc: `Free 2026 draft pick trade value calculator. Prices any pick off the players ranked around that slot, adjusted for 8–16 team leagues, PPR and Superflex.`
          };
        return {
          title: `Fantasy Football Trade Value Calculator 2026 — Player Trades | ${BRAND}`,
          desc: `Free 2026 fantasy football trade calculator. Player values adjust for league size (8–16 team), PPR, Half-PPR, Non-PPR and Superflex.`
        };
      }
      if (s === "Methodology")
        return {
          title: `How These Rankings Are Built — Methodology | ${BRAND}`,
          desc: `The method behind the board: replacement-level values rebuilt for every league size, tiers cut by optimal one-dimensional clustering, and projections published as ranges.`
        };
      if (s === "Draft Room")
        return {
          title: `Live Fantasy Football Draft Board 2026 — Free Draft Tracker | ${BRAND}`,
          desc: `A free live draft board for your 2026 fantasy draft. Cross players off as they're picked, track positional runs, and see best available at a glance.`
        };
      return {
        title: `${s} — 2026 Fantasy Football Analysis | ${BRAND}`,
        desc: clip(
          (typeof EDITORIAL_SUBS === "object" && EDITORIAL_SUBS[s]) ||
            `${s} for the 2026 fantasy football season.`,
          158
        )
      };
    }
    const posBit = state.tab && state.tab !== "ALL" ? state.tab + " " : "";
    return {
      title: `2026 ${scope} Fantasy Football ${posBit}Rankings & Tiers | ${BRAND}`,
      desc: clip(
        `Free 2026 ${scope} fantasy football ${posBit}rankings with automatic tiers, projections, floor/ceiling ranges, volatility and trade values. Adjusts for 8–16 team leagues and Superflex.`,
        158
      )
    };
  }

  function applyMeta(state) {
    const m = metaFor(state);
    const url = CANONICAL_ORIGIN + pathFor(state) + fmtQuery();
    document.title = m.title;
    tag('meta[name="description"]', "content", m.desc);
    tag('link[rel="canonical"]', "href", url);
    tag('meta[property="og:title"]', "content", m.title);
    tag('meta[property="og:description"]', "content", m.desc);
    tag('meta[property="og:url"]', "content", url);
    tag('meta[property="og:type"]', "content", state.type === "article" ? "article" : "website");
    tag('meta[property="og:image"]', "content", CANONICAL_ORIGIN + "/preview.png");
    tag('meta[name="twitter:image"]', "content", CANONICAL_ORIGIN + "/preview.png");
    tag('meta[name="twitter:title"]', "content", m.title);
    tag('meta[name="twitter:description"]', "content", m.desc);
    writeJsonLd(state, m, url);
    injectShare(state, url, m.title);
  }

  function writeJsonLd(state, m, url) {
    const publisher = {
      "@type": "Organization",
      name: BRAND,
      url: CANONICAL_ORIGIN
    };
    let obj;
    if (state.type === "article" && state.item) {
      const it = state.item;
      obj = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: clip(it.title, 110),
        description: m.desc,
        author: { "@type": "Person", name: it.author || "Roan Layland" },
        publisher,
        mainEntityOfPage: url,
        articleSection: state.section
      };
      if (it.date && !isNaN(Date.parse(it.date)))
        obj.datePublished = new Date(it.date).toISOString().slice(0, 10);
    } else if (state.type === "player") {
      const p = PLAYERS.find((x) => slugify(x.name) === state.slug);
      obj = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: m.title,
        description: m.desc,
        url,
        publisher,
        about: p
          ? { "@type": "Person", name: p.name, jobTitle: p.pos, affiliation: p.team }
          : undefined
      };
    } else {
      obj = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: BRAND,
        url: CANONICAL_ORIGIN,
        description: m.desc,
        publisher
      };
    }
    let el = document.getElementById("tb-jsonld");
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = "tb-jsonld";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(obj);
  }

  /* ------------------------------------------------------ share controls */
  const shareCss = `
    .tb-share{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 4px}
    .tb-share a,.tb-share button{appearance:none;cursor:pointer;text-decoration:none;
      background:none;border:1px solid var(--rule);border-radius:4px;color:var(--ink-soft);
      font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.08em;
      text-transform:uppercase;padding:7px 12px;transition:border-color .12s,color .12s}
    .tb-share a:hover,.tb-share button:hover{border-color:var(--turf);color:var(--turf)}
    .tb-share button.done{border-color:var(--turf);color:var(--turf)}
    #method-view{padding-top:8px;max-width:760px}
    #method-view .article-body h2{font-family:'Barlow Condensed',sans-serif;font-weight:700;
      font-size:17px;text-transform:uppercase;letter-spacing:.12em;color:var(--turf);
      margin:38px 0 14px;padding-bottom:7px;border-bottom:1px solid var(--rule)}
    #method-view .article-body h2:first-child{margin-top:0}
    .tb-method-link{color:var(--turf);font-weight:600;text-decoration:none;white-space:nowrap}
    .tb-method-link:hover{text-decoration:underline}
    #tb-seo{max-width:760px}
    #tb-seo h1{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:38px;
      line-height:1.02;text-transform:uppercase;margin:6px 0 10px}
    #tb-seo h2{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:16px;
      text-transform:uppercase;letter-spacing:.12em;margin:26px 0 10px;padding-bottom:6px;
      border-bottom:1px solid var(--rule)}
    #tb-seo p{font-size:16px;line-height:1.65;max-width:64ch;margin:0 0 16px}
    #tb-seo li{font-size:14px;line-height:1.6;margin-bottom:6px}
    #tb-seo table{border-collapse:collapse;width:100%;max-width:760px;margin:0 0 22px}
    #tb-seo th,#tb-seo td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--rule);
      font-family:'IBM Plex Mono',monospace;font-size:12px}
    #tb-seo th{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft)}
  `;
  (function () {
    const s = document.createElement("style");
    s.textContent = shareCss;
    document.head.appendChild(s);
  })();

  function injectShare(state, url, title) {
    if (state.type !== "player" && state.type !== "article") return;
    const host =
      state.type === "player"
        ? document.querySelector("#detail-view .d-head")
        : document.querySelector("#article-view .article-head");
    if (!host || host.parentNode.querySelector(".tb-share")) return;
    const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
    const rd = `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
    const bar = document.createElement("div");
    bar.className = "tb-share";
    bar.innerHTML =
      `<button type="button" data-copy="${url}">Copy link</button>` +
      `<a href="${x}" target="_blank" rel="noopener">Share on X</a>` +
      `<a href="${rd}" target="_blank" rel="noopener">Share on Reddit</a>`;
    host.insertAdjacentElement("afterend", bar);
    bar.querySelector("button").onclick = function () {
      const btn = this;
      const done = () => {
        btn.textContent = "Link copied";
        btn.classList.add("done");
        setTimeout(() => { btn.textContent = "Copy link"; btn.classList.remove("done"); }, 1800);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(btn.dataset.copy).then(done, () => {});
      else {
        const t = document.createElement("textarea");
        t.value = btn.dataset.copy;
        document.body.appendChild(t); t.select();
        try { document.execCommand("copy"); done(); } catch (e) {}
        t.remove();
      }
    };
  }

  /* ------------------------------------------------- methodology page */
  function ensureMethodView() {
    let mv = document.getElementById("method-view");
    if (mv) return mv;
    mv = document.createElement("div");
    mv.id = "method-view";
    mv.className = "hide";
    mv.innerHTML = METHODOLOGY_HTML;
    const anchor = document.getElementById("draft-view") ||
                   document.getElementById("trade-view") ||
                   document.querySelector(".wrap");
    if (anchor && anchor.parentNode && anchor !== document.querySelector(".wrap"))
      anchor.insertAdjacentElement("afterend", mv);
    else if (anchor) anchor.appendChild(mv);
    return mv;
  }

  function showMethodology() {
    activeSection = "Methodology";
    if (typeof stopCarousel === "function") stopCarousel();
    ["list-view", "detail-view", "editorial-view", "article-view",
     "trade-view", "draft-view", "compare-tray"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add("hide");
    });
    const header = document.querySelector("header");
    if (header) header.style.display = "none";
    const note = document.querySelector(".note");
    if (note) note.style.display = "none";
    ensureMethodView().classList.remove("hide");
    if (typeof renderSideNav === "function") renderSideNav();
    const rp = document.getElementById("read-progress");
    if (rp) rp.style.background = "var(--turf)";
    window.scrollTo({ top: 0 });
  }

  function installMethodology() {
    /* nav button, sitting directly under Trade Analyzer */
    const list = document.getElementById("side-nav-list");
    if (list && !list.querySelector('[data-section="Methodology"]')) {
      const after = list.querySelector('[data-section="Draft Room"]') ||
                    list.querySelector('[data-section="Trade Analyzer"]');
      const btn = document.createElement("button");
      btn.className = "side-nav-item";
      btn.setAttribute("data-section", "Methodology");
      btn.textContent = "Methodology";
      if (after) after.insertAdjacentElement("afterend", btn);
      else list.appendChild(btn);
      if (typeof SECTIONS !== "undefined" && Array.isArray(SECTIONS) &&
          SECTIONS.indexOf("Methodology") === -1) {
        const i = SECTIONS.indexOf("Draft Room");
        SECTIONS.splice(i === -1 ? SECTIONS.length : i + 1, 0, "Methodology");
      }
    }
    ensureMethodView();
    /* permanent link under every board view */
    const note = document.querySelector(".note");
    if (note && !note.querySelector(".tb-method-link")) {
      const a = document.createElement("a");
      a.className = "tb-method-link";
      a.href = "/methodology";
      a.textContent = "How these rankings are built \u2192";
      a.onclick = (e) => { e.preventDefault(); showSection("Methodology"); };
      note.appendChild(document.createTextNode(" "));
      note.appendChild(a);
    }
    if (typeof renderSideNav === "function") renderSideNav();
  }

  function dropSeoBlock() {
    const el = document.getElementById("tb-seo");
    if (el) el.remove();
  }

  /* --------------------------------------------------- patch the app ---- */
  if (typeof setTradeMode === "function") {
    const origSetTradeMode = setTradeMode;
    setTradeMode = function (mode) {
      origSetTradeMode(mode);
      go({ type: "section", section: "Trade Analyzer", mode: tradeMode });
    };
  }

  const origShowSection = showSection;
  showSection = function (section) {
    if (section === "Methodology") {
      showMethodology();
      go({ type: "section", section: "Methodology" });
      dropSeoBlock();
      return;
    }
    const mv = document.getElementById("method-view");
    if (mv) mv.classList.add("hide");
    origShowSection(section);
    if (section === "Rankings") go({ type: "rankings", tab: active });
    else go({ type: "section", section,
      mode: section === "Trade Analyzer" && typeof tradeMode !== "undefined" ? tradeMode : undefined });
    dropSeoBlock();
  };

  const origRenderTabs = renderTabs;
  renderTabs = function () {
    origRenderTabs();
    document.querySelectorAll("#tabs button").forEach((b) => {
      const prev = b.onclick;
      b.onclick = function () {
        prev.call(this);
        go({ type: "rankings", tab: active });
      };
    });
  };

  const origDetail = detail;
  detail = function (name) {
    origDetail(name);
    const p = PLAYERS.find((x) => x.name === name);
    if (p) go({ type: "player", slug: slugify(p.name), name: p.name });
    const back = document.getElementById("back");
    if (back) back.onclick = () => goBack({ type: "rankings", tab: active });
    dropSeoBlock();
  };

  const origOpenArticle = openArticle;
  openArticle = function (item) {
    origOpenArticle(item);
    if (item)
      go({ type: "article", section: activeSection, slug: articleSlug(item), item });
    const back = document.getElementById("article-back");
    if (back) {
      const prev = back.onclick;
      const lane = activeSection;
      back.onclick = function () {
        prev.call(this);
        go({ type: "section", section: lane });
      };
    }
    dropSeoBlock();
  };

  /* keep the querystring honest when the format pickers change */
  ["teams-picker", "roster-picker", "format-picker"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => go(currentState, { replace: true }));
  });

  /* ------------------------------------------------------------- splash */
  (function () {
    const intro = document.getElementById("intro");
    if (!intro) return;
    const deepLink = location.pathname !== "/" || !!window.__TB_ROUTE__;
    let seen = false;
    try { seen = !!sessionStorage.getItem("tb-intro"); sessionStorage.setItem("tb-intro", "1"); } catch (e) {}
    if (deepLink || seen) { intro.remove(); return; }
    setTimeout(() => {
      intro.classList.add("done");
      setTimeout(() => intro.remove(), 620);
    }, 850);
  })();

  /* --------------------------------------------------------------- boot */
  installMethodology();

  const boot = window.__TB_ROUTE__ ? Object.assign(parseRoute(), window.__TB_ROUTE__) : parseRoute();
  applyFormat(boot);

  let resolved = false;
  function attempt() {
    if (resolved) return true;
    if (boot.type === "player" && !PLAYERS.length) return false;
    if (boot.type === "article" && !(DEEP_DIVE_DATA[boot.section] || []).length) return false;
    resolved = true;
    applyRoute(boot);
    return true;
  }
  if (!attempt()) {
    const iv = setInterval(() => { if (attempt()) clearInterval(iv); }, 100);
    setTimeout(() => {
      clearInterval(iv);
      if (!resolved) { resolved = true; applyRoute(boot); }
    }, 8000);
  }
})();
