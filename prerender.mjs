#!/usr/bin/env node
/* ==========================================================================
   THE BOARD — prerender
   --------------------------------------------------------------------------
   Reads your Google Sheets, then writes a real HTML file for every player,
   every article, and a set of rankings landing pages. Each generated file is
   a byte-for-byte copy of index.html with:

     • the <title>, description, canonical and OG tags rewritten for that page
     • JSON-LD for that page
     • a block of readable, crawlable content (#tb-seo) in the body
     • window.__TB_ROUTE__, which tells router-seo.js which view to boot into
       and to delete the #tb-seo block once the app takes over

   So a crawler gets full text on first byte, and a human gets the live app.

   USAGE
     node prerender.mjs                # writes into the current directory
     npm run build                     # if you wire it into package.json

   Requires Node 18+ (for global fetch). No dependencies.
   ========================================================================== */

import fs from "node:fs/promises";
import path from "node:path";

/* ----------------------------------------------------------------- config */
const SITE = process.env.SITE_URL || "https://theboard-roanlayland.vercel.app";
const BRAND = "The Board";
const AUTHOR = "Roan Layland";
const OUT = process.cwd();
const TEMPLATE = path.join(OUT, "index.html");

const PLAYERS_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRWWYRNXhGR0m0tttJ5im1i87Hx3juBvUhH0kaxTJNQvpZeyft9rK5Lw8ozIg-F3H2L5FVI7KrGkq3S/pub?gid=1512261100&single=true&output=csv";

const LANES = {
  "Deep Dives": {
    slug: "deep-dives",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRWWYRNXhGR0m0tttJ5im1i87Hx3juBvUhH0kaxTJNQvpZeyft9rK5Lw8ozIg-F3H2L5FVI7KrGkq3S/pub?gid=1466212913&single=true&output=csv"
  },
  "Values": {
    slug: "values",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRWWYRNXhGR0m0tttJ5im1i87Hx3juBvUhH0kaxTJNQvpZeyft9rK5Lw8ozIg-F3H2L5FVI7KrGkq3S/pub?gid=1602605871&single=true&output=csv"
  },
  "Overpriced": {
    slug: "overpriced",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRWWYRNXhGR0m0tttJ5im1i87Hx3juBvUhH0kaxTJNQvpZeyft9rK5Lw8ozIg-F3H2L5FVI7KrGkq3S/pub?gid=543192642&single=true&output=csv"
  },
  "Bold Predictions": {
    slug: "bold-predictions",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRWWYRNXhGR0m0tttJ5im1i87Hx3juBvUhH0kaxTJNQvpZeyft9rK5Lw8ozIg-F3H2L5FVI7KrGkq3S/pub?gid=1937456343&single=true&output=csv"
  }
};

/* Rankings landing pages. These are the pages that actually rank in search —
   each one targets a phrase real people type into Google. Add or remove
   freely; the slug is parsed by router-seo.js, so it just works. */
const RANKING_PAGES = [
  { slug: "ppr",                    teams: "10", scoring: "full_ppr", roster: "1qb" },
  { slug: "half-ppr",               teams: "10", scoring: "half_ppr", roster: "1qb" },
  { slug: "non-ppr",                teams: "10", scoring: "non_ppr",  roster: "1qb" },
  { slug: "superflex",              teams: "10", scoring: "full_ppr", roster: "superflex" },
  { slug: "half-ppr-superflex",     teams: "10", scoring: "half_ppr", roster: "superflex" },
  { slug: "8-team-ppr",             teams: "8",  scoring: "full_ppr", roster: "1qb" },
  { slug: "12-team-ppr",            teams: "12", scoring: "full_ppr", roster: "1qb" },
  { slug: "12-team-half-ppr",       teams: "12", scoring: "half_ppr", roster: "1qb" },
  { slug: "12-team-superflex",      teams: "12", scoring: "full_ppr", roster: "superflex" },
  { slug: "14-team-ppr",            teams: "14", scoring: "full_ppr", roster: "1qb" },
  { slug: "16-team-ppr",            teams: "16", scoring: "full_ppr", roster: "1qb" },
  { slug: "qb",  pos: "QB", teams: "10", scoring: "full_ppr", roster: "1qb" },
  { slug: "rb",  pos: "RB", teams: "10", scoring: "full_ppr", roster: "1qb" },
  { slug: "wr",  pos: "WR", teams: "10", scoring: "full_ppr", roster: "1qb" },
  { slug: "te",  pos: "TE", teams: "10", scoring: "full_ppr", roster: "1qb" }
];

const RANKING_ROWS = 200;      // how deep each rankings page lists
const MAX_PLAYER_PAGES = 500;

/* ------------------------------------------------------------------ util */
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const slugify = (s) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/['’.]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

const clip = (s, n) => {
  s = String(s || "").replace(/\s+/g, " ").trim();
  return s.length <= n ? s : s.slice(0, n - 1).replace(/[\s,;:.—-]+$/, "") + "…";
};

function parseDelimited(text) {
  const rows = []; let row = [], cell = "", q = false;
  const d = text.includes("\t") && !text.includes(",") ? "\t" : ",";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else {
      if (c === '"') q = true;
      else if (c === d) { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c !== "\r") cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

function toObjects(text) {
  const rows = parseDelimited(String(text || "").replace(/^\uFEFF/, "").trim());
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => (h || "").trim().toLowerCase().replace(/^"|"$/g, ""));
  return rows.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => { if (h) o[h] = (r[i] || "").replace(/^"|"$/g, "").trim(); });
    return o;
  });
}

async function grab(url) {
  const res = await fetch(url, { headers: { "user-agent": "the-board-prerender" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

/* --------------------------------------------- value model (mirrors app) */
const TEAM_WORDS = { "8": "eight", "10": "ten", "12": "twelve", "14": "fourteen", "16": "sixteen" };
const FMT_WORD = { full_ppr: "ppr", half_ppr: "half", non_ppr: "non" };
const SCORING_LABEL = { full_ppr: "PPR", half_ppr: "Half-PPR", non_ppr: "Non-PPR" };

function field(p, kind, scoring) {
  const map = {
    full_ppr: { proj: "proj", floor: "floor", ceiling: "ceiling", value: "value", adp: "adp", pos_rank: "pos_rank", volatility: "ppr_volatility", history: "history" },
    half_ppr: { proj: "proj_half_ppr", floor: "floor_half_ppr", ceiling: "ceiling_half_ppr", value: "value_half_ppr", adp: "adp_half", pos_rank: "pos_rank_half_ppr", volatility: "half-ppr_volatility", history: "history_half" },
    non_ppr:  { proj: "proj_non_ppr",  floor: "floor_non_ppr",  ceiling: "ceiling_non_ppr",  value: "value_non_ppr",  adp: "adp_non",  pos_rank: "pos_rank_non_ppr",  volatility: "non-ppr_volatility",  history: "history_non" }
  };
  const primary = map[scoring]?.[kind];
  if (primary && p[primary]) return p[primary];
  const fb = { proj: "proj", floor: "floor", ceiling: "ceiling", value: "value", adp: "adp", pos_rank: "pos_rank", volatility: "volatility", history: "history" }[kind];
  return (fb && p[fb]) || "";
}

function baseValue(p, scoring, roster) {
  if ((p.pos || "").toUpperCase() === "QB" && roster === "superflex" && p.qb_value_superflex)
    return num(p.qb_value_superflex);
  return num(field(p, "value", scoring));
}

function playerValue(p, teams, scoring, roster) {
  const base = baseValue(p, scoring, roster);
  if (teams === "10") return base;
  const isQB = (p.pos || "").toUpperCase() === "QB";
  const sw = isQB ? (roster === "superflex" ? "superflex" : "ppr") : FMT_WORD[scoring];
  const col = `${TEAM_WORDS[teams]}_team_${sw}`;
  const v = p[col];
  return v ? num(v) : base;
}

/* the app's eligibility gate: real value at 10-team AND above zero here */
function eligible(p, teams, scoring, roster) {
  return baseValue(p, scoring, roster) > 0 && playerValue(p, teams, scoring, roster) > 0;
}

function board(players, { teams, scoring, roster, pos }) {
  return players
    .filter((p) => p.name && eligible(p, teams, scoring, roster))
    .filter((p) => (pos ? (p.pos || "").toUpperCase() === pos : true))
    .sort((a, b) => {
      const d = playerValue(b, teams, scoring, roster) - playerValue(a, teams, scoring, roster);
      if (d) return d;
      const c = num(field(b, "ceiling", scoring)) - num(field(a, "ceiling", scoring));
      return c || a.name.localeCompare(b.name);
    });
}

/* ----------------------------------------------------- template stamping */
function stamp(tpl, { title, desc, url, seo, route, jsonld }) {
  let out = tpl;
  const rep = (re, val) => { out = out.replace(re, val); };

  rep(/<title id="doc-title">[\s\S]*?<\/title>/, `<title id="doc-title">${esc(title)}</title>`);
  rep(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">`);
  rep(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(url)}">`);
  rep(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`);
  rep(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(desc)}">`);
  rep(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${esc(url)}">`);
  rep(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(title)}">`);
  rep(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(desc)}">`);

  const head =
    `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` +
    `<script>window.__TB_ROUTE__=${JSON.stringify(route)};</script>\n</head>`;
  rep(/<\/head>/, head);

  rep(/<div id="list-view">/, `<div id="tb-seo">\n${seo}\n</div>\n    <div id="list-view">`);
  return out;
}

const publisher = { "@type": "Organization", name: BRAND, url: SITE };

/* --------------------------------------------------------- content blocks */
function playerSeo(p, ranks) {
  const scoring = "full_ppr";
  const g = (k) => field(p, k, scoring);
  const meta = [p.pos, p.team, p.bye ? `Bye ${p.bye}` : "", g("adp") ? `ADP ${g("adp")}` : ""]
    .filter(Boolean).join(" · ");
  const rows = [
    ["Overall rank", ranks.overall || "—"],
    ["Position rank", p.pos ? `${p.pos}${ranks.pos || ""}` : "—"],
    ["Projection", g("proj") ? num(g("proj")).toFixed(1) : "—"],
    ["Floor", g("floor") ? num(g("floor")).toFixed(1) : "—"],
    ["Ceiling", g("ceiling") ? num(g("ceiling")).toFixed(1) : "—"],
    ["Trade value", g("value") ? Math.round(num(g("value"))) : "—"],
    ["Volatility", g("volatility") ? Math.round(num(g("volatility"))) : "—"]
  ];
  const list = (s) =>
    String(s || "").split(";").map((x) => x.trim()).filter(Boolean)
      .map((x) => `<li>${esc(x)}</li>`).join("");
  const hist = String(g("history") || "").split(";").map((x) => x.trim()).filter(Boolean)
    .map((x) => {
      const [year, ppg, ppgRank] = x.split("|").map((v) => (v || "").trim());
      return `<li>${esc(year)}: ${esc(ppg)} points per game${ppgRank ? ` (${esc(ppgRank)})` : ""}</li>`;
    }).join("");

  return `<article>
  <h1>${esc(p.name)} — 2026 Fantasy Football Outlook</h1>
  <p><strong>${esc(meta)}</strong></p>
  ${p.blurb ? `<p>${esc(p.blurb)}</p>` : ""}
  <h2>2026 projection and value</h2>
  <table><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>
  ${p.strengths ? `<h2>Ceiling drivers</h2><ul>${list(p.strengths)}</ul>` : ""}
  ${p.risks ? `<h2>Floor risks</h2><ul>${list(p.risks)}</ul>` : ""}
  ${hist ? `<h2>Fantasy history</h2><ul>${hist}</ul>` : ""}
  <p>Figures shown are 10-team full PPR. Open the live board to switch league size, scoring and Superflex.</p>
</article>`;
}

function articleSeo(item, section) {
  const byline = [item.author || AUTHOR, item.date, item.read_time].filter(Boolean).join(" · ");
  const body = String(item.body || "").split(/\n+/).map((x) => x.trim()).filter(Boolean)
    .map((par) => par.startsWith("> ")
      ? `<blockquote><p>${esc(par.slice(2).trim())}</p></blockquote>`
      : `<p>${esc(par)}</p>`).join("");
  return `<article>
  <p><strong>${esc(section)}</strong></p>
  <h1>${esc(item.title || "")}</h1>
  ${item.dek ? `<p>${esc(item.dek)}</p>` : ""}
  <p>${esc(byline)}${item.player_name ? ` · ${esc(item.player_name)}` : ""}</p>
  ${body || "<p>Story coming shortly.</p>"}
</article>`;
}

function rankingsSeo(list, cfg, title) {
  const rows = list.slice(0, RANKING_ROWS).map((p, i) => {
    const v = playerValue(p, cfg.teams, cfg.scoring, cfg.roster);
    const proj = field(p, "proj", cfg.scoring);
    return `<tr><td>${i + 1}</td><td><a href="/player/${slugify(p.name)}">${esc(p.name)}</a></td>` +
      `<td>${esc(p.pos || "")}</td><td>${esc(p.team || "")}</td>` +
      `<td>${proj ? num(proj).toFixed(1) : "—"}</td><td>${Math.round(v)}</td></tr>`;
  }).join("");
  return `<article>
  <h1>${esc(title)}</h1>
  <p>Ranked by trade value for ${esc(cfg.teams)}-team ${esc(SCORING_LABEL[cfg.scoring])}${cfg.roster === "superflex" ? " Superflex" : ""} leagues, updated for the 2026 season by ${esc(AUTHOR)}. Values are replacement-adjusted for league size, so the same player is worth more in a 16-team league than an 8-team one. Open the live board to see tiers, floor/ceiling ranges and volatility.</p>
  <table>
    <thead><tr><th>#</th><th>Player</th><th>Pos</th><th>Team</th><th>Proj</th><th>Value</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</article>`;
}

/* ------------------------------------------------------------------ main */
async function write(rel, contents) {
  const full = path.join(OUT, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, contents, "utf8");
}

async function main() {
  const tpl = await fs.readFile(TEMPLATE, "utf8");
  if (!/<div id="list-view">/.test(tpl))
    throw new Error("index.html doesn't look like the expected template (no #list-view).");

  const players = toObjects(await grab(PLAYERS_CSV)).filter((p) => p.name);
  console.log(`· ${players.length} players`);

  const urls = [
    { loc: "/", pri: "1.0", freq: "daily" },
    { loc: "/trade-analyzer", pri: "0.9", freq: "weekly" },
    { loc: "/draft-room", pri: "0.9", freq: "weekly" }
  ];

  /* ---- rankings pages ---- */
  for (const cfg of RANKING_PAGES) {
    const list = board(players, cfg);
    if (!list.length) continue;
    const scope = [
      cfg.teams !== "10" ? `${cfg.teams}-Team` : "",
      SCORING_LABEL[cfg.scoring],
      cfg.roster === "superflex" ? "Superflex" : ""
    ].filter(Boolean).join(" ");
    const posBit = cfg.pos ? `${cfg.pos} ` : "";
    const title = `2026 ${scope} Fantasy Football ${posBit}Rankings & Tiers | ${BRAND}`;
    const desc = clip(
      `Top ${Math.min(list.length, RANKING_ROWS)} ${scope} ${posBit}fantasy football rankings for 2026 with automatic tiers, projections, floor and ceiling ranges, volatility scores and trade values.`, 158);
    const loc = `/rankings/${cfg.slug}`;
    const url = SITE + loc;
    await write(`rankings/${cfg.slug}.html`, stamp(tpl, {
      title, desc, url,
      seo: rankingsSeo(list, cfg, `2026 ${scope} Fantasy Football ${posBit}Rankings`),
      route: { type: "rankings", tab: cfg.pos || "ALL", teams: cfg.teams, scoring: cfg.scoring, roster: cfg.roster },
      jsonld: {
        "@context": "https://schema.org", "@type": "WebPage",
        name: title, description: desc, url, publisher,
        author: { "@type": "Person", name: AUTHOR }
      }
    }));
    urls.push({ loc, pri: "0.9", freq: "daily" });
  }
  console.log(`· ${RANKING_PAGES.length} rankings pages`);

  /* ---- player pages ---- */
  const base = board(players, { teams: "10", scoring: "full_ppr", roster: "1qb" });
  const posCounter = {};
  let made = 0;
  for (let i = 0; i < base.length && i < MAX_PLAYER_PAGES; i++) {
    const p = base[i];
    const pos = (p.pos || "").toUpperCase();
    posCounter[pos] = (posCounter[pos] || 0) + 1;
    const sl = slugify(p.name);
    if (!sl) continue;
    const loc = `/player/${sl}`;
    const url = SITE + loc;
    const title = `${p.name} 2026 Fantasy Outlook — Projection, Floor, Ceiling & Trade Value | ${BRAND}`;
    const desc = clip(
      `${p.name} (${[p.pos, p.team].filter(Boolean).join(", ")}) 2026 fantasy football rankings: overall #${i + 1}, ` +
      `projection ${num(field(p, "proj", "full_ppr")).toFixed(1)}, value ${Math.round(baseValue(p, "full_ppr", "1qb"))}. ${p.blurb || ""}`, 158);
    await write(`player/${sl}.html`, stamp(tpl, {
      title, desc, url,
      seo: playerSeo(p, { overall: i + 1, pos: posCounter[pos] }),
      route: { type: "player", slug: sl },
      jsonld: {
        "@context": "https://schema.org", "@type": "WebPage",
        name: title, description: desc, url, publisher,
        about: { "@type": "Person", name: p.name, jobTitle: p.pos, affiliation: p.team }
      }
    }));
    urls.push({ loc, pri: "0.7", freq: "weekly" });
    made++;
  }
  console.log(`· ${made} player pages`);

  /* ---- articles ---- */
  const feedItems = [];
  for (const [section, cfg] of Object.entries(LANES)) {
    let rows = [];
    try { rows = toObjects(await grab(cfg.url)).filter((r) => r.title); }
    catch (e) { console.warn(`  ! ${section}: ${e.message}`); }

    const laneTitle = `${section} — 2026 Fantasy Football Analysis | ${BRAND}`;
    const laneDesc = clip(`${section} for the 2026 fantasy football season from ${AUTHOR}. ${rows.length} stories.`, 158);
    await write(`${cfg.slug}.html`, stamp(tpl, {
      title: laneTitle, desc: laneDesc, url: SITE + "/" + cfg.slug,
      seo: `<article><h1>${esc(section)}</h1><ul>${rows.map((r) =>
        `<li><a href="/${cfg.slug}/${slugify(r.id || r.title)}">${esc(r.title)}</a> — ${esc(clip(r.dek, 140))}</li>`).join("")}</ul></article>`,
      route: { type: "section", section },
      jsonld: {
        "@context": "https://schema.org", "@type": "CollectionPage",
        name: laneTitle, description: laneDesc, url: SITE + "/" + cfg.slug, publisher
      }
    }));
    urls.push({ loc: "/" + cfg.slug, pri: "0.8", freq: "weekly" });

    for (const item of rows) {
      const sl = slugify(item.id || item.title);
      if (!sl) continue;
      const loc = `/${cfg.slug}/${sl}`;
      const url = SITE + loc;
      const title = `${item.title} | ${BRAND}`;
      const desc = clip(item.dek || item.body || "", 158);
      const jsonld = {
        "@context": "https://schema.org", "@type": "Article",
        headline: clip(item.title, 110), description: desc, url,
        author: { "@type": "Person", name: item.author || AUTHOR },
        publisher, mainEntityOfPage: url, articleSection: section
      };
      if (item.date && !isNaN(Date.parse(item.date)))
        jsonld.datePublished = new Date(item.date).toISOString().slice(0, 10);

      await write(`${cfg.slug}/${sl}.html`, stamp(tpl, {
        title, desc, url, seo: articleSeo(item, section),
        route: { type: "article", section, slug: sl }, jsonld
      }));
      urls.push({ loc, pri: "0.8", freq: "monthly" });
      feedItems.push({ ...item, section, url, date: item.date });
    }
    console.log(`· ${section}: ${rows.length} articles`);
  }

  /* ---- sitemap ---- */
  const today = new Date().toISOString().slice(0, 10);
  await write("sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${SITE}${u.loc}</loc><lastmod>${today}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`).join("\n") +
    `\n</urlset>\n`);

  /* ---- robots ---- */
  await write("robots.txt",
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

  /* ---- RSS (for Feedly, newsletter tools, and anyone syndicating you) ---- */
  feedItems.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  await write("feed.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n` +
    `<title>${esc(BRAND)}</title>\n<link>${SITE}</link>\n` +
    `<description>2026 fantasy football rankings, tiers and trade values by ${esc(AUTHOR)}.</description>\n` +
    feedItems.slice(0, 40).map((i) =>
      `<item><title>${esc(i.title)}</title><link>${i.url}</link><guid>${i.url}</guid>` +
      `<category>${esc(i.section)}</category>` +
      (Date.parse(i.date) ? `<pubDate>${new Date(i.date).toUTCString()}</pubDate>` : "") +
      `<description>${esc(i.dek || "")}</description></item>`).join("\n") +
    `\n</channel></rss>\n`);

  console.log(`\n✓ ${urls.length} URLs written · sitemap.xml · robots.txt · feed.xml`);
}

main().catch((e) => { console.error("\n✗ " + e.message); process.exit(1); });
