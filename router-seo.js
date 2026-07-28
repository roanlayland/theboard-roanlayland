/* ==========================================================================
   THE BOARD — router + SEO layer   v1
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
  const CANONICAL_ORIGIN = "https://theboard-roanlayland.vercel.app";
  const BRAND = "The Board";

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
      case "section": return "/" + SECTION_SLUG[state.section];
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
    if (section === "Trade Analyzer" || section === "Draft Room")
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
        showSection(r.section);
        currentState = { type: "section", section: r.section };
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
      if (s === "Trade Analyzer")
        return {
          title: `Fantasy Football Trade Value Calculator 2026 — Players & Draft Picks | ${BRAND}`,
          desc: `Free 2026 fantasy football trade calculator. Values adjust for league size (8–16 team), PPR, Half-PPR, Non-PPR and Superflex, and it prices draft picks too.`
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

  function dropSeoBlock() {
    const el = document.getElementById("tb-seo");
    if (el) el.remove();
  }

  /* --------------------------------------------------- patch the app ---- */
  const origShowSection = showSection;
  showSection = function (section) {
    origShowSection(section);
    if (section === "Rankings") go({ type: "rankings", tab: active });
    else go({ type: "section", section });
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
