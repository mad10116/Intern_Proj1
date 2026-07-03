// RiverIQ, AI-powered poker training app
// Single-file React build: full 6-max NLHE engine, AI opponents, equity engine,
// session review with leak detection, learn modules, profile, RiverIQ rating.
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

function haptic(style) {
  if (!Capacitor.isNativePlatform()) return;
  try { Haptics.impact({ style: style === "heavy" ? ImpactStyle.Heavy : style === "medium" ? ImpactStyle.Medium : ImpactStyle.Light }); } catch {}
}

/* ============================ THEME ============================ */
const T = {
  baize: "#0C1F16",      // deep felt
  baize2: "rgba(10,26,18,0.65)",  // green glass container
  rail: "rgba(18,58,45,0.42)",    // translucent green rail
  card: "#F7F2E6",       // cream card stock
  ink: "#17211B",
  cordovan: "#C2453E",   // chip red / hearts & diamonds
  brass: "#C9A546",      // premium brass
  brassDim: "#8A7332",
  mist: "#9AB3A4",       // muted text
  faint: "rgba(94,122,107,0.55)",
  line: "rgba(201,165,70,0.14)",
  good: "#7FC97F",
  bad: "#E0716B",
};
const SB = 10, BB = 20, START_STACK = 2000;
const CARD_REVEAL_DELAY_MS = 350;
const TIMER_GLOW_THRESHOLD_SECONDS = 10;
const TIMER_DURATION_S = 22;
// TESTING: unlock every solo tier and learn module so all levels can be exercised.
// Set to false before a real launch to restore normal progression gating.
const UNLOCK_ALL_FOR_TESTING = true;
const COSMETICS = { back: "classic", felt: null };
const SHOP_ITEMS = [
  { id: "back-crimson",  type: "back",  name: "Crimson back",   price: 150, desc: "Deep red diagonal weave" },
  { id: "back-gold",     type: "back",  name: "Gold lattice",   price: 200, desc: "Warm 45° gold cross-hatch" },
  { id: "back-jade",     type: "back",  name: "Jade back",      price: 250, desc: "Forest jade weave" },
  { id: "back-royal",    type: "back",  name: "Royal back",     price: 300, desc: "Midnight radial burst" },
  { id: "back-ocean",    type: "back",  name: "Ocean back",     price: 350, desc: "Deep teal cross-hatch" },
  { id: "felt-forest",   type: "felt",  name: "Forest felt",    price: 200, desc: "Deep forest green table" },
  { id: "felt-midnight", type: "felt",  name: "Midnight felt",  price: 250, desc: "Deep navy table" },
  { id: "felt-burgundy", type: "felt",  name: "Burgundy felt",  price: 300, desc: "Rich wine-red table" },
  { id: "felt-slate",    type: "felt",  name: "Slate felt",     price: 300, desc: "Slate blue-grey table" },
];
// Feature flags, all enabled. (Internal scaffold; not user-facing.)
const TIER_FEATURES = {
  free: { spotTrainer: true, dailyDrill: true, leagues: true, spacedReviews: true, opponentScoring: true, tendencies: true, botTier3: true, streakShields: true },
  plus: {}, pro: {},
};
function hasFeature(profile, name) {
  const tier = (profile && profile.subscription_tier) || "free";
  const base = TIER_FEATURES.free[name];
  const over = (TIER_FEATURES[tier] || {})[name];
  return over !== undefined ? over : base !== false;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.riq * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
.riq { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
.riq .serif { font-family: "DM Serif Display", Georgia, serif; letter-spacing: 0.01em; }
.riq .mono { font-family: "IBM Plex Mono", ui-monospace, Menlo, monospace; font-variant-numeric: tabular-nums; }
.riq button { cursor: pointer; font-family: inherit; }
.riq button:focus-visible { outline: 2px solid ${"#C9A546"}; outline-offset: 2px; }
@keyframes riqDealIn { from { transform: translateY(-8px) scale(.92); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes riqPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(201,165,70,.45);} 50% { box-shadow: 0 0 0 7px rgba(201,165,70,0);} }
@keyframes riqTimer { from { width: 100%; } to { width: 0%; } }
@keyframes riqFadeUp { from { opacity:0; transform: translateY(10px);} to { opacity:1; transform:none; } }
@keyframes riqMuck { 0% { opacity: 1; transform: none; } 55% { opacity: .85; transform: translateY(10px) rotate(8deg); } 100% { opacity: 0; transform: translateY(26px) rotate(14deg) scale(.8); } }
@keyframes riqChipIn { from { opacity: 0; transform: translate(-50%, -8px) scale(.4); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
@keyframes riqShimmer { 0%, 100% { opacity: .35; } 50% { opacity: .7; } }
@keyframes riqCount { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes riqActionLabel { 0% { opacity:0; transform:translateY(-3px); } 10% { opacity:1; transform:translateY(0); } 85% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(0); } }
@keyframes riqResultIn { 0% { opacity:0; transform:scale(.92); } 100% { opacity:1; transform:scale(1); } }
@keyframes riqCardFlip { from { transform: perspective(600px) rotateY(90deg); opacity:.8; } to { transform: perspective(600px) rotateY(0deg); opacity:1; } }
@keyframes riqTimerGlowLow  { 0%,100% { box-shadow:none; } 50% { box-shadow: 0 0 6px 2px rgba(255,140,0,.45); } }
@keyframes riqTimerGlowMed  { 0%,100% { box-shadow:none; } 50% { box-shadow: 0 0 11px 3px rgba(255,80,0,.72); } }
@keyframes riqTimerGlowHigh { 0%,100% { box-shadow:none; } 50% { box-shadow: 0 0 18px 5px rgba(255,30,0,.96); } }
@keyframes riqBeckon { 0%,100% { box-shadow: 0 0 0 0 rgba(201,165,70,.55), inset 0 0 0 rgba(201,165,70,0); } 50% { box-shadow: 0 0 0 9px rgba(201,165,70,0), inset 0 0 12px rgba(201,165,70,.25); } }
@keyframes riqMissed { 0%,100% { box-shadow: inset 0 0 3px rgba(194,69,62,.18); } 50% { box-shadow: inset 0 0 9px rgba(194,69,62,.5); } }
@keyframes riqStamp { 0% { opacity: 0; transform: scale(1.6) rotate(-14deg); } 60% { opacity: 1; transform: scale(.92) rotate(-11deg); } 100% { transform: scale(1) rotate(-11deg); opacity: 1; } }
@keyframes riqScreenIn { 0% { opacity: 0; filter: blur(8px); transform: translateY(20px); } 100% { opacity: 1; filter: blur(0); transform: none; } }
@keyframes riqBgDrift0 { 0%,100% { transform: translate(0%,0%); } 25% { transform: translate(4%,-9%); } 60% { transform: translate(-5%,6%); } 80% { transform: translate(3%,-4%); } }
@keyframes riqBgDrift1 { 0%,100% { transform: translate(0%,0%); } 30% { transform: translate(-6%,7%); } 55% { transform: translate(5%,-5%); } 80% { transform: translate(-3%,3%); } }
@keyframes riqBgDrift2 { 0%,100% { transform: translate(0%,0%); } 20% { transform: translate(5%,4%); } 50% { transform: translate(-4%,-7%); } 75% { transform: translate(3%,6%); } }
@keyframes riqFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-16px); } }
@keyframes riqHeartBreak { 0% { transform: scale(1); filter: none; } 18% { transform: scale(1.5); filter: brightness(1.5); } 40% { transform: scale(1.1) rotate(-18deg); } 65% { transform: scale(0.7) rotate(14deg); opacity: .6; } 100% { transform: scale(0) rotate(25deg); opacity: 0; } }
@keyframes riqWrongShake { 0%,100% { transform: translateX(0); } 14% { transform: translateX(-10px); } 30% { transform: translateX(9px); } 46% { transform: translateX(-7px); } 62% { transform: translateX(5px); } 78% { transform: translateX(-3px); } 92% { transform: translateX(2px); } }
@keyframes riqRedFlash { 0% { opacity: .75; } 100% { opacity: 0; } }
@keyframes riqChipFloat { 0% { opacity: 1; transform: translateY(0) scale(1); } 70% { opacity: 1; transform: translateY(-56px) scale(1.08); } 100% { opacity: 0; transform: translateY(-76px) scale(.9); } }
@keyframes riqComboStamp { 0% { opacity: 0; transform: translateX(-50%) scale(1.8); } 18% { opacity: 1; transform: translateX(-50%) scale(.93); } 72% { opacity: 1; transform: translateX(-50%) scale(1); } 100% { opacity: 0; transform: translateX(-50%) scale(.96); } }
@keyframes riqScreenShake { 0%,100% { transform: translateX(0); } 12% { transform: translateX(-5px); } 28% { transform: translateX(5px); } 44% { transform: translateX(-4px); } 60% { transform: translateX(4px); } 76% { transform: translateX(-2px); } 90% { transform: translateX(2px); } }
@keyframes riqGoldParticle { 0% { opacity: 1; transform: translate(0,0) scale(1); } 100% { opacity: 0; transform: translate(var(--px,0px),var(--py,0px)) scale(.2); } }
@keyframes riqComboBounce { 0% { transform: scale(1); } 28% { transform: scale(1.6); } 58% { transform: scale(.88); } 80% { transform: scale(1.08); } 100% { transform: scale(1); } }
@keyframes riqFlawlessBorder { 0%,100% { box-shadow: 0 0 0 0 rgba(201,165,70,.3), 0 0 28px rgba(201,165,70,.12); } 50% { box-shadow: 0 0 0 5px rgba(201,165,70,.28), 0 0 55px rgba(201,165,70,.28); } }
@keyframes riqHeartbeatIn { 0% { opacity: 0; transform: scale(.82); } 38% { transform: scale(1.06); opacity: 1; } 62% { transform: scale(.97); } 100% { transform: scale(1); } }
@keyframes riqChipRoll { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes riqFlameFlicker { 0%,100% { transform: scale(1) rotate(-2deg); } 30% { transform: scale(1.12) rotate(2deg); } 60% { transform: scale(.95) rotate(-1deg); } 80% { transform: scale(1.06) rotate(1deg); } }
@keyframes riqToastIn { 0% { opacity: 0; transform: translate(-50%, 24px); } 10% { opacity: 1; transform: translate(-50%, 0); } 88% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, -10px); } }
@keyframes riqClaimPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(201,165,70,.55); } 50% { box-shadow: 0 0 0 7px rgba(201,165,70,0); } }
@keyframes riqStartFloat { 0%,100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, -6px); } }
@keyframes riqConfetti { 0% { opacity: 1; transform: translateY(-10px) rotate(0deg); } 100% { opacity: 0; transform: translateY(130px) rotate(320deg); } }
@keyframes riqOverlayIn { 0% { opacity: 0; } 100% { opacity: 1; } }
@keyframes riqBigPop { 0% { transform: scale(.4); opacity: 0; } 55% { transform: scale(1.15); opacity: 1; } 75% { transform: scale(.96); } 100% { transform: scale(1); } }
@keyframes riqDotBlink { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
.riq .deal { animation: riqDealIn .28s ease both; }
.riq .fadeup { animation: riqFadeUp .35s ease both; }
.riq .screen-in { animation: riqScreenIn 0.52s cubic-bezier(0.16,1,0.3,1) both; }
.riq ::-webkit-scrollbar { display: none; }
.riq * { scrollbar-width: none; }
/* felt grain: a faint repeating weave so the table never reads as a flat gradient */
.riq .felt-grain { position: relative; }
.riq .felt-grain::after { content: ""; position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
  background-image: repeating-linear-gradient(45deg, rgba(255,255,255,.014) 0 1px, transparent 1px 3px), repeating-linear-gradient(-45deg, rgba(0,0,0,.04) 0 1px, transparent 1px 3px);
  mix-blend-mode: overlay; }
/* ── Green Glass panel utility ── */
.riq .gp { backdrop-filter: blur(22px) saturate(160%); -webkit-backdrop-filter: blur(22px) saturate(160%); box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.32), inset 0 1px 0 rgba(201,165,70,0.07); }
/* Ambient green orbs */
.riq .orb { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(72px); z-index: 0; }
@media (prefers-reduced-motion: reduce) { .riq * { animation: none !important; transition: none !important; } }
/* Responsive shell: phone fills edge-to-edge; laptop/desktop centers a framed table with ambient felt around it. */
@media (min-width: 480px) {
  .riq .app-shell { height: min(100dvh, 920px) !important; border-radius: 20px; border: 1px solid rgba(201,165,70,.14); box-shadow: 0 30px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(0,0,0,.5); }
  .riq .app-root { padding: 24px; }
}
@media (min-width: 480px) and (max-height: 940px) {
  .riq .app-root { align-items: center; }
}
.riq input[type=range] { -webkit-appearance:none; width:100%; height:4px; border-radius:2px; background:rgba(201,165,70,0.1); }
.riq input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:20px; height:20px; border-radius:50%; background:${"#C9A546"}; border:2px solid #0C1F16; }
`;

/* ============================ CARDS & EVALUATOR ============================ */
const SUIT_GLYPH = ["♠", "♥", "♦", "♣"];
const SUIT_RED = [false, true, true, false];
const rankLabel = (r) => (r <= 10 ? String(r) : { 11: "J", 12: "Q", 13: "K", 14: "A" }[r]);
const cardKey = (c) => c.r + "-" + c.s;

function newDeck() {
  const d = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s });
  return d;
}
function shuffle(deck) {
  const a = [...deck];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Score a 5-card hand into a single comparable integer.
function evaluate5(cs) {
  const rs = cs.map((c) => c.r).sort((a, b) => b - a);
  const flush = cs.every((c) => c.s === cs[0].s);
  const uniq = [...new Set(rs)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) straightHigh = 5;
  }
  const counts = {};
  rs.forEach((r) => (counts[r] = (counts[r] || 0) + 1));
  const groups = Object.entries(counts)
    .map(([r, c]) => ({ r: +r, c }))
    .sort((a, b) => b.c - a.c || b.r - a.r);
  let cat, tie;
  if (straightHigh && flush) { cat = 8; tie = [straightHigh]; }
  else if (groups[0].c === 4) { cat = 7; tie = [groups[0].r, groups[1].r]; }
  else if (groups[0].c === 3 && groups[1].c === 2) { cat = 6; tie = [groups[0].r, groups[1].r]; }
  else if (flush) { cat = 5; tie = rs; }
  else if (straightHigh) { cat = 4; tie = [straightHigh]; }
  else if (groups[0].c === 3) { cat = 3; tie = [groups[0].r, groups[1].r, groups[2].r]; }
  else if (groups[0].c === 2 && groups[1].c === 2) { cat = 2; tie = [groups[0].r, groups[1].r, groups[2].r]; }
  else if (groups[0].c === 2) { cat = 1; tie = [groups[0].r, groups[1].r, groups[2].r, groups[3].r]; }
  else { cat = 0; tie = rs; }
  let score = cat;
  for (let i = 0; i < 5; i++) score = score * 15 + (tie[i] || 0);
  return score;
}
// Best score from 5, 6 or 7 cards.
function bestScore(cards) {
  const n = cards.length;
  if (n === 5) return evaluate5(cards);
  let best = -1;
  if (n === 6) {
    for (let i = 0; i < 6; i++) {
      const s = evaluate5(cards.filter((_, k) => k !== i));
      if (s > best) best = s;
    }
    return best;
  }
  for (let i = 0; i < 6; i++)
    for (let j = i + 1; j < 7; j++) {
      const s = evaluate5(cards.filter((_, k) => k !== i && k !== j));
      if (s > best) best = s;
    }
  return best;
}
const CAT_NAMES = ["High card", "Pair", "Two pair", "Three of a kind", "Straight", "Flush", "Full house", "Four of a kind", "Straight flush"];
const scoreCat = (s) => Math.floor(s / Math.pow(15, 5));
function handName(hero, board) {
  if (board.length === 0) {
    const [a, b] = [...hero].sort((x, y) => y.r - x.r);
    if (a.r === b.r) return "Pocket " + rankLabel(a.r) + "s";
    return rankLabel(a.r) + rankLabel(b.r) + (a.s === b.s ? " suited" : " offsuit");
  }
  return CAT_NAMES[scoreCat(bestScore([...hero, ...board]))];
}
// Monte Carlo equity vs n random opponents.
function equityMC(hero, board, nOpp, iters) {
  if (nOpp <= 0) return 1;
  const used = new Set([...hero, ...board].map(cardKey));
  const rest = newDeck().filter((c) => !used.has(cardKey(c)));
  let pts = 0;
  for (let t = 0; t < iters; t++) {
    const d = shuffle(rest);
    let k = 0;
    const opps = [];
    for (let o = 0; o < nOpp; o++) opps.push([d[k++], d[k++]]);
    const full = [...board];
    while (full.length < 5) full.push(d[k++]);
    const hs = bestScore([...hero, ...full]);
    let lost = false, tied = false;
    for (const o of opps) {
      const os = bestScore([...o, ...full]);
      if (os > hs) { lost = true; break; }
      if (os === hs) tied = true;
    }
    if (!lost) pts += tied ? 0.5 : 1;
  }
  return pts / iters;
}
// Chen formula for preflop hand strength.
function chenScore(c1, c2) {
  const hi = Math.max(c1.r, c2.r), lo = Math.min(c1.r, c2.r);
  const val = (r) => (r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2);
  let s = val(hi);
  if (c1.r === c2.r) return Math.max(5, s * 2) + (hi >= 11 ? 2 : 0);
  if (c1.s === c2.s) s += 2;
  const gap = hi - lo - 1;
  if (gap === 1) s -= 1; else if (gap === 2) s -= 2; else if (gap === 3) s -= 4; else if (gap >= 4) s -= 5;
  if (gap < 2 && hi < 12) s += 1;
  return Math.round(s * 2) / 2;
}

/* ============================ AI OPPONENT ============================ */
const AI_NAMES = ["Marta", "Deshawn", "Yuki", "Olive", "Rasheed"];
const AI_STYLES = [
  { agg: 0.9, loose: 0.9, bluff: 0.06 },  // tight-passive
  { agg: 1.25, loose: 1.0, bluff: 0.12 }, // solid reg
  { agg: 1.5, loose: 1.25, bluff: 0.18 }, // lag
  { agg: 0.8, loose: 1.35, bluff: 0.05 }, // calling station
  { agg: 1.15, loose: 0.85, bluff: 0.1 }, // nit
];
// Named personality archetypes. Each session, every seat is randomly dealt one of these,
// so opponents never line up the same way twice. Tiers draw from pools of increasing skill.
const PERSONALITIES = {
  loose_passive: { tag: "calling station", agg: 0.6, loose: 1.55, bluff: 0.03 },
  loose_aggressive: { tag: "maniac", agg: 1.7, loose: 1.45, bluff: 0.22 },
  tight_passive: { tag: "rock", agg: 0.8, loose: 0.7, bluff: 0.04 },
  tight_aggressive: { tag: "shark", agg: 1.5, loose: 0.8, bluff: 0.14 },
  balanced_reg: { tag: "solid reg", agg: 1.2, loose: 1.0, bluff: 0.11 },
  tricky: { tag: "tricky", agg: 1.35, loose: 1.1, bluff: 0.18 },
  nit: { tag: "nit", agg: 1.0, loose: 0.6, bluff: 0.05 },
  splashy: { tag: "splashy", agg: 1.15, loose: 1.35, bluff: 0.09 },
  abc: { tag: "straightforward", agg: 1.05, loose: 0.9, bluff: 0.07 },
  bully: { tag: "table bully", agg: 1.6, loose: 1.1, bluff: 0.2 },
};
const TIER_POOLS = {
  1: ["loose_passive", "loose_passive", "splashy", "tight_passive", "abc", "loose_aggressive"], // home game: mostly loose and passive
  2: ["balanced_reg", "tight_aggressive", "abc", "splashy", "tricky", "nit", "loose_aggressive"], // regulars: mixed, competent
  3: ["tight_aggressive", "tight_aggressive", "tricky", "bully", "balanced_reg", "loose_aggressive"], // sharks: tough, aggressive
};
const NAME_POOL = ["Marta", "Deshawn", "Yuki", "Olive", "Rasheed", "Vera", "Klaus", "Niko", "Sable", "Ortiz", "Pinky", "Gus", "Bobo", "Trish", "Lalu", "Mei", "Hassan", "Dana", "Cole", "Priya"];
function shuffleArr(a, rng) {
  const r = rng || Math.random;
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
// Build 5 opponents for a tier, each with a random personality and a small per-seat jitter
// so even the same archetype plays a little differently from table to table.
function buildOpponents(tierId, rng) {
  const r = rng || Math.random;
  const poolKey = TIER_POOLS[tierId] ? tierId : 2;
  const archetypes = shuffleArr(TIER_POOLS[poolKey], r).slice(0, 5);
  while (archetypes.length < 5) archetypes.push(TIER_POOLS[poolKey][0]);
  const names = shuffleArr(NAME_POOL, r).slice(0, 5);
  return archetypes.map((key, i) => {
    const base = PERSONALITIES[key] || PERSONALITIES.balanced_reg;
    const jit = (range) => 1 + (r() * 2 - 1) * range;
    return {
      name: names[i],
      stack: START_STACK,
      persona: key,
      personaTag: base.tag,
      style: {
        agg: Math.max(0.4, base.agg * jit(0.12)),
        loose: Math.max(0.5, base.loose * jit(0.1)),
        bluff: Math.max(0.01, Math.min(0.3, base.bluff * jit(0.2))),
      },
    };
  });
}
const BOT_TIERS = [
  { id: 1, name: "The Home Game", riq: 0, desc: "They call everything. Stop bluffing and bet your good hands bigger." },
  { id: 2, name: "The Regulars", riq: 1150, desc: "They think. No more free chips. Earn every pot." },
  { id: 3, name: "The Sharks", riq: 1500, desc: "They bluff with a plan and punish every mistake. Tighten up." },
];
function potTotal(g) { return g.players.reduce((s, p) => s + p.committed, 0); }

function decideAI(g, idx) {
  const p = g.players[idx];
  const style = p.style;
  const toCall = g.currentBet - p.bet;
  const pot = potTotal(g);
  const minRaiseTo = g.currentBet + g.minRaise;
  const maxTo = p.bet + p.stack;
  const raiseTo = (target) => ({ type: "raise", amount: Math.min(maxTo, Math.max(minRaiseTo, Math.round(target))) });

  if (g.street === "preflop") {
    const ch = chenScore(p.cards[0], p.cards[1]) * style.loose;
    const facingRaise = g.currentBet > BB;
    // count limpers: players (other than blinds) who have only called the BB
    const limpers = g.players.filter((q, qi) => qi !== idx && !q.folded && q.bet === BB && qi !== (g.button + 2) % 6).length;
    // Standard sizing anchored to the big blind, NOT the pot.
    const openTo = BB * 2.5 + limpers * BB;          // 2.5bb + 1bb per limper
    const threeBetTo = g.currentBet * 3;             // 3x the raise we're facing
    const loose = style.loose;                       // >1 = looser, calls and plays more hands
    if (toCall <= 0) {
      // option in the BB or limped pot: raise good hands, otherwise check
      if (ch >= 9 && Math.random() < 0.8 * style.agg) return raiseTo(openTo);
      return { type: "check" };
    }
    if (!facingRaise) {
      // unopened or limped pot. Loose players come in with a much wider range.
      if (ch >= 8 || (ch >= 6.5 && Math.random() < 0.5)) return raiseTo(openTo);
      // limp/call threshold scales with looseness: a calling station limps almost anything playable
      const callFloor = loose >= 1.3 ? 2.5 : loose >= 1.0 ? 4 : 5.5;
      if (ch >= callFloor && toCall <= BB * 1.5) return { type: "call" };
      if (Math.random() < style.bluff * 0.5) return raiseTo(openTo);
      return { type: "fold" };
    }
    // facing a raise. Loose players defend wider; tight players fold most hands.
    if (ch >= 11 && Math.random() < 0.7) return raiseTo(threeBetTo);
    const flatFloor = loose >= 1.3 ? 5.5 : loose >= 1.0 ? 7 : 8.5;
    const flatCap = loose >= 1.3 ? p.stack * 0.22 : BB * 5;
    if (ch >= 8.5 && toCall <= p.stack * 0.18) return { type: "call" };
    if (ch >= flatFloor && toCall <= flatCap && Math.random() < (loose >= 1.3 ? 0.8 : 0.6)) return { type: "call" };
    if (Math.random() < style.bluff * 0.4 && toCall <= BB * 4) return raiseTo(threeBetTo);
    return { type: "fold" };
  }
  // Postflop: cheap equity estimate vs one random hand.
  const eq = equityMC(p.cards, g.board, 1, 60);
  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
  if (toCall <= 0) {
    if (eq > 0.66 && Math.random() < 0.85 * style.agg) return raiseTo(pot * (0.5 + Math.random() * 0.35));
    if (eq < 0.38 && Math.random() < style.bluff) return raiseTo(pot * 0.6);
    return { type: "check" };
  }
  if (eq > 0.8 && Math.random() < 0.8) return raiseTo(g.currentBet + pot * 0.75);
  if (eq > potOdds + 0.04) return { type: "call" };
  if (eq > 0.3 && toCall <= pot * 0.2 && Math.random() < 0.55 * style.loose) return { type: "call" };
  if (Math.random() < style.bluff * 0.35 && p.stack > pot) return raiseTo(g.currentBet + pot * 0.6);
  return { type: "fold" };
}


/* ============================ SUPABASE BACKEND ============================ */
const SUPABASE_URL = "https://oulxmmijmtmbdubyjuvx.supabase.co";
const SUPABASE_KEY = "sb_publishable_VDB4PlLXlaapMW0977bi-Q_1Z4f-a2_"; // publishable key, safe in frontend; RLS protects data

const Auth = { session: null };
function saveSession(s) {
  Auth.session = s;
  try { s ? localStorage.setItem("riq_session", JSON.stringify(s)) : localStorage.removeItem("riq_session"); } catch {}
}
try { const stored = localStorage.getItem("riq_session"); if (stored) Auth.session = JSON.parse(stored); } catch {}
const OAUTH_PROVIDERS = ["google"]; // add "apple" here once the Apple provider is configured in Supabase
function oauthUrl(provider) {
  const redirectTo = Capacitor.isNativePlatform()
    ? "com.riveriq.app://login-callback"
    : window.location.origin;
  return SUPABASE_URL + "/auth/v1/authorize?provider=" + provider + "&redirect_to=" + encodeURIComponent(redirectTo);
}
async function sbFetch(path, opts = {}, retry = true) {
  const res = await fetch(SUPABASE_URL + path, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
      ...(Auth.session ? { Authorization: "Bearer " + Auth.session.access_token } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401 && retry && Auth.session && Auth.session.refresh_token) {
    if (await sbRefresh()) return sbFetch(path, opts, false);
  }
  return res;
}
async function sbRefresh() {
  try {
    const r = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: Auth.session.refresh_token }),
    });
    if (!r.ok) return false;
    saveSession(await r.json());
    return true;
  } catch { return false; }
}
async function sbSignUp(email, password) {
  const r = await fetch(SUPABASE_URL + "/auth/v1/signup", { method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}
async function sbSignIn(email, password) {
  const r = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const data = await r.json().catch(() => ({}));
  if (r.ok) saveSession(data);
  return { ok: r.ok, data };
}
async function dbSelect(table, query) {
  try { const r = await sbFetch(`/rest/v1/${table}?${query}`); return r.ok ? await r.json() : []; } catch { return []; }
}
async function dbInsert(table, rows) {
  try {
    const r = await sbFetch(`/rest/v1/${table}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(rows) });
    if (!r.ok) { const e = await r.text(); console.error("[dbInsert]", table, r.status, e); return null; }
    return await r.json();
  } catch (e) { console.error("[dbInsert catch]", table, e); return null; }
}
async function dbUpsert(table, rows, conflict) {
  try {
    const r = await sbFetch(`/rest/v1/${table}?on_conflict=${conflict}`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(rows) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
async function dbUpdate(table, query, patch) {
  try {
    const r = await sbFetch(`/rest/v1/${table}?${query}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
async function dbDelete(table, query) {
  try { await sbFetch(`/rest/v1/${table}?${query}`, { method: "DELETE" }); } catch {}
}
async function ensureProfile(username) {
  const uid = Auth.session.user.id;
  const rows = await dbSelect("users", `id=eq.${uid}&select=*`);
  if (rows.length) return rows[0];
  const base = (username || "player").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) || "player";
  let made = await dbInsert("users", { id: uid, username: base, email: Auth.session.user.email });
  if (!made) made = await dbInsert("users", { id: uid, username: base + Math.floor(1000 + Math.random() * 9000), email: Auth.session.user.email });
  return made && made[0] ? made[0] : { id: uid, username: base, skill_rating: 50 };
}

/* ============================ GAME ENGINE (pure) ============================ */
function clone(g) {
  return { ...g, players: g.players.map((p) => ({ ...p })), board: [...g.board], deck: [...g.deck], log: [...g.log] };
}
function postBlind(p, amt) {
  const pay = Math.min(amt, p.stack);
  p.stack -= pay; p.bet += pay; p.committed += pay;
  if (p.stack === 0) p.allIn = true;
}
function dealHand(prevPlayers, button, handNo) {
  const deck = shuffle(newDeck());
  const players = prevPlayers.map((p) => ({
    ...p,
    stack: p.stack <= 0 ? START_STACK : p.stack,
    rebought: p.stack <= 0,
    cards: [deck.pop(), deck.pop()],
    bet: 0, committed: 0, folded: false, allIn: false, hasActed: false,
  }));
  const sb = (button + 1) % 6, bb = (button + 2) % 6;
  postBlind(players[sb], SB);
  postBlind(players[bb], BB);
  return {
    players, deck, board: [], street: "preflop", button, sbIdx: sb, bbIdx: bb,
    currentBet: BB, minRaise: BB, toAct: (button + 3) % 6,
    winners: null, wentToShowdown: false, log: [], handNo,
    heroPos: posName(0, button),
    heroStart: players[0].stack + players[0].committed,
  };
}
function nextToAct(g, from) {
  for (let i = 1; i <= 6; i++) {
    const idx = (from + i) % 6, p = g.players[idx];
    if (!p.folded && !p.allIn && (!p.hasActed || p.bet < g.currentBet)) return idx;
  }
  return -1;
}
function showdown(g) {
  g.street = "result"; g.toAct = -1; g.wentToShowdown = true;
  const results = g.players.map((p) => (p.folded ? -1 : bestScore([...p.cards, ...g.board])));
  const levels = [...new Set(g.players.filter((p) => p.committed > 0).map((p) => p.committed))].sort((a, b) => a - b);
  let prev = 0;
  const agg = {};
  for (const L of levels) {
    let amt = 0;
    g.players.forEach((p) => { amt += Math.max(0, Math.min(p.committed, L) - prev); });
    const elig = g.players.map((_, i) => i).filter((i) => !g.players[i].folded && g.players[i].committed >= L);
    if (elig.length === 0) { prev = L; continue; }
    const best = Math.max(...elig.map((i) => results[i]));
    const w = elig.filter((i) => results[i] === best);
    const share = Math.floor(amt / w.length);
    let remainder = amt - share * w.length;
    w.forEach((i) => {
      const got = share + (remainder-- > 0 ? 1 : 0);
      g.players[i].stack += got;
      agg[i] = (agg[i] || 0) + got;
    });
    prev = L;
  }
  g.winners = Object.entries(agg).map(([i, amt]) => ({ idx: +i, amt, score: results[+i] }));
  g.showdownResults = results;
  return g;
}
function endStreet(g) {
  g.players.forEach((p) => { p.bet = 0; p.hasActed = false; });
  g.currentBet = 0; g.minRaise = BB;
  const canAct = g.players.filter((p) => !p.folded && !p.allIn);
  if (g.street === "river") return showdown(g);
  if (canAct.length <= 1) {
    g.allInRevealFrom = g.board.length;
    while (g.board.length < 5) g.board.push(g.deck.pop());
    g.street = "river";
    return showdown(g);
  }
  if (g.street === "preflop") { g.board.push(g.deck.pop(), g.deck.pop(), g.deck.pop()); g.street = "flop"; }
  else if (g.street === "flop") { g.board.push(g.deck.pop()); g.street = "turn"; }
  else if (g.street === "turn") { g.board.push(g.deck.pop()); g.street = "river"; }
  g.toAct = nextToAct(g, g.button);
  if (g.toAct === -1) return endStreet(g);
  return g;
}
// act: {type:'fold'|'check'|'call'|'raise', amount?, meta?}
function applyAction(prev, idx, act, meta) {
  const g = clone(prev);
  const p = g.players[idx];
  if (g.street === "result" || g.toAct !== idx) return prev;
  const toCall = g.currentBet - p.bet;
  let entry = { street: g.street, idx, type: act.type, potBefore: potTotal(g), toCall, board: g.board.length, ...(meta || {}) };
  if (act.type === "fold") p.folded = true;
  else if (act.type === "check") { /* no-op */ }
  else if (act.type === "call") {
    const pay = Math.min(toCall, p.stack);
    p.stack -= pay; p.bet += pay; p.committed += pay;
    entry.amount = pay;
    if (p.stack === 0) p.allIn = true;
  } else if (act.type === "raise") {
    const target = Math.min(act.amount, p.bet + p.stack);
    const pay = target - p.bet;
    p.stack -= pay; p.bet = target; p.committed += pay;
    entry.amount = target;
    if (p.stack === 0) p.allIn = true;
    if (target > g.currentBet) {
      g.minRaise = Math.max(g.minRaise, target - g.currentBet);
      g.currentBet = target;
      g.players.forEach((q, qi) => { if (qi !== idx) q.hasActed = false; });
    }
  }
  p.hasActed = true;
  g.log.push(entry);
  const unfolded = g.players.filter((q) => !q.folded);
  if (unfolded.length === 1) {
    const wIdx = g.players.findIndex((q) => !q.folded);
    const amt = potTotal(g);
    g.players[wIdx].stack += amt;
    g.winners = [{ idx: wIdx, amt, score: null }];
    g.street = "result"; g.toAct = -1; g.wentToShowdown = false;
    return g;
  }
  const nxt = nextToAct(g, idx);
  if (nxt === -1) return endStreet(g);
  g.toAct = nxt;
  return g;
}

/* ============================ ANALYTICS ENGINE (pure math, no AI) ============================ */
const POS_FROM_BTN = ["BTN", "SB", "BB", "UTG", "HJ", "CO"];
const posName = (idx, button) => POS_FROM_BTN[((idx - button) % 6 + 6) % 6];
const POS_LABEL = { UTG: "first to act", HJ: "an early-middle seat", CO: "the cutoff", BTN: "the button", SB: "the small blind", BB: "the big blind" };
const codeLabel = (r) => (r === 10 ? "T" : rankLabel(r));
function handCode(c1, c2) {
  const hi = c1.r >= c2.r ? c1 : c2, lo = c1.r >= c2.r ? c2 : c1;
  if (hi.r === lo.r) return codeLabel(hi.r) + codeLabel(lo.r);
  return codeLabel(hi.r) + codeLabel(lo.r) + (hi.s === lo.s ? "s" : "o");
}
// Expand range notation like "77+ ATs+ KQo JTs" into a Set of hand codes.
function expandRange(str) {
  const order = "23456789TJQKA";
  const set = new Set();
  str.split(/\s+/).forEach((tok) => {
    if (!tok) return;
    const plus = tok.endsWith("+");
    const t = plus ? tok.slice(0, -1) : tok;
    if (t.length === 2 && t[0] === t[1]) {
      let i = order.indexOf(t[0]);
      do { set.add(order[i] + order[i]); i++; } while (plus && i < 13);
    } else {
      const hi = t[0], suf = t[2];
      let i = order.indexOf(t[1]);
      const hiIdx = order.indexOf(hi);
      do { set.add(hi + order[i] + suf); i++; } while (plus && i < hiIdx);
    }
  });
  return set;
}
// 6-max opening ranges by position (standard solver-derived charts, simplified for play-money stacks)
const OPEN_RANGE = {
  UTG: expandRange("77+ ATs+ KTs+ QTs+ JTs T9s 98s AJo+ KQo"),
  HJ: expandRange("66+ A9s+ KTs+ QTs+ J9s+ T9s 98s 87s ATo+ KJo+ QJo"),
  CO: expandRange("44+ A2s+ K9s+ Q9s+ J9s+ T8s+ 97s+ 87s 76s 65s A9o+ KTo+ QTo+ JTo"),
  BTN: expandRange("22+ A2s+ K2s+ Q5s+ J7s+ T7s+ 96s+ 86s+ 75s+ 65s 54s A2o+ K9o+ Q9o+ J9o+ T9o 98o"),
  SB: expandRange("22+ A2s+ K5s+ Q7s+ J8s+ T8s+ 97s+ 87s 76s 65s A7o+ K9o+ Q9o+ JTo"),
};
const OPEN_PCT = { UTG: 0.15, HJ: 0.19, CO: 0.27, BTN: 0.43, SB: 0.36 };
// Percentile rank of every starting hand (0 = best), weighted by combo counts.
const HAND_PCT = (() => {
  const order = "23456789TJQKA";
  const rOf = (ch) => order.indexOf(ch) + 2;
  const items = [];
  for (let i = 12; i >= 0; i--) for (let j = i; j >= 0; j--) {
    const hiR = rOf(order[i]), loR = rOf(order[j]);
    if (i === j) items.push({ code: order[i] + order[j], combos: 6, chen: chenScore({ r: hiR, s: 0 }, { r: loR, s: 1 }) });
    else {
      items.push({ code: order[i] + order[j] + "s", combos: 4, chen: chenScore({ r: hiR, s: 0 }, { r: loR, s: 0 }) });
      items.push({ code: order[i] + order[j] + "o", combos: 12, chen: chenScore({ r: hiR, s: 0 }, { r: loR, s: 1 }) });
    }
  }
  items.sort((a, b) => b.chen - a.chen);
  const total = items.reduce((s, x) => s + x.combos, 0);
  let cum = 0;
  const map = {};
  items.forEach((x) => { map[x.code] = cum / total; cum += x.combos; });
  return map;
})();

/* ---------- Rule catalog: every leak in plain language ---------- */
const RULESET = {};
["UTG", "HJ", "CO", "BTN", "SB"].forEach((p) => {
  RULESET["open_" + p] = {
    title: p === "UTG" || p === "HJ" ? "Playing weak hands from early seats" : "Opening too loose from " + (p === "SB" ? "the small blind" : p === "BTN" ? "the button" : "the cutoff"),
    why: "From " + POS_LABEL[p] + ", weak starting hands lose money before the flop ever helps them.",
    fix: "From this seat, stick to pairs, strong aces, and two big cards. When in doubt, fold and wait.",
    module: "pre-1",
  };
});
["flop", "turn", "river"].forEach((s) => {
  RULESET["call_noodds_" + s] = {
    title: "Paying too much to chase on the " + s,
    why: "The call cost more than your hand's chance of winning was worth.",
    fix: "Quick check before calling: if the bet is big and your hand needs help, the math is usually against you.",
    module: "size-1",
  };
  RULESET["overfold_" + s] = {
    title: "Giving up winning hands on the " + s,
    why: "You folded when the pot was offering you a profitable price to continue.",
    fix: "When the bet is small compared to the pot, even a medium hand is often worth a call.",
    module: "range-1",
  };
  RULESET["missed_value_" + s] = {
    title: "Leaving money on the table on the " + s,
    why: "You had a big hand and gave free cards instead of building the pot.",
    fix: "Strong hands want action, bet about half the pot and let worse hands pay you.",
    module: "post-1",
  };
});
Object.assign(RULESET, {
  limp: { title: "Just calling before the flop", why: "Calling the minimum invites everyone in, and you can only win by hitting the board.", fix: "Simple rule: if a hand is worth playing, raise. If it isn't worth a raise, fold it.", module: "pre-2" },
  sb_loose: { title: "Calling too much from the small blind", why: "You're out of position the whole hand with a weak holding, a money leak even for pros.", fix: "From the small blind, raise your good hands and fold the rest. Avoid the in-between call.", module: "pre-1" },
  vs_raise_loose: { title: "Calling raises with weak hands", why: "When someone raises, they usually have it, weak hands mostly just donate.", fix: "Against a raise, you want a hand you'd happily re-raise or a pair/suited connector that can flop big.", module: "range-1" },
  fold_premium: { title: "Folding monster hands too early", why: "Hands this strong only come a few times an hour, folding them gives away your biggest edges.", fix: "Big pairs and ace-king want to raise and re-raise, not fold to pressure before the flop.", module: "pre-2" },
  light_3bet: { title: "Re-raising with so-so hands", why: "Medium hands play badly in re-raised pots, you build a big pot without a big hand.", fix: "Re-raise your monsters; just call with the decent-but-not-great hands.", module: "pre-2" },
  vpip_high: { title: "Playing too many hands overall", why: "Most starting hands lose money. Playing extra ones bleeds chips slowly all session.", fix: "Aim to play roughly 1 in 4 hands. Boredom folds the rest.", module: "pre-1" },
  passive_pre: { title: "Calling when you should be raising", why: "Raisers win pots two ways, by the best hand or by everyone folding. Callers only get one.", fix: "Enter pots with a raise. It puts the pressure on them instead of you.", module: "pre-2" },
  overbluff: { title: "Bluffing too often", why: "Against casual opponents who love to call, frequent bluffs are just donations.", fix: "Cap yourself at a couple of well-chosen bluffs per session, ones where you can say what hand you're pretending to have.", module: "bluff-1" },
});

/* ---------- Per-decision assessment (runs the moment you act) ---------- */
function assessHero(g, act, eq) {
  const hero = g.players[0];
  const toCall = Math.max(0, g.currentBet - hero.bet);
  const pot = potTotal(g);
  const meta = { eq, potOdds: toCall > 0 ? toCall / (pot + toCall) : 0, evLoss: 0, tag: null, ruleId: null, better: null, estimate: false };
  if (g.street === "preflop") {
    const pos = posName(0, g.button);
    const code = handCode(hero.cards[0], hero.cards[1]);
    const pct = HAND_PCT[code] ?? 0.8;
    const facingRaise = g.currentBet > BB;
    if (!facingRaise) {
      const range = OPEN_RANGE[pos];
      const inR = range ? range.has(code) : true;
      if (act.type === "raise" && range && !inR) {
        meta.tag = "loose_open"; meta.ruleId = "open_" + pos;
        meta.evLoss = Math.min(3, Math.max(0.4, (pct - (OPEN_PCT[pos] || 0.3)) * 6));
        meta.better = "fold and wait for a better spot";
      } else if (act.type === "call" && pos !== "BB" && pos !== "SB") {
        meta.tag = "limp"; meta.ruleId = "limp"; meta.evLoss = 0.5;
        meta.better = inR ? "raise, this hand is worth playing properly" : "fold";
      } else if (act.type === "call" && pos === "SB" && !(range && range.has(code))) {
        meta.tag = "loose_call_pre"; meta.ruleId = "sb_loose"; meta.evLoss = 0.5; meta.better = "fold";
      } else if (act.type === "fold" && pct <= 0.05 && toCall <= BB * 4) {
        meta.tag = "fold_premium"; meta.ruleId = "fold_premium"; meta.evLoss = 2; meta.better = "raise";
      }
    } else {
      if ((act.type === "call") && pct > 0.22 && toCall > BB) {
        meta.tag = "loose_call_pre"; meta.ruleId = "vs_raise_loose";
        meta.evLoss = Math.min(2.5, 0.4 + (pct - 0.22) * 5); meta.better = "fold";
      } else if (act.type === "fold" && pct <= 0.035) {
        meta.tag = "fold_premium"; meta.ruleId = "fold_premium"; meta.evLoss = 2.2; meta.better = "re-raise";
      } else if (act.type === "raise" && pct > 0.25) {
        meta.tag = "light_3bet"; meta.ruleId = "light_3bet";
        meta.evLoss = Math.min(4, 1 + (pct - 0.25) * 4); meta.better = "fold, re-raising with a weak hand builds a pot you don't want";
      } else if (act.type === "raise" && pct > 0.12) {
        meta.tag = "light_3bet"; meta.ruleId = "light_3bet"; meta.evLoss = 0.4; meta.better = "just call";
      } else if (act.type === "fold" && pct <= 0.05 && toCall <= BB * 5) {
        meta.tag = "fold_premium"; meta.ruleId = "fold_premium"; meta.evLoss = 1.2; meta.better = "call or re-raise";
      }
    }
    return meta;
  }
  // Postflop: exact price math from the equity engine
  if (toCall > 0) {
    const evCall = eq * (pot + toCall) - toCall; // in chips
    if (act.type === "call" && evCall < -0.25 * BB) {
      meta.tag = "loose_call"; meta.ruleId = "call_noodds_" + g.street;
      meta.evLoss = Math.min(6, -evCall / BB); meta.better = "fold";
    } else if (act.type === "fold" && evCall > 0.5 * BB) {
      meta.tag = "bad_fold"; meta.ruleId = "overfold_" + g.street;
      meta.evLoss = Math.min(6, evCall / BB); meta.better = "call";
    } else if (act.type === "raise" && eq < 0.3) {
      meta.tag = "bluff"; meta.ruleId = "bluff_" + g.street;
      const riskBB = Math.min(act.amount - hero.bet, hero.stack) / BB;
      meta.evLoss = Math.min(4, Math.max(0, 0.3 * riskBB * ((0.45 - eq) / 0.45)));
      meta.estimate = true; meta.better = "fold, this raise risks a lot with little to back it";
    }
  } else {
    if (act.type === "check" && eq > 0.72) {
      meta.tag = "missed_value"; meta.ruleId = "missed_value_" + g.street;
      meta.evLoss = Math.min(2.5, Math.max(0.3, (0.3 * pot * (eq - 0.55)) / BB));
      meta.better = "bet about half the pot"; meta.estimate = true;
    } else if (act.type === "raise" && eq < 0.3) {
      meta.tag = "bluff"; meta.ruleId = "bluff_" + g.street;
      const riskBB = Math.min(act.amount - hero.bet, hero.stack) / BB;
      meta.evLoss = Math.min(3, Math.max(0, 0.2 * riskBB * ((0.45 - eq) / 0.45)));
      meta.estimate = true; meta.better = "check, keep the pot small with a weak hand";
    }
  }
  return meta;
}

/* ---------- Exact aggression scoring vs the bots' real decision code ---------- */
function scoreAggression(g, act, eq) {
  const idxs = g.players.map((p, i) => i).filter((i) => i !== 0 && !g.players[i].folded && !g.players[i].allIn);
  if (!idxs.length) return null;
  const hero = g.players[0];
  const target = Math.min(act.amount || 0, hero.bet + hero.stack);
  const bet = target - hero.bet;
  if (bet <= 0) return null;
  const g2 = clone(g);
  const h2 = g2.players[0];
  h2.stack -= bet; h2.bet = target; h2.committed += bet;
  if (target > g2.currentBet) { g2.minRaise = Math.max(g2.minRaise, target - g.currentBet); g2.currentBet = target; }
  let pAllFold = 1;
  idxs.forEach((i) => {
    let folds = 0; const N = 25;
    for (let t = 0; t < N; t++) { if (decideAI({ ...g2, toAct: i }, i).type === "fold") folds++; }
    pAllFold *= folds / N;
  });
  const pot = potTotal(g);
  const ev = pAllFold * pot + (1 - pAllFold) * (eq * (pot + 2 * bet) - bet);
  return { pAllFold, evBB: ev / BB, betBB: bet / BB };
}

/* ---------- Confidence wording (stats stay backstage) ---------- */
function freqZ(phat, p0, n) { return n > 0 ? (phat - p0) / Math.sqrt((p0 * (1 - p0)) / n) : 0; }
function confFromCount(c) { return c >= 3 ? "Clear pattern" : c === 2 ? "Likely a habit" : "Seen once, watching it"; }
function confFromZ(z, n) { return n >= 30 && z >= 2.3 ? "Clear pattern" : n >= 12 && z >= 1.3 ? "Likely a habit" : "Might be luck, watching it"; }

/* ---------- Drill book ---------- */
function familyOf(id) {
  if (!id) return "general";
  if (id.startsWith("open_") || id === "vpip_high" || id === "limp" || id === "sb_loose") return "pre";
  if (id.startsWith("call_noodds") || id === "vs_raise_loose") return "price";
  if (id.startsWith("overfold") || id === "fold_premium") return "defense";
  if (id.startsWith("missed_value")) return "value";
  if (id === "passive_pre" || id === "light_3bet") return "aggression";
  if (id.startsWith("bluff") || id === "overbluff") return "bluff";
  return "general";
}
const DRILL_BOOK = {
  pre: { goal: "Play fewer, better hands", steps: ["For the next 20 hands, only play pairs, suited aces, and two cards Ten or higher. Fold everything else, no exceptions.", "Before acting, name your seat out loud. In the first two seats, fold anything you wouldn't happily re-raise with."], check: (s) => s.vpip <= 30, checkText: "play fewer than 30% of hands", module: "pre-1" },
  price: { goal: "Stop paying bad prices", steps: ["Before every call, compare the bet to the pot. If the call is more than a third of the pot, you need a real hand or a big draw.", "Run the pot-odds drill in Learn until the three magic numbers (25 / 28 / 33) are automatic."], check: (s) => s.looseCalls <= 1, checkText: "make at most 1 overpriced call", module: "size-1" },
  defense: { goal: "Stop getting pushed off good hands", steps: ["When facing a bet, ask: what worse hands could be betting here? If you can name two, lean toward calling.", "Once this session, call a river bet with a decent-but-scared hand and see what they show."], check: (s) => s.badFolds <= 1, checkText: "give up at most 1 winning hand", module: "range-1" },
  value: { goal: "Get paid on your big hands", steps: ["Every time you make top pair or better, bet about half the pot. No slow-playing this session.", "Count your value bets, aim for at least 3 before you end the session."], check: (s) => s.missedValue <= 1, checkText: "miss at most 1 value bet", module: "post-1" },
  aggression: { goal: "Take the lead more often", steps: ["If a hand is worth playing, come in raising, no calling just to see a cheap flop.", "Once this session, re-raise with your best hand instead of flat-calling."], check: (s) => s.vpip === 0 || s.pfr / Math.max(1, s.vpip) >= 0.55, checkText: "raise more than half the hands you play", module: "pre-2" },
  bluff: { goal: "Bluff with a plan, not a feeling", steps: ["Only bluff when you can say which big hand you're pretending to have.", "Hard cap: 2 big bluffs this session."], check: (s) => s.bluffs <= 2, checkText: "keep it to 2 big bluffs", module: "bluff-1" },
  general: { goal: "Tighten the basics", steps: ["Play one focused 20-hand session with no distractions.", "Review every hand you lose more than 10 big blinds on."], check: () => true, checkText: "complete a focused session", module: "pre-1" },
};
function makePlan(leaks, stats) {
  return leaks.slice(0, 3).map((l) => {
    const d = DRILL_BOOK[familyOf(l.ruleId)] || DRILL_BOOK.general;
    return { ruleId: l.ruleId, leakTitle: l.title, goal: d.goal, steps: d.steps, checkText: d.checkText, check: d.check, module: d.module || l.module };
  });
}

/* ---------- Bucketing: where you win and lose ---------- */
function bucketize(rows) {
  // rows: { pos, verb, netBB, mistakes, evLost, showdown }
  const agg = {};
  const add = (label, r) => {
    if (!agg[label]) agg[label] = { label, hands: 0, netBB: 0, mistakes: 0, evLost: 0 };
    const a = agg[label];
    a.hands++; a.netBB += r.netBB; a.mistakes += r.mistakes; a.evLost += r.evLost;
  };
  rows.forEach((r) => {
    if (r.pos && r.verb) add(r.pos + ", you " + r.verb, r);
    if (r.showdown) add("Hands that went to showdown", r);
    if (Math.abs(r.netBB) >= 50) add("Big pots (50+ big blinds)", r);
  });
  return Object.values(agg).filter((b) => b.hands >= 1).sort((a, b) => a.netBB - b.netBB);
}
function verbFromType(t, facing) {
  if (t === "raise") return facing ? "re-raised" : "raised";
  if (t === "call") return facing ? "called a raise" : "limped in";
  return "folded";
}

/* ---------- Session analysis ---------- */
function analyzeSession(hands, opts = {}) {
  const n = hands.length || 1;
  let vpip = 0, pfr = 0, threeBet = 0, threeBetOpp = 0, bets = 0, calls = 0;
  let riverFoldOpp = 0, riverFolds = 0, decisions = 0, evLost = 0, blunders = 0;
  let looseCalls = 0, badFolds = 0, missedValue = 0, bluffs = 0, limps = 0;
  const violations = {}; // ruleId -> {count, costBB}
  const bucketRows = [];
  hands.forEach((h) => {
    let v = false, r = false, facing = false, firstAct = null, mistakes = 0, hEv = 0;
    h.actions.forEach((a) => {
      if (a.idx !== 0) return;
      decisions++;
      if (a.evLoss) { evLost += a.evLoss; hEv += a.evLoss; if (a.evLoss >= 2) blunders++; if (a.evLoss > 0) mistakes++; }
      if (a.tag === "loose_call" || a.tag === "loose_call_pre") looseCalls++;
      if (a.tag === "bad_fold" || a.tag === "fold_premium") badFolds++;
      if (a.tag === "missed_value") missedValue++;
      if (a.tag === "bluff") bluffs++;
      if (a.tag === "limp") limps++;
      if (a.ruleId && a.evLoss > 0) {
        if (!violations[a.ruleId]) violations[a.ruleId] = { count: 0, costBB: 0 };
        violations[a.ruleId].count++; violations[a.ruleId].costBB += a.evLoss;
      }
      if (a.street === "preflop") {
        if (!firstAct) { firstAct = a.type; facing = a.toCall > BB; }
        if (a.type === "call" || a.type === "raise") v = true;
        if (a.type === "raise") { r = true; if (a.toCall > BB) threeBet++; }
        if (a.toCall > BB) threeBetOpp++;
      }
      if (a.type === "raise") bets++;
      if (a.type === "call") calls++;
      if (a.street === "river" && a.toCall > 0) { riverFoldOpp++; if (a.type === "fold") riverFolds++; }
    });
    if (v) vpip++;
    if (r) pfr++;
    bucketRows.push({
      pos: h.pos || null,
      verb: firstAct ? verbFromType(firstAct, facing) : "folded",
      netBB: h.net / BB, mistakes, evLost: hEv, showdown: !!h.wentToShowdown,
    });
  });
  const stats = {
    hands: hands.length, decisions,
    vpip: Math.round((vpip / n) * 100), pfr: Math.round((pfr / n) * 100),
    threeBetPct: threeBetOpp ? Math.round((threeBet / threeBetOpp) * 100) : 0,
    af: calls ? +(bets / calls).toFixed(1) : bets,
    net: hands.reduce((s, h) => s + h.net, 0),
    evLostBB: +evLost.toFixed(1), blunders,
    looseCalls, badFolds, missedValue, bluffs, limps,
    riverFoldPct: riverFoldOpp ? Math.round((riverFolds / riverFoldOpp) * 100) : 0,
  };
  // Frequency-level rules (need sample size; confidence-tested)
  if (hands.length >= 8) {
    const z = freqZ(vpip / n, 0.25, n);
    if (stats.vpip > 32) violations.vpip_high = { count: vpip, costBB: Math.max(1, (stats.vpip - 28) * 0.05 * n), conf: confFromZ(z, n) };
    if (vpip > 0 && pfr / vpip < 0.45) violations.passive_pre = { count: vpip - pfr, costBB: Math.max(1, (vpip - pfr) * 0.4), conf: confFromCount(vpip - pfr) };
    if (bluffs >= 3) violations.overbluff = { count: bluffs, costBB: bluffs * 1.4, conf: confFromCount(bluffs) };
  }
  const leaks = Object.entries(violations).map(([ruleId, v]) => {
    const def = RULESET[ruleId] || { title: "Worth a look", why: "", fix: "", module: "pre-1" };
    return {
      ruleId, title: def.title, why: def.why, fix: def.fix, module: def.module,
      costBB: +v.costBB.toFixed(1), costChips: Math.round(v.costBB * BB), count: v.count,
      confidence: v.conf || confFromCount(v.count),
      estimate: ruleId.startsWith("missed_value"),
    };
  }).filter((l) => l.costBB >= 0.3).sort((a, b) => b.costBB - a.costBB).slice(0, 5);

  // Accuracy & session performance rating
  const L = decisions ? evLost / decisions : 0;
  const accuracy = Math.round(100 * Math.max(0, 1 - L / 1.5));
  const spr = Math.round(400 + 2400 * Math.pow(accuracy / 100, 2.2)); // nonlinear: high ratings demand near-clean play
  let ratingDelta = 0;
  if (opts.rating != null) {
    const K0 = Math.min(0.5, Math.max(0.12, 0.5 / Math.sqrt(Math.max(1, opts.sessionNumber || 1))));
    const K = decisions < 12 ? (K0 * decisions) / 12 : K0;
    ratingDelta = Math.round(Math.max(-150, Math.min(150, K * (spr - opts.rating))));
  }
  const keyHands = [...hands].map((h) => ({ ...h, evLost: h.actions.filter((a) => a.idx === 0).reduce((s, a) => s + (a.evLoss || 0), 0) }))
    .sort((a, b) => b.evLost - a.evLost || Math.abs(b.net) - Math.abs(a.net)).slice(0, 3);
  const plan = makePlan(leaks, stats);
  const planCheck = opts.lastPlan ? opts.lastPlan.map((d) => ({ goal: d.goal, checkText: d.checkText, passed: !!(d.check && d.check(stats)) })) : null;
  return { stats, leaks, keyHands, plan, planCheck, accuracy, spr, ratingDelta, buckets: bucketize(bucketRows), mistakes: stats.looseCalls + stats.badFolds + stats.missedValue };
}

/* ---------- RiverIQ Rating (RIQ) helpers ---------- */
/* ---------- Edge Rating: equity-margin scoring, pot-weighted, opponent-adjusted (Glicko-style update) ---------- */
const EDGE_POP = { aggF: 0.45, aggT: 0.40, aggR: 0.35, pfr: 0.22 }; // population baselines
function botTendency(style) {
  if (!style) return { aggF: EDGE_POP.aggF, aggT: EDGE_POP.aggT, aggR: EDGE_POP.aggR, pfr: EDGE_POP.pfr };
  const agg = 0.25 + (style.agg || 1) * 0.18 + (style.bluff || 0.08) * 0.5;
  return {
    aggF: Math.min(0.75, agg), aggT: Math.min(0.7, agg * 0.9), aggR: Math.min(0.65, agg * 0.8),
    pfr: Math.max(0.06, Math.min(0.4, 0.10 + (style.agg || 1) * 0.08 + ((style.loose || 1) - 1) * 0.08)),
  };
}
function edgeBoardWet(board) {
  if (!board || board.length < 3) return false;
  const suits = {};
  board.forEach((c) => (suits[c.s] = (suits[c.s] || 0) + 1));
  if (Object.values(suits).some((n) => n >= 3)) return true;
  const rs = board.map((c) => c.r).sort((a, b) => a - b);
  for (let i = 0; i + 2 < rs.length; i++) if (rs[i + 2] - rs[i] <= 4) return true;
  return false;
}
// Score one hero action entry. Returns null when the decision is excluded from scoring.
function edgeScoreAction(a, hand) {
  const street = a.street;
  const pot = a.potBefore || 0;
  const toCall = a.toCall || 0;
  const e = a.eq;
  const wPot = pot / START_STACK;
  const opp = a.oppTendency || EDGE_POP;
  const code = handCode(hand.heroCards[0], hand.heroCards[1]);
  const h = HAND_PCT[code] ?? 0.8;
  const base = { handNo: hand.handNo, street, action: a.type, pot, toCall, eq: e ?? null, wPot, opp, code, amount: a.amount || null };

  if (street !== "preflop" && toCall > 0 && e != null && (a.type === "call" || a.type === "fold")) {
    // ---- Type A: postflop call/fold vs pot odds, tendency-adjusted ----
    const Tbase = toCall / (pot + toCall + toCall);
    const aggKey = street === "flop" ? "aggF" : street === "turn" ? "aggT" : "aggR";
    const aggDelta = (opp[aggKey] ?? EDGE_POP[aggKey]) - EDGE_POP[aggKey];
    let T = Tbase - aggDelta * 0.18;
    T = Math.max(Tbase - 0.08, Math.min(Tbase + 0.08, T));
    const margin = a.type === "call" ? e - T : T - e;
    return { ...base, type: "A", threshold: T, margin, score: margin * wPot };
  }

  if (street !== "preflop" && a.type === "raise" && toCall === 0 && e != null && (e >= 0.65 || e <= 0.35)) {
    // ---- Type D: bet sizing vs texture band ----
    const board = hand.board.slice(0, a.board);
    const wet = edgeBoardWet(board);
    const band = e >= 0.65
      ? (wet ? [0.60, 0.95] : (street === "river" ? [0.55, 0.85] : [0.45, 0.75]))
      : (wet ? [0.55, 0.85] : [0.40, 0.70]);
    const frac = pot > 0 ? (a.amount || 0) / pot : 0;
    let margin;
    if (frac >= band[0] && frac <= band[1]) margin = 0.06;
    else if (frac < band[0]) margin = -(band[0] - frac);
    else margin = -(frac - band[1]) * 0.65;
    return { ...base, type: "D", threshold: band[0], margin, score: margin * wPot };
  }

  if (street === "preflop" && toCall <= BB) {
    // ---- Type B: open or fold, unraised pot ----
    if (a.type !== "raise" && a.type !== "fold" && a.type !== "call") return null;
    const Tpos = OPEN_PCT[hand.pos] ?? 0.3;
    if (a.type === "fold" && h > 0.60) return null; // trivial fold of junk: not a decision
    let margin;
    if (a.type === "raise") margin = Tpos - h;
    else if (a.type === "fold") margin = h - Tpos;
    else margin = (h <= Tpos ? -0.06 : -(h - Tpos) - 0.06); // limp: always slightly wrong, very wrong with junk
    return { ...base, type: "B", threshold: Tpos, margin, score: margin * wPot };
  }

  if (street === "preflop" && toCall > BB) {
    // ---- Type C: facing a raise, PFR-adjusted defend range ----
    const pfrDelta = (opp.pfr ?? EDGE_POP.pfr) - EDGE_POP.pfr;
    let Td = 0.42 - Math.max(-0.04, Math.min(0.04, pfrDelta * 0.20));
    if (hand.pos === "SB") Td *= 0.82;
    else if (hand.pos !== "BB") Td *= 0.65;
    Td = Math.max(0.30, Math.min(0.55, Td));
    const margin = (a.type === "call" || a.type === "raise") ? Td - h : h - Td;
    return { ...base, type: "C", threshold: Td, margin, score: margin * wPot };
  }

  return null;
}
function edgeSession(hands) {
  const decisions = [];
  hands.forEach((hand) => {
    (hand.actions || []).forEach((a) => {
      if (a.idx !== 0) return;
      const d = edgeScoreAction(a, hand);
      if (d) {
        d.handNet = hand.net;
        d.showdown = !!hand.wentToShowdown;
        d.live = a.live || 2;
        decisions.push(d);
      }
    });
  });
  const sub = (list) => {
    const pos = list.filter((d) => d.score > 0).reduce((s, d) => s + d.score, 0);
    const neg = list.filter((d) => d.score < 0).reduce((s, d) => s - d.score, 0);
    return pos + neg > 0 ? pos / (pos + neg) : null;
  };
  const A = Math.max(0.05, Math.min(0.98, sub(decisions) ?? 0.5));
  const byType = (t) => decisions.filter((d) => d.type === t);
  return {
    decisions, count: decisions.length, A,
    Apre: sub([...byType("B"), ...byType("C")]),
    Apost: sub(byType("A")),
    Asize: sub(byType("D")),
    biggestErr: decisions.filter((d) => d.score < 0).sort((x, y) => x.score - y.score)[0] || null,
    biggestWin: decisions.filter((d) => d.score > 0).sort((x, y) => y.score - x.score)[0] || null,
  };
}
// Glicko-style three-parameter update. ts carries {phi, sigma, rolling_var, rating_n}.
function edgeUpdate(ts, A, mu) {
  const n = (ts.rating_n || 0) + 1;
  const Rs = 400 + 2400 * Math.pow(A, 2.2);
  const delta0 = Rs - mu;
  const rv0 = ts.rolling_var != null ? ts.rolling_var : (n === 1 ? Math.pow(Rs - 1000, 2) : 90000);
  const rollingVar = n === 1 ? Math.pow(Rs - 1000, 2) : 0.85 * rv0 + 0.15 * delta0 * delta0;
  const sigma = Math.max(0.10, Math.min(0.90, Math.sqrt(rollingVar) / 500));
  const K = Math.max(0.08, Math.min(0.45, sigma / Math.sqrt(n)));
  const cap = n <= 10 ? 180 : 120;
  const delta = Math.round(Math.max(-cap, Math.min(cap, K * delta0)));
  const newMu = Math.max(400, Math.min(2800, Math.round(mu + delta)));
  const phi = Math.max(50, (ts.phi != null ? ts.phi : 350) * 0.88 + 12);
  return { mu: newMu, delta, phi: Math.round(phi), sigma: +sigma.toFixed(3), rollingVar: Math.round(rollingVar), n, Rs: Math.round(Rs) };
}
const cardStr = (c) => rankLabel(c.r) + ["s", "h", "d", "c"][c.s];

const TIERS = [[2400, "Legend"], [2150, "Elite"], [1900, "Crusher"], [1650, "Shark"], [1400, "Regular"], [1150, "Grinder"], [900, "Apprentice"], [400, "Newcomer"]];
const TIER_MEANING = {
  Legend: "Solver-sharp. You rarely leave a chip on the table.",
  Elite: "Near-optimal in standard spots. A serious, winning player.",
  Crusher: "You exploit passive players and apply real pressure. A winner at live $1/2.",
  Shark: "Correct in thin spots, sized with intent. Profitable at low-stakes live poker.",
  Regular: "Solid preflop and value betting. Slightly ahead of the average home game.",
  Grinder: "You know the basics and fold the junk. Breaking even at the home game.",
  Apprentice: "Fundamentals are forming. Still leaking chips postflop.",
  Newcomer: "Just starting out. Every session sharpens the read.",
};
const tierOf = (r) => (TIERS.find(([m]) => r >= m) || TIERS[TIERS.length - 1])[1];
// Percentile against a casual-player population. Calibrated so the median casual sits ~1050,
// most casuals fall 850-1300, and serious players push past 1500. Refined as decision_log grows.
function casualPercentile(rating) {
  // logistic CDF centered at 1050 with spread ~260
  const z = (rating - 1050) / 260;
  const p = 1 / (1 + Math.exp(-z));
  return Math.max(1, Math.min(99, Math.round(p * 100)));
}
function percentileLine(rating) {
  const p = casualPercentile(rating);
  if (p >= 50) return `You play tighter and sharper than ${p}% of casual players.`;
  return `Better than ${p}% of casual players, and climbing.`;
}
// A single moment: the one thing worth celebrating or flagging from a session, in plain language.
// Detected from data the engine already produces. Restraint: at most one hero moment per session.
function sessionMoment(analysis, edge, ratingDelta) {
  const s = analysis.stats;
  const a = edge || {};
  // Hero moments, in priority order
  if (a.biggestWin && a.biggestWin.type === "A" && a.biggestWin.action === "fold" && a.biggestWin.wPot > 0.25)
    return { kind: "good", title: "Perfect fold", line: "You laid down a losing hand in a big pot. Discipline is a skill most players never learn." };
  if (a.biggestWin && a.biggestWin.wPot > 0.30)
    return { kind: "good", title: "Big spot, right call", line: "Your best decision came when the most chips were on the line. That is exactly where edges are won." };
  if (s.missedValue === 0 && s.hands >= 8 && (s.pfr / Math.max(1, s.vpip)) >= 0.6)
    return { kind: "good", title: "Clean aggression", line: "You came in raising and got paid on your strong hands. No chips left behind." };
  if (ratingDelta >= 25)
    return { kind: "good", title: "Sharp session", line: "Your decisions outpaced your rating tonight. Keep this up and the number follows." };
  // Flag moments (still framed as forward progress)
  if (analysis.leaks[0] && analysis.leaks[0].count >= 2)
    return { kind: "flag", title: "One leak to plug", line: `${analysis.leaks[0].title} showed up more than once. Fix this and your rating climbs on its own.` };
  if (ratingDelta < -15)
    return { kind: "flag", title: "Off night", line: "Everyone has them. The replay below shows the exact spots, so tomorrow goes better." };
  return null;
}
// Week-over-week progress framing, computed from the last N sessions.
function weekProgress(sessions) {
  if (!sessions || sessions.length < 4) return null;
  const recent = sessions.slice(-3);
  const prior = sessions.slice(-6, -3);
  if (prior.length < 2) return null;
  const avg = (arr, f) => arr.reduce((s, x) => s + f(x), 0) / arr.length;
  const recentAcc = avg(recent, (s) => s.accuracy || 0);
  const priorAcc = avg(prior, (s) => s.accuracy || 0);
  const recentLeaks = avg(recent, (s) => (s.leaks ? s.leaks.length : 0));
  const priorLeaks = avg(prior, (s) => (s.leaks ? s.leaks.length : 0));
  if (recentAcc - priorAcc >= 4) return `Your decisions are ${Math.round(recentAcc - priorAcc)}% sharper than last week.`;
  if (priorLeaks - recentLeaks >= 1) return `You have plugged ${Math.round(priorLeaks - recentLeaks)} leak${Math.round(priorLeaks - recentLeaks) === 1 ? "" : "s"} since last week.`;
  if (recentAcc >= 75) return "Your decision quality is holding strong week over week.";
  return null;
}
const ratingBand = (lifetimeHands) => Math.round(350 / Math.sqrt(1 + lifetimeHands / 40));

/* ---------- Plain-language replay commentary ---------- */
function commentFor(a) {
  const pc = (v) => Math.round(v * 100);
  const win = a.eq != null ? `Your hand was winning about ${pc(a.eq)} times in 100 here` : null;
  const need = a.potOdds > 0 ? `the call only needed ${pc(a.potOdds)} in 100 to break even` : null;
  if (a.tag === "loose_call" || a.tag === "loose_call_pre") {
    if (a.potOdds > 0 && a.eq != null) return `${win}, but ${need.replace("only needed", "needed")}, the price was too high. Better: ${a.better}. Cost: ~${Math.round(a.evLoss * BB)} chips.`;
    return `This hand isn't strong enough for the price. Better: ${a.better}. Cost: ~${Math.round(a.evLoss * BB)} chips.`;
  }
  if (a.tag === "bad_fold") return `${win}, and ${need}, this fold gave away a profitable spot. Better: ${a.better}. Cost: ~${Math.round(a.evLoss * BB)} chips.`;
  if (a.tag === "fold_premium") return `This is one of the strongest starting hands you'll see all session, it wants to ${a.better}, not fold. Cost: ~${Math.round(a.evLoss * BB)} chips.`;
  if (a.tag === "missed_value") return `${win}, a hand this strong should ${a.better} so worse hands pay you. Estimated cost: ~${Math.round(a.evLoss * BB)} chips.`;
  if (a.tag === "loose_open") return `This hand is below the bar for this seat. ${RULESET[a.ruleId] ? RULESET[a.ruleId].why : ""} Better: ${a.better}. Cost: ~${Math.round(a.evLoss * BB)} chips.`;
  if (a.tag === "limp") return `Just calling here invites the whole table in cheaply. Better: ${a.better}.`;
  if (a.tag === "light_3bet") return `Re-raising builds a big pot, and this hand isn't quite big enough for one. Better: ${a.better}.`;
  if (a.tag === "bluff") {
    if (a.measured && a.foldChance != null) {
      return a.evLoss > 0
        ? `Measured against these opponents' real styles: they all fold only ${pc(a.foldChance)}% of the time here, not enough. This bluff loses ~${Math.round(a.evLoss * BB)} chips on average.`
        : `Measured against these opponents' real styles: they all fold ${pc(a.foldChance)}% of the time here, often enough to make this bluff profitable. Nice spot.`;
    }
    return `A bluff, fine occasionally, as long as you can name the big hand you're pretending to have.`;
  }
  if (a.type === "fold") return a.potOdds > 0 ? `Disciplined fold, you needed about ${pc(a.potOdds)} in 100 and didn't have it.` : `Fine fold.`;
  if (a.type === "call") return `Reasonable call, the price was fair for your hand's chances.`;
  if (a.type === "raise") return `Good aggression, taking control of the pot.`;
  return `Standard play, pot control with a medium hand.`;
}
function verdictFor(a) {
  if (a.evLoss >= 2) return { label: "Blunder", color: T.bad, chips: -Math.round(a.evLoss * BB) };
  if (a.evLoss > 0) return { label: "Mistake", color: T.cordovan, chips: -Math.round(a.evLoss * BB) };
  if (a.tag === "bluff") return { label: "Bluff", color: T.brass, chips: 0 };
  return { label: "Solid", color: T.good, chips: 0 };
}

/* ============================ LEARN CONTENT ============================ */
const LEARN = [
  { id: "ch1", chapter: 1, title: "The Game", suit: "♠", desc: "Hand rankings, positions, and how poker is played",
    modules: [
      { id: "hands-1", title: "Hand rankings", min: 3, xp: 30, steps: [
        { type: "info", heading: "The goal", body: "Your hole cards:\nA♥K♦\n\nBoard:\nA♠7♣2♦J♠5♣\n\nMake the best 5-card hand from 2 hole cards + 5 community cards. Highest ranked hand at showdown wins the pot." },
        { type: "info", heading: "The top 3", body: "Royal Flush:\nA♠K♠Q♠J♠T♠\n\nStraight Flush:\n9♣8♣7♣6♣5♣\n\nFour of a Kind:\nK♠K♥K♦K♣\n\nUnbeatable, near-unbeatable, and crushing — in that order." },
        { type: "mcq", q: "Player A: A♠K♠Q♠J♠T♠. Player B: K♠K♥K♦K♣A♥. Who wins?", opts: ["Player A — Royal Flush", "Player B — Four Kings", "It's a tie"], a: 0, why: "Royal Flush is the strongest hand in poker — it beats everything, including four of a kind." },
        { type: "info", heading: "The middle hands", body: "Full House:\nQ♠Q♦Q♥K♠K♣\n\nFlush:\nA♦J♦8♦5♦2♦\n\nStraight:\nT♠9♥8♦7♣6♠\n\nFull House beats Flush beats Straight — always compare categories first." },
        { type: "mcq", q: "You hold K♠K♦K♥J♠J♣. What hand is this?", opts: ["Full House", "Flush", "Three of a Kind"], a: 0, why: "Three Kings (three of a kind) + two Jacks (a pair) = Full House. It beats a flush and a straight." },
        { type: "info", heading: "The common hands", body: "Three of a Kind:\nJ♠J♦J♥\n\nTwo Pair:\nQ♠Q♦7♥7♣\n\nOne Pair:\nA♠A♦\n\nMost pots are decided by these. Know what beats what." },
        { type: "mcq", q: "Which hand wins?", opts: ["Two Pair: K♠K♦7♥7♣A♠", "Straight: A♥2♦3♣4♠5♥", "Three of a Kind: J♠J♦J♥A♣K♠"], a: 1, why: "A Straight beats both Two Pair and Three of a Kind. Always compare hand categories first, then individual card ranks." },
        { type: "mcq", q: "Both players have one pair. You: J♦J♣. Opponent: Q♠Q♥. Board: A♠K♦7♣3♥2♠. Who wins?", opts: ["You — you acted first", "Opponent — Queens beat Jacks", "Tie — both have one pair"], a: 1, why: "When both players have one pair, compare the pair rank. Queens beat Jacks — the higher pair wins." },
      ]},
      { id: "table-1", title: "The table & positions", min: 3, xp: 30, steps: [
        { type: "info", heading: "6 seats, 1 button", body: "A 6-max table has 6 seats: UTG · MP · CO · BTN · SB · BB.\n\nExample hand on the Button:\nA♠K♦\n\nThe dealer button moves one seat LEFT after every hand, so everyone cycles through each position." },
        { type: "info", heading: "The blinds", body: "Big Blind's hand:\nJ♦T♦\n\nThe 2 players LEFT of the button post forced bets:\n• Small Blind (SB): half a big blind.\n• Big Blind (BB): one full big blind.\nBlinds create a pot to fight over every hand." },
        { type: "mcq", q: "Where does the dealer button move after each hand?", opts: ["Stays in place", "One seat to the LEFT", "One seat to the RIGHT"], a: 1, why: "The button moves one seat left (clockwise) after every hand so each player cycles through every position." },
        { type: "info", heading: "Preflop order", body: "UTG's tough spot:\n7♠2♦\n\nActing order before the flop:\nUTG → MP → CO → BTN → SB → BB\n\nUTG acts FIRST with the least info. 5 players still act behind." },
        { type: "mcq", q: "Which position acts FIRST before the flop?", opts: ["Small Blind", "UTG (Under the Gun)", "Big Blind"], a: 1, why: "UTG sits immediately left of the BB and must act first preflop — before seeing what anyone else does. It's the toughest spot." },
        { type: "info", heading: "Postflop flips", body: "Board on the flop:\nK♥7♦2♣\n\nAfter the flop, order reverses:\nSB acts first → … → BTN acts LAST\n\nThis is every street (flop, turn, river). Last to act = most information." },
        { type: "mcq", q: "On the flop, who acts LAST?", opts: ["UTG", "Small Blind", "Button"], a: 2, why: "The Button always acts last on the flop, turn, and river. Seeing all other players act first is a massive structural edge." },
        { type: "mcq", q: "Which seat is generally strongest in poker?", opts: ["UTG — you set the tone", "Big Blind — you already paid", "Button — you act last postflop"], a: 2, why: "The Button is best because you act last every postflop street. Information equals power in poker." },
      ]},
      { id: "flow-1", title: "How a hand works", min: 4, xp: 30, steps: [
        { type: "info", heading: "4 streets", body: "Hole cards:\nA♥K♦\n\nFlop:\nA♠7♣2♦\n\nTurn:\nJ♠\n\nRiver:\n9♥\n\n4 betting rounds, 4 chances to read opponents and build the pot." },
        { type: "mcq", q: "How many community cards are dealt on the flop?", opts: ["One", "Three", "Five"], a: 1, why: "The flop deals 3 community cards face-up. Turn adds a 4th, river adds the 5th — 5 total." },
        { type: "info", heading: "Your 4 options", body: "Your hand:\nQ♠J♠\n\nBoard:\nK♥9♦2♣\n\nEvery street you choose:\n• Fold — give up your hand\n• Check — pass (no bet facing you)\n• Call — match the current bet\n• Raise — increase the bet" },
        { type: "mcq", q: "No one has bet yet. It's your turn. Which action is NOT available?", opts: ["Check", "Call", "Fold"], a: 1, why: "You can only Call when there's a bet to match. With no bet, your options are Check, Bet (raise), or Fold." },
        { type: "info", heading: "When a street ends", body: "Board after bets equalize:\nA♠7♣2♦\n\nA betting street ends when all remaining players have put in equal chips. Then the next community card is dealt, or showdown on the river." },
        { type: "mcq", q: "You bet 50. Two players call. What happens next?", opts: ["Street ends — next card is dealt", "You bet again", "The player to your left acts again"], a: 0, why: "Once all players match the bet, the street is over and the next community card is dealt (or showdown if it's the river)." },
        { type: "info", heading: "Showdown", body: "Board:\nA♠7♣2♦J♦9♥\n\nPlayer A:\nA♥K♦\n\nPlayer B:\nQ♠Q♦\n\nPair of aces beats pair of queens. Player A wins the pot." },
        { type: "mcq", q: "Player A bets the river. Player B calls. What happens?", opts: ["Player A wins — they bet", "Showdown: best hand wins", "Player B wins — they called last"], a: 1, why: "A river call forces a showdown. Both players reveal cards and the best 5-card hand wins — betting doesn't determine the winner." },
      ]},
      { id: "vocab-1", title: "Poker vocabulary", min: 3, xp: 30, steps: [
        { type: "info", heading: "Stack & pot", body: "Your hand:\nA♥K♥\n\nStack = your chip count. Pot = total chips in the hand.\nBig Blind (BB) = the standard unit.\n\nStack of 2,000 at 20 BB = 100bb deep. Always measure in BBs." },
        { type: "mcq", q: "Blinds are 10/20. Your stack is 1,000 chips. How deep are you?", opts: ["10bb", "50bb", "100bb"], a: 1, why: "1,000 ÷ 20 = 50 big blinds. Always measure your stack in BBs — it's how every sizing decision is made." },
        { type: "info", heading: "Preflop vocab", body: "Open (first raise):\nA♠K♠\n\n3-bet (re-raise the open):\nQ♥Q♣\n\n4-bet (re-raise the 3-bet):\nA♦A♣\n\nLimp = just calling the BB preflop (usually weak)." },
        { type: "mcq", q: "UTG raises to 60. You raise to 180. What's your action called?", opts: ["An open", "A 3-bet", "A limp"], a: 1, why: "UTG's raise was the open (1st bet after blinds). Your re-raise is a 3-bet — the 3rd bet in the sequence." },
        { type: "info", heading: "Postflop vocab", body: "You raised preflop:\nA♥K♦\n\nBoard (c-bet here):\nA♠7♣2♦\n\nC-bet = continuation bet — the preflop raiser bets the flop.\nEquity = your % chance of winning.\nNut hand = best possible hand on this board." },
        { type: "mcq", q: "You raised preflop and bet the flop. This is called a…", opts: ["Donk bet", "C-bet (continuation bet)", "Probe bet"], a: 1, why: "A c-bet (continuation bet) is when the preflop aggressor bets the flop — one of the most common plays in poker." },
        { type: "info", heading: "Key terms", body: "You hold:\nA♠K♠\n\nBoard:\nK♣Q♣8♣\n\nA♠ is a blocker — cuts opponent's nut flush combos.\nFold equity = how often a bet makes them fold.\nPot odds = the price you're being offered to call." },
        { type: "mcq", q: "Your opponent's range is AA, KK, QQ — 18 combos. You hold A♠K♠. How many AA combos can they have now?", opts: ["6 combos", "3 combos", "0 combos"], a: 1, why: "AA normally has 6 combos. You hold A♠, so only 3 AA combos remain (AhAd, AhAc, AdAc). This is a blocker." },
      ]},
      { id: "first-1", title: "Your first decision", min: 4, xp: 30, steps: [
        { type: "info", heading: "The setup", body: "Your hand on the Button:\nA♥K♦\n\nEveryone folds to you. Premium hand, best seat, zero information gap. What's the move?" },
        { type: "mcq", q: "Button. A♥K♦. Everyone folded. Best play?", opts: ["Fold — wait for aces", "Limp (call the BB)", "Open raise to 2.5bb"], a: 2, why: "AK on the button is a premium hand in the best position. Always open-raise — win the pot now or play a big pot with positional advantage." },
        { type: "info", heading: "Facing a 3-bet", body: "Your hand:\nA♥K♦\n\nBB re-raises (3-bets) to 9bb.\n\nAK flops top pair with top kicker and dominates most 3-bet ranges. Don't fold — that's a major mistake." },
        { type: "mcq", q: "BB 3-bets to 9bb. You have AK on the Button. You should:", opts: ["Fold — they might have AA/KK", "4-bet or call — definitely don't fold", "Always fold AK to a 3-bet"], a: 1, why: "AK is too strong to fold to a 3-bet. 4-bet to build the pot with your premium, or call and use your position postflop." },
        { type: "info", heading: "The flop", body: "Your hand:\nA♥K♦\n\nBoard:\nA♠7♣2♦\n\nTop pair, top kicker (TPTK) on a dry board. BB checks to you. Hands that call your bet: worse aces, sevens, any pair." },
        { type: "mcq", q: "BB checks on A♠7♣2♦ with your A♥K♦. You should:", opts: ["Check back to trap", "Bet 60-70% pot", "Bet tiny (15%) to keep them in"], a: 1, why: "TPTK on a dry board = bet for value. Worse aces, sevens, and pairs all call. Checking risks free cards and misses value." },
        { type: "info", heading: "The pattern", body: "Your hand:\nA♥K♦\n\nBoard:\nA♠7♣2♦\n\nStrong hand + best position + aggression = profit.\nThis hand shows the poker loop: enter with strength, use position, extract value." },
        { type: "mcq", q: "Which combination makes the most money over time?", opts: ["Strong hand + out of position + passive", "Strong hand + in position + aggressive betting", "Any hand + in position + aggressive betting"], a: 1, why: "Strong hand + position + aggression is the winning formula. You get maximum value when you have the best cards and act with full information." },
      ]},
    ]
  },
  { id: "ch2", chapter: 2, title: "Preflop Foundations", suit: "♠", desc: "What to play, from where, and how to enter the pot",
    modules: [
      { id: "pre-1", title: "Starting hand discipline", min: 4, xp: 40, steps: [
        { type: "info", heading: "Play fewer, better hands", body: "Play these:\nA♠A♦\n\nFold these:\n7♦2♠\n\nWinning 6-max players play ~22–26% of dealt hands. Most hands lose money — knowing which to ditch is the foundation." },
        { type: "mcq", q: "You're UTG dealt 7♦2♠ — statistically the worst starting hand. Best play?", opts: ["Limp and see the flop cheap", "Fold immediately", "Open raise — any hand can win"], a: 1, why: "72 offsuit has terrible equity against any opponent and no drawing potential. Fold without hesitation." },
        { type: "info", heading: "Position changes everything", body: "Button — open raise:\nK♦9♦\n\nUTG — fold:\nK♦9♦\n\nFrom the Button, 0 players act behind you. From UTG, 4 can punish you. Same hand, completely different value." },
        { type: "mcq", q: "K♦9♦ from the Button: open raise. K♦9♦ from UTG: you should…", opts: ["Also open raise — it's suited", "Fold — too weak from early position", "Limp and see what happens"], a: 1, why: "K9s is a profitable button open. From UTG it's a loser — 4 players can hold KQ, KJ, KT, and dominate you preflop." },
        { type: "info", heading: "The starter range", body: "Always playable:\nA♠A♦\n\nSuited aces:\nA♣5♣\n\nSuited connectors (late only):\n7♦6♦\n\nPlay from any position: pocket pairs, broadways, suited aces. Add suited connectors in late position." },
        { type: "mcq", q: "Which hand should you fold from UTG?", opts: ["A♠A♦ (pocket aces)", "K♠Q♦ (broadway)", "8♦7♦ (suited connector)"], a: 2, why: "87s is a fine hand from the button or cutoff, but from UTG it's marginal — too many players behind to play a speculative hand profitably." },
        { type: "mcq", q: "Q♠J♠ from the Cutoff. Best play?", opts: ["Fold — not a premium hand", "Open raise to 2.5bb", "Limp and hope to see a cheap flop"], a: 1, why: "QJs from the Cutoff is a standard open. It's a strong suited broadway that plays well in position and can make nut straights and flushes." },
      ]},
      { id: "pos-1", title: "Why the button prints money", min: 4, xp: 40, steps: [
        { type: "info", heading: "Position = acting order", body: "Button's hand:\nK♦9♦\n\nBoard:\nK♥7♣2♠\n\nThe Button acts LAST on every postflop street. You see all checks, bets, and folds before deciding. More information = consistently better decisions." },
        { type: "mcq", q: "Two players, identical hands. One is on the Button, one UTG. Who has the advantage?", opts: ["UTG — they set the agenda", "Button — they act last every street", "Neither — cards determine outcome"], a: 1, why: "The Button's positional advantage is structural, not hand-dependent. Last to act means better decisions on every street, every hand." },
        { type: "info", heading: "What last-to-act buys you", body: "Board:\nJ♥8♦3♣\n\nYour hand (Button):\nA♠J♠\n\nOpponent checks to you. You can bet to take the pot OR check for a free card. Out of position, you'd have to act blind without this choice." },
        { type: "mcq", q: "Opponent checks the flop to you on the Button. What extra option do you have vs. acting first?", opts: ["You can fold for free", "You can choose to bet OR take a free card — they can't raise you pre-bet", "You can see their hand"], a: 1, why: "Acting last lets you decide whether to bet for value, bluff, or take a free card after seeing their check. Out of position you have to act blind." },
        { type: "info", heading: "Hand value shifts by seat", body: "Button — open raise:\nK♦9♦\n\nUTG — fold:\nK♦9♦\n\nPosition multiplies your hand's value. 0 players behind you on the Button; 4 can punish you from UTG." },
        { type: "mcq", q: "Which seat should you play the MOST hands from?", opts: ["UTG — set the pace early", "Button — most hands profitable here", "Big Blind — you already invested"], a: 1, why: "The Button's positional advantage makes the widest range of hands profitable here. Tight early, loose on the button is the correct default." },
        { type: "mcq", q: "You're in the Small Blind (acts FIRST postflop). Main disadvantage?", opts: ["You post a forced bet", "You act before everyone every postflop street", "You can't raise preflop"], a: 1, why: "The SB's key disadvantage is acting first every postflop street — you never see what opponents do before you have to commit. This is why SB is the hardest seat." },
      ]},
      { id: "pre-2", title: "Raise or fold", min: 3, xp: 40, steps: [
        { type: "info", heading: "Kill the limp", body: "Raise this — don't limp:\nA♠J♠\n\nLimping caps your ways to win to ONE (best hand at showdown). Raising wins the pot IMMEDIATELY — a second way that limping eliminates." },
        { type: "mcq", q: "UTG limps. MP limps. You're on the Button with A♠J♠. Best play?", opts: ["Limp along", "Raise to ~5bb", "Fold — too many players in"], a: 1, why: "AJs crushes limping ranges. Raise to 3bb + 1 per limper = 5bb. You build a pot in position with likely the best hand." },
        { type: "info", heading: "Two ways to win", body: "Your hand:\nK♥Q♥\n\nRaising gives you initiative:\n1. Everyone folds → you win the pot now.\n2. Someone calls → you play as the aggressor with the lead.\n\nLimping gives you only option 2, without the lead." },
        { type: "mcq", q: "What does 'having initiative' mean postflop?", opts: ["Having the most chips", "Being the last preflop aggressor — your bets are more credible", "Acting last on the flop"], a: 1, why: "Initiative means you were the last one to raise preflop. Your postflop bets represent strength that your opponent has to account for — passive players have no such threat." },
        { type: "info", heading: "Standard sizing", body: "Your open:\nA♠Q♠\n\nOpen raise: 2–2.5bb in position, 2.5–3bb from early position.\nVs. limpers: 3bb + 1bb per limper.\n\nGoal: punish weak hands without being so large you only get called by better." },
        { type: "mcq", q: "3 players limped before you on the Button with K♥Q♥. Correct raise size?", opts: ["2.5bb — standard open", "6bb — 3bb base + 3 limpers", "10bb — punish them hard"], a: 1, why: "vs limpers: 3bb + 1bb per limper = 6bb here. This punishes weak hands while keeping the pot manageable if a limper wakes up with a hand." },
        { type: "mcq", q: "You're dealt J♦8♦ from UTG — too weak to open profitably. You should:", opts: ["Limp — it's suited so it's fine", "Open raise small", "Fold"], a: 2, why: "If a hand isn't strong enough to raise, it's not strong enough to limp either. The raise-or-fold default keeps your range strong and avoids tricky postflop spots." },
      ]},
      { id: "bb-1", title: "Defending your big blind", min: 4, xp: 40, steps: [
        { type: "info", heading: "You're already in the pot", body: "Your BB hand:\nJ♦T♦\n\nSomeone raises to 3bb. Pot is ~4.5bb. You only need to call 2 more. That's a massive discount — defend wider than from any other seat." },
        { type: "mcq", q: "UTG raises to 3bb. Pot is 4.5bb. You call 2bb more. What pot odds are you getting?", opts: ["About 2-to-1 (33% equity needed)", "About 3-to-1 (25% equity needed)", "Even money (50% needed)"], a: 0, why: "Call 2 to win 6.5 (4.5 + 2) = roughly 30% equity needed. The BB discount makes many otherwise-marginal hands profitable to defend." },
        { type: "info", heading: "What to defend", body: "Defend:\n7♠6♠\n\nFold:\nJ♣3♠\n\nDefend any pair, suited hands, connected hands. Fold disconnected offsuit junk. Premiums (QQ+, AK): 3-bet, don't just call." },
        { type: "mcq", q: "CO raises to 3bb. You're BB with 7♠6♠. Call or fold?", opts: ["Fold — weak hand", "Call — suited connector at a discount is profitable", "3-bet — show aggression"], a: 1, why: "76s has great implied odds and playability. At a big blind discount you have the equity to profitably see a flop and potentially win a big pot." },
        { type: "mcq", q: "BTN raises to 2.5bb. You're BB with Q♦4♦. Call or fold?", opts: ["Call — suited queen gets a discount", "Fold — Q4 is too weak even in position... wait, you're out of position", "3-bet to take the pot"], a: 0, why: "Q4s in the BB vs a BTN steal is a standard defend. The discount + suit + blocker to QQ combos makes this marginally profitable to call." },
        { type: "info", heading: "3-bet your premiums", body: "BB hand:\nA♥A♦\n\nButton steals to 2.5bb. 3-bet to 8–9bb — don't just call.\n\nFlat-calling premiums out of position is a common and expensive leak." },
        { type: "mcq", q: "BTN steals to 2.5bb. You have A♥A♦ in the BB. Best play?", opts: ["Call — don't give away your hand strength", "Fold — aces play badly out of position", "3-bet to 8–9bb"], a: 2, why: "Aces want a big pot. 3-bet to 8-9bb builds value and puts pressure on the stealer. Flat-calling aces in the BB is a common and expensive mistake." },
      ]},
    ]
  },
  { id: "ch3", chapter: 3, title: "Postflop Basics", suit: "♣", desc: "Reading boards, drawing hands, and getting paid",
    modules: [
      { id: "post-1", title: "Betting for value", min: 5, xp: 50, steps: [
        { type: "info", heading: "What is a value bet?", body: "Your hand:\nK♠Q♦\n\nBoard:\nK♥7♠2♣\n\nA value bet = you bet because you want to be called by a WORSE hand. KJ, K9, K8 all call your bet and lose to your KQ." },
        { type: "mcq", q: "You have K♠Q♦ on K♥7♠2♣. Opponent checks. List a hand that calls your bet and loses:", opts: ["AA (beats you)", "KJ (worse king, loses to you)", "77 (set, beats you)"], a: 1, why: "KJ has a worse kicker than your KQ — it will call a bet and you win. That's the definition of a value bet target." },
        { type: "info", heading: "Missing value hurts more than bad bluffs", body: "Your hand:\nA♠A♦\n\nBoard:\nA♥8♠4♣\n\nTop set — most players check 'to be safe.' Every check is money left on the table. Opponent gets a free card and you get nothing." },
        { type: "mcq", q: "You have A♠A♦ on A♥K♠Q♣. Opponent checks to you. You should:", opts: ["Check — don't scare them away", "Bet 60% pot for value", "Bet tiny (20%) to keep them in"], a: 1, why: "Top set on a connected board needs to charge draws immediately. Check and a straight or flush gets there for free. Bet 60% — anyone with K, Q, or a draw will pay." },
        { type: "info", heading: "Value sizing by texture", body: "Dry board:\nK♥7♦2♣\n\nBet 45–60% pot. Fewer draws, less urgency.\n\nWet board:\nJ♥T♦9♠\n\nBet 65–80% pot. Charge draws or they hit for free." },
        { type: "mcq", q: "You have K♠K♦ on K♥7♣2♠ (dry board). What's the right value bet sizing?", opts: ["25% pot — keep them in", "50–60% pot", "100% pot — max value"], a: 1, why: "Dry board with top set: 50–60% extracts value from any pair or ace-high while keeping worse hands in. Overbetting on dry boards just folds out your customers." },
        { type: "mcq", q: "You have Q♠J♠ making top two pair on Q♥J♦T♠ (wet board). Optimal bet?", opts: ["33% pot — don't scare draws", "70–80% pot — charge the draws", "Check — too scary a board"], a: 1, why: "Two pair on a wet board has to bet big immediately. K9, A9, 98, and flush draws all have significant equity — charge them. Checking or betting small is giving away money." },
      ]},
      { id: "post-2", title: "Reading board texture", min: 4, xp: 50, steps: [
        { type: "info", heading: "Wet vs. dry", body: "Dry board:\nK♠7♦2♣\n\nFew draws, hits few hands. Small bets win most pots.\n\nWet board:\nJ♥T♥9♠\n\nMany draws, hits many hands. Bet big to charge them." },
        { type: "mcq", q: "K♠7♦2♣ rainbow — wet or dry?", opts: ["Wet — three high cards", "Dry — disconnected, no flush draw, few straight draws"], a: 1, why: "K72 rainbow is a classic dry board. No flush draws, almost no straight draws. The preflop raiser's range dominates here." },
        { type: "info", heading: "Outs — your equity in draws", body: "Your hand:\n8♦9♦\n\nBoard:\nK♦7♦2♠\n\nFlush draw = 9 outs (9 remaining diamonds)\nOpen-ended straight draw = 8 outs\nGutshot straight draw = 4 outs" },
        { type: "mcq", q: "You have 8♦9♦ on K♦7♦2♠. How many outs do you have to the flush?", opts: ["4 outs", "9 outs", "13 outs"], a: 1, why: "There are 13 diamonds total. You hold 2 and 2 are on the board = 9 remaining diamonds are your outs to the flush." },
        { type: "info", heading: "Rule of 4 and 2", body: "Flush draw:\n8♦9♦\n\nBoard:\nK♦7♦2♠\n\nFlush draw (9 outs):\n• Flop to river: 9 × 4 = ~36% equity\n• Turn to river: 9 × 2 = ~18% equity\n\nMultiply outs by 4 on flop, 2 on turn." },
        { type: "mcq", q: "You have a gutshot (4 outs) on the flop. Approx equity to hit by the river?", opts: ["~8%", "~16%", "~32%"], a: 1, why: "4 outs × 4 = ~16% equity to the river. Gutshots are weak draws — you need good pot odds or implied odds to continue." },
        { type: "mcq", q: "Turn card is the 8♠, completing a possible straight on J♠T♠8♦ board. This benefits:", opts: ["Anyone with a set — their hand improved", "Anyone holding Q9 or 96 — they just made a straight", "The preflop raiser — they always have the best hand"], a: 1, why: "When a straight completes on the turn, the players who hit it (Q9, 96) now have a very strong hand. Overpairs and sets need to be cautious." },
      ]},
      { id: "size-1", title: "Pot odds in five seconds", min: 4, xp: 50, steps: [
        { type: "info", heading: "What are pot odds?", body: "Your hand:\n9♦8♦\n\nBoard:\nA♠7♣2♦\n\nPot odds = the price offered to call a bet.\nFormula: call ÷ (pot + call)\nIf your hand wins more often than this %, calling is profitable." },
        { type: "mcq", q: "Pot is 100. Opponent bets 50. How much do you call to win the total pot?", opts: ["50 to win 150", "50 to win 200", "50 to win 100"], a: 1, why: "Pot 100 + bet 50 + your call 50 = 200 total pot. You call 50 to win 200. That's 50/200 = 25% equity needed." },
        { type: "info", heading: "The 3 magic numbers", body: "Your flush draw:\nA♦7♦\n\nBoard:\nK♥9♦5♠\n\nMemorize:\n• Half-pot bet → need 25% equity\n• Two-thirds pot bet → need ~29% equity\n• Pot-sized bet → need 33% equity" },
        { type: "mcq", q: "Pot is 200. Opponent bets 200 (pot-sized). What equity do you need to call profitably?", opts: ["25%", "33%", "50%"], a: 1, why: "Call 200 to win 600 total → 200/600 = 33%. Pot-sized bets always need 33% equity." },
        { type: "info", heading: "Apply rule of 4 and 2", body: "Flush draw:\n8♦9♦\n\nBoard:\nK♦7♦2♠\n\nFlush draw (9 outs) = ~36% equity.\nFacing pot-sized bet = need 33%. 36 > 33 → CALL.\n\nGutshot (4 outs) = ~16%. vs half-pot = need 25%. 16 < 25 → FOLD." },
        { type: "mcq", q: "Flush draw (9 outs, ~36% equity). Opponent bets two-thirds pot (you need 29%). Call or fold?", opts: ["Fold — 36 is barely more than 29", "Call — 36% equity > 29% needed", "Raise — punish them"], a: 1, why: "36% equity > 29% needed = profitable call. Pot odds math is that simple. Anytime your equity exceeds the required %, call." },
        { type: "mcq", q: "Gutshot draw (4 outs, ~16% equity). Opponent bets pot (need 33%). Call or fold?", opts: ["Call — gutshots are sneaky", "Fold — 16% < 33% needed", "Raise to take the pot"], a: 1, why: "16% equity < 33% needed = fold. Unless you have significant implied odds (you'll win a huge pot when you hit), gutshots facing pot-sized bets are folds." },
      ]},
      { id: "size-2", title: "Sizing tells a story", min: 3, xp: 50, steps: [
        { type: "info", heading: "Size = information", body: "Strong hand:\nA♠A♦\n\nBluff hand:\nQ♦5♦\n\nIf you size up only with monsters and down with bluffs, opponents read you easily. Consistent sizing by spot type, not hand strength, is the goal." },
        { type: "mcq", q: "A player always bets 75%+ pot with strong hands and 25% as a 'block bet' when weak. How do you exploit this?", opts: ["Always call the big bets", "Fold to big bets, call small bets aggressively", "Ignore sizing — focus on your hand"], a: 1, why: "Once you spot a sizing tell, exploit it: fold to their big bets (they have it), and apply pressure on their small bets (they're weak)." },
        { type: "info", heading: "Exploit vs. balance", body: "Value hand (bet large):\nK♠K♦\n\nBluff (size consistently):\nA♦6♦\n\nAgainst weak opponents: size up with value — they call based on their cards. Against tough players: consistent sizing keeps you balanced." },
        { type: "mcq", q: "Facing a calling station who calls any bet, what's the most profitable adjustment?", opts: ["Bet small with everything to get more calls", "Bet big with your value hands, stop bluffing entirely", "Check more often to trap them"], a: 1, why: "Against calling stations, maximize your value bets (go bigger) and eliminate bluffs (they call those too and you lose). Simple, but very profitable." },
        { type: "info", heading: "Board-based sizing", body: "Dry board:\nA♦8♣3♠\n\nC-bet 25–35% pot. Board strongly favors the raiser.\n\nWet board:\nK♥Q♥J♠\n\nC-bet 65–80% pot. Draws are valuable — charge them." },
        { type: "mcq", q: "You c-bet A♦8♣3♠ rainbow as the preflop raiser. Correct sizing?", opts: ["25–33% pot", "66% pot", "100% pot"], a: 0, why: "Dry boards favor the raiser's range — a small c-bet folds out overcards and gutshots profitably, and keeps worse hands (pairs, ace-highs) in the pot." },
      ]},
    ]
  },
  { id: "ch4", chapter: 4, title: "Intermediate", suit: "♥", desc: "Ranges, bluffing, and playing complex situations",
    modules: [
      { id: "range-1", title: "Think in ranges, not hands", min: 5, xp: 60, steps: [
        { type: "info", heading: "You can't know their cards", body: "You hold:\nA♥K♦\n\nUTG raises. What do they have?\nA♠A♣\n\n...or KK, QQ, AK — that's their RANGE. Every action they take narrows it. Thinking in ranges, not guesses, is the skill." },
        { type: "mcq", q: "UTG raises preflop in 6-max. What can you say about their range?", opts: ["They could have anything", "Strong hands — pairs, broadways, suited aces. UTG plays tight.", "Exactly AA or KK"], a: 1, why: "UTG raises with a tight range because 4 players still act behind. Expect pairs, broadways, and strong suited hands — not random holdings." },
        { type: "info", heading: "Actions prune the range", body: "Board:\nK♠7♦2♣\n\nOpponent called your flop c-bet, then donk-bet the turn:\nJ♠\n\nThis signals: K9 (two pair), 99 (set), or a big draw. Weak hands checked or folded. Actions narrow the range." },
        { type: "mcq", q: "Opponent called your flop c-bet on K♠7♦2♣. Turn is 9♠. They donk-bet big. What does this represent?", opts: ["Any hand — they could have anything", "Strong hands: K9 (two pair), 99 (set), or a bluff with a draw", "Definitely a bluff"], a: 1, why: "A donk-bet (betting into the preflop raiser) on a turn after calling the flop usually represents two pair+, a draw, or an occasional bluff. Weak hands check-fold." },
        { type: "info", heading: "Combos make it concrete", body: "You hold:\nA♠K♠\n\nOpponent's remaining AA:\nA♥A♦\n\nYou block A♠ → only 3 AA combos remain (not 6). If only AA beats you but they'd take this line with 30+ combos, you should call." },
        { type: "mcq", q: "You hold A♠K♠. How many AA combos can your opponent have?", opts: ["6 combos", "3 combos — you hold the A♠", "0 combos — you have AK so they can't have AA"], a: 1, why: "AA has 6 combos normally (C(4,2)=6). You hold A♠, so only 3 AA combos remain: AhAd, AhAc, AdAc. You're a blocker to their strongest hand." },
        { type: "mcq", q: "River jam. Opponent has 6 value combos that beat you and 14 bluff combos you beat. Pot-sized bet (33% needed). Call?", opts: ["Fold — 6 combos beat you", "Call — 14/20 combos = 70% equity, you only need 33%", "Raise"], a: 1, why: "14 of 20 combos are bluffs = 70% equity. You need only 33%. Range math makes this a clear call regardless of how scary the bet feels." },
      ]},
      { id: "bluff-1", title: "Bluff with a story", min: 4, xp: 60, steps: [
        { type: "info", heading: "Bluffs need credibility", body: "Board:\n8♠6♠2♦\n\nYour bluff hand:\nA♠5♠\n\nA bluff works when your opponent believes you COULD have the hand you're representing. If the board doesn't fit your range, no one folds." },
        { type: "mcq", q: "You raised preflop. Board: 8♠6♠2♦-K♠. You bet flop and barrel the K♠ turn. What story are you telling?", opts: ["You have a set of 8s or 6s", "You have a king or a spade flush — both fit your preflop raising range", "You're definitely bluffing"], a: 1, why: "As the preflop raiser, kings and flush draws belong to your range. Barreling on the K♠ turn is a credible story — your range hits this card hard." },
        { type: "info", heading: "Bluff with blockers", body: "Board:\nK♠Q♠7♦\n\nBest bluff hand:\nA♠J♦\n\nA♠ blocks the nut flush — fewer opponent combos of the hand that would call you. No showdown value = must bluff or lose. Perfect setup." },
        { type: "mcq", q: "On a K♠Q♠7♦ board, which hand is the best bluffing candidate?", opts: ["K♦T♦ (top pair — has showdown value)", "A♠J♦ (nut spade blocker, no showdown value)", "7♣6♣ (third pair, some showdown value)"], a: 1, why: "A♠J♦: blocks the nut flush (fewer combos calling you), has no showdown value (must bluff or lose), and represents a flush. Perfect bluff." },
        { type: "info", heading: "Pick targets", body: "Bluff hand vs. a thinking player:\nT♠9♦\n\nNever bluff calling stations. They call with any pair. Your bluffs need fold equity to succeed — pick tight, thinking players who can actually fold." },
        { type: "mcq", q: "Against a player who calls every single bet regardless of hand strength, you should:", opts: ["Bluff more — they'll eventually fold", "Stop bluffing, only value bet", "Bluff with bigger sizes to put more pressure"], a: 1, why: "Calling stations have no fold equity to offer. Bluffing them is just handing them chips. Only value bet, bet thinner than usual, and never bluff." },
        { type: "mcq", q: "You've been caught bluffing twice this session. Correct adjustment?", opts: ["Keep bluffing — they'll stop expecting it", "Tighten up — value bet more, bluff less", "Bluff bigger to force folds"], a: 1, why: "Being caught bluffing twice means your opponents are now calling you lighter. Your 'bluff credibility' is damaged — shift to value betting mode until table dynamics reset." },
      ]},
      { id: "multi-1", title: "More players, different rules", min: 4, xp: 60, steps: [
        { type: "info", heading: "Two rules change multiway", body: "Strong multiway hand:\nJ♠T♠\n\nBoard:\nJ♥T♦5♣\n\n1. DRAWS get more valuable — bigger pot = better odds.\n2. BLUFFS become near-impossible — every player must fold; one caller kills it." },
        { type: "mcq", q: "A bluff that works 60% heads-up. Against 2 opponents (both independently decide), it succeeds approximately:", opts: ["60% — same as heads-up", "36% (0.6 × 0.6)", "20%"], a: 1, why: "Both opponents must fold independently. 60% × 60% = 36%. Each added opponent drastically reduces bluff success — multiway bluffs require very strong board coverage." },
        { type: "info", heading: "The bar for hands rises", body: "3-way pot.\n\nBoard:\nJ♥T♠7♦\n\nYour hand:\nJ♠9♠\n\nHead-up, top pair is often best. Multiway, someone likely connected. Two pair or better is often needed to feel comfortable." },
        { type: "mcq", q: "4-way pot. Flop: J♥T♠7♦. You have J♠9♠ (top pair + open-ender). Best approach?", opts: ["Bet big — you have top pair and a draw", "Proceed with caution — 3 other players likely have strong holdings or draws too", "Check-fold — too dangerous multiway"], a: 1, why: "J9 is strong but in a 4-way pot many hands connect with JT7 (Q9, K9, 98, 88, 77). Proceed, but don't play as if top pair is a monster." },
        { type: "info", heading: "Pot odds improve multiway", body: "Your flush draw:\n9♦8♦\n\nBoard:\nK♦7♦2♠\n\nMore players = bigger pot = better odds for draws.\n3 players each put in 100 = 300 pot. A flush draw now has excellent pot odds." },
        { type: "mcq", q: "3 players in (300 pot). Flop bet of 150. You have a flush draw (36% equity). Call or fold?", opts: ["Fold — 36% isn't enough", "Call — 150 to win 600 = 25% needed, you have 36%", "Only call heads-up, not multiway"], a: 1, why: "Call 150 to win 600 (300 pot + 150 bet + 150 call) = 25% equity needed. Your 36% flush draw equity is well above the required 25%." },
      ]},
      { id: "stack-1", title: "Short-stack push or fold", min: 4, xp: 60, steps: [
        { type: "info", heading: "Under 15bb, simplify", body: "Short stack hand:\nJ♠J♦\n\nWith a short stack, standard poker breaks. Raising small then folding to a re-raise wastes chips. The right framework: shove all-in or fold. Nothing in between." },
        { type: "mcq", q: "You have 12bb. UTG raises to 2.5bb. You have J♠J♦. Best play?", opts: ["Call — see the flop cheaply", "Raise to 5bb", "Shove all-in"], a: 2, why: "With 12bb and JJ, you're committed to the hand. Shoving immediately builds the pot and avoids an awkward spot where you raise then face a 3-bet. Shove and get your money in good." },
        { type: "info", heading: "Why shoving works", body: "Short stack shove:\nA♠9♠\n\nShoving wins the pot immediately if everyone folds (which happens often). When called, you usually have 35–50% equity. Opponent needs a real hand to call." },
        { type: "mcq", q: "You shove 10bb from the Button. The SB folds. The BB needs ~38% equity to call profitably. What does this mean for you?", opts: ["You should never shove — they always have the right odds", "The BB needs a real hand to call — weak hands like K5o or T8o are folds for them", "You need 62% equity to shove profitably"], a: 1, why: "Forcing opponents to need 38%+ equity to call means most of their range folds. Fold equity is the key advantage of short-stack shoves." },
        { type: "info", heading: "Shove range by seat", body: "Button shove (widest):\nK♦7♠\n\nThe shorter your stack and the later your position, the wider you shove.\nButton at 10bb: shove ~35%. SB vs BB: shove up to 45%. UTG at 10bb: shove ~18%." },
        { type: "mcq", q: "You have 8bb in the SB. BB is the only player left. You hold K♦7♠. Correct play?", opts: ["Fold — K7o is weak", "Shove — K7o is a standard shove SB vs BB at 8bb", "Min-raise to 2bb"], a: 1, why: "K7o from the SB vs BB at 8bb is a clear shove. You have position on the BB, and K7o is well above the shove threshold at this stack depth." },
        { type: "mcq", q: "You have 12bb on the Button. Dealt 3♠3♦. UTG folds to you. Best play?", opts: ["Fold — pairs play poorly short-stacked", "Open to 2.5bb", "Shove all-in"], a: 2, why: "33 at 12bb on the button is a standard shove. You're not raising small — shove or fold is the framework. 33 beats the calling range enough to make it +EV." },
      ]},
    ]
  },
  { id: "ch5", chapter: 5, title: "Advanced", suit: "♦", desc: "3-betting, blockers, river decisions, and exploitation",
    modules: [
      { id: "adv-1", title: "3-bet strategy", min: 5, xp: 75, steps: [
        { type: "info", heading: "What is a 3-bet?", body: "Value 3-bet:\nA♠A♦\n\nBluff 3-bet:\nA♣5♣\n\nA 3-bet = re-raise over an open. Value: AA, KK, QQ, JJ, AK — want a large pot. Bluff: A5s, A4s, 76s — blockers + playability when called." },
        { type: "mcq", q: "Why include A5s as a 3-bet bluff instead of something like T9s?", opts: ["A5s is stronger than T9s", "A5s blocks AA and AK combos — opponent less likely to have strong hands", "A5s has more outs"], a: 1, why: "A5s holds the ace, reducing AA and AK combos in opponent's range. Fewer strong hands = more fold equity. Plus A5s has backdoor nut flush draws when called." },
        { type: "info", heading: "3-bet sizing", body: "IP 3-bet (Button):\nK♠K♦\n\nOOP 3-bet (BB):\nQ♥Q♣\n\nIn position: 3× the open.\nOut of position: 3.5–4× the open.\nLarger OOP — you'll play a bigger pot without positional advantage." },
        { type: "mcq", q: "UTG opens to 3bb. You're on the BTN with KK. Best 3-bet size?", opts: ["6bb (2× the open)", "9bb (3× the open — standard IP)", "15bb (too large)"], a: 1, why: "In position, 3× the open is standard: 3 × 3bb = 9bb. Builds a pot with your premium while keeping in bluff-catchers and worse value hands." },
        { type: "info", heading: "Facing a 3-bet", body: "You opened:\nK♠J♦\n\nOpponent 3-bets. Fold this.\n\nContinue with premiums (4-bet or call), best suited hands IP (call). Fold weak broadways, offsuit combos, marginal hands." },
        { type: "mcq", q: "You opened K♠J♦ from CO. Button 3-bets to 9bb. You should:", opts: ["Call — KJ is strong enough", "Fold — KJo is too weak to continue vs a 3-bet", "4-bet — represent a monster"], a: 1, why: "KJo vs a button 3-bet is a fold. You're out of position with a hand that's dominated by AK, AJ, KQ, and all the pairs in a 3-bet range." },
        { type: "mcq", q: "You 3-bet KK from the BTN vs UTG. UTG 4-bets. You should:", opts: ["Fold — they always have AA when they 4-bet", "5-bet shove or call — KK is too strong to fold", "Call and reassess the flop"], a: 1, why: "KK vs a 4-bet is a 5-bet shove or call. Folding KK preflop is almost always a mistake — you're only losing to AA (6 combos) and dominating everything else." },
      ]},
      { id: "adv-2", title: "Blockers & combinatorics", min: 5, xp: 75, steps: [
        { type: "info", heading: "Combo counts are fixed", body: "Unpaired hand (16 combos total):\nA♠K♦\n\nPocket pair (6 combos):\nA♠A♦\n\nEvery unpaired hand: 16 combos. Suited: 4 combos. Pocket pairs: 6 combos. These never change." },
        { type: "mcq", q: "How many total AK combos exist in a fresh deck?", opts: ["4 (only suited)", "12 (only offsuit)", "16 (4 suited + 12 offsuit)"], a: 2, why: "AK: 4 suited combos (AsKs, AhKh, AdKd, AcKc) + 12 offsuit combos = 16 total. Same as any other unpaired hand." },
        { type: "info", heading: "Blockers reduce combos", body: "You hold:\nA♠K♠\n\nOpponent's remaining AA:\nA♥A♦\n\nYou hold A♠: their AA drops 6 → 3 combos. Their AK drops 16 → 12 combos. You 'block' their strongest hands." },
        { type: "mcq", q: "You hold K♠. How many KK combos can your opponent have?", opts: ["6 — standard pair combos", "3 — you hold K♠, only K♥K♦, K♥K♣, K♦K♣ remain", "0 — you have a king so they can't"], a: 1, why: "KK normally = 6 combos. Holding K♠ eliminates all combos containing K♠ (K♠K♥, K♠K♦, K♠K♣). That leaves 3 combos." },
        { type: "info", heading: "Nut blocker", body: "Board:\nK♣Q♣8♣\n\nYou hold:\nA♣\n\nThe A♣ = nut blocker. You hold it → opponent CANNOT have the nut flush. Perfect card to bluff with." },
        { type: "mcq", q: "Board: K♣Q♣8♣. You hold A♣. How many nut flush combos does your opponent have?", opts: ["9 — one per remaining club", "0 — you hold the A♣, they can't have the nut flush", "4 — only suited combinations"], a: 1, why: "The nut flush on a club board requires the A♣ — which you hold. Zero nut flush combos for them. Perfect card to bluff with: you block their strongest calling hand." },
        { type: "mcq", q: "Deciding whether to river bluff on a spade board. You hold A♠. This makes your bluff:", opts: ["Weaker — you might have the flush, not a bluff", "More credible — you block the nut flush, so they're less likely to have the best calling hand", "Irrelevant — blockers don't affect bluffing"], a: 1, why: "Holding A♠ means they're less likely to have the nut flush (the hand that comfortably calls your bluff). Fewer strong callers = your bluff succeeds more often." },
      ]},
      { id: "adv-3", title: "River decisions", min: 4, xp: 75, steps: [
        { type: "info", heading: "No more cards", body: "Your hand:\nK♠Q♦\n\nBoard:\nK♥7♣2♠J♦9♥\n\nOn the river, hand values are frozen. The only question: bet for value, bluff, or check? Before betting: 'Can I name 2 worse hands that call?' If yes — bet." },
        { type: "mcq", q: "You have second pair on the river. Opponent checks. Their range: 40% missed draws, 35% weak pairs, 25% top pair. Should you bet?", opts: ["No — second pair isn't strong enough", "Yes — you beat 75% of their range (missed draws + weak pairs)", "Only if you have the nuts"], a: 1, why: "You beat missed draws and weak pairs = 75% of their range. Betting extracts value from all those hands. Checking wins nothing from the missed draws." },
        { type: "info", heading: "Thin value", body: "Your hand:\nJ♠9♦\n\nBoard:\nK♣Q♥8♦5♠2♣\n\nThin value = betting with a hand that beats SOME but not most of the range. Even at 40% equity, a correctly-sized bet is profitable over thousands of hands." },
        { type: "mcq", q: "You have third pair on the river. Opponent has many busted draws in their range. Should you bet a small amount for thin value?", opts: ["No — third pair is never worth betting", "Yes — busted draws fold to any bet, so even thin value extracts chips", "Only if you have a backdoor draw"], a: 1, why: "Busted draws have zero showdown value — they fold to any bet. Third pair beats those hands. A small value bet extracts chips from a significant portion of their range." },
        { type: "info", heading: "Hero calls", body: "Board:\nA♣K♦7♥5♠2♥\n\nYou hold:\nA♥J♠\n\nHero call = calling a big bet with a medium hand.\nProfit condition: bluff frequency > equity needed.\nPot-sized bet needs 33%. If they bluff >33% here, call." },
        { type: "mcq", q: "River: pot 300, opponent bets 300 (pot-sized). You estimate they bluff 40% here. Call or fold?", opts: ["Fold — they might have the best hand", "Call — 40% bluff frequency > 33% equity needed", "Raise — put maximum pressure"], a: 1, why: "Pot-sized bet needs 33% equity. Opponent bluffs 40% of the time here. 40% > 33% → calling is profitable. The math overrules the fear of being wrong." },
        { type: "mcq", q: "You missed your flush draw on the river. No showdown value. Opponent checks. Should you bluff?", opts: ["No — missed draws should never bluff", "Yes, IF you can represent a hand that fits your preflop range and the board run-out", "Only if the pot is huge"], a: 1, why: "Missed draws are prime bluffing hands — you have zero showdown value, so you must either bluff or give up. Bluff when you have a credible story and opponent has folding hands in their range." },
      ]},
      { id: "adv-4", title: "Exploitative play", min: 4, xp: 75, steps: [
        { type: "info", heading: "GTO vs. exploitative", body: "GTO hand (balanced):\nA♠5♠\n\nValue hand (exploit):\nK♣K♦\n\nGTO = unexploitable, balanced play. Exploitative = maximizing profit vs. a SPECIFIC opponent's mistakes. At low stakes, exploit > GTO." },
        { type: "mcq", q: "Your opponent calls 85% of your bets and never folds. Best adjustment?", opts: ["Bluff more — pressure will eventually work", "Stop bluffing entirely, value bet thinner hands", "Bet smaller to get more calls"], a: 1, why: "Calling stations have no fold equity to offer. Stop bluffing (they call those too). Value bet thin hands for 3 streets — even second pair gets 3 streets of value against them." },
        { type: "info", heading: "Exploit the calling station", body: "Value bet 3 streets with:\nJ♠9♦\n\nBoard:\nJ♥8♣3♠\n\nAgainst a calling station:\n• Eliminate bluffs completely.\n• Value bet hands you'd normally check.\n• Go 3 streets with any made hand.\n• Size up your value bets." },
        { type: "mcq", q: "A nit (overly tight player) folds to 75% of c-bets. Best flop adjustment?", opts: ["Check more often to induce bluffs", "C-bet almost every flop regardless of hand strength", "Only c-bet when you have top pair"], a: 1, why: "If they fold 75% of the time, every c-bet is immediately profitable. Bet any flop — even air. Their over-folding is money on the table." },
        { type: "info", heading: "Exploit the nit", body: "Nit suddenly 3-bets:\nA♠A♣\n\nYour hand (fold):\nK♠Q♦\n\nSteal blinds constantly. 3-bet their opens freely. Fire multiple barrels. But fold the moment they raise — nits only raise with the nuts." },
        { type: "mcq", q: "A tight player who almost never 3-bets suddenly 3-bets you. You have KQ. Best play?", opts: ["Call — KQ is strong enough", "Fold — nits only 3-bet premiums; KQ is almost certainly behind", "4-bet bluff — they're scared"], a: 1, why: "Nits' 3-bet range is extremely narrow (usually QQ+, AK). KQ is dominated by most of it. Fold without regret — they showed you what they have." },
        { type: "mcq", q: "Long term at low stakes: GTO or exploitative play is more profitable?", opts: ["GTO — it can't be beaten", "Exploitative — opponents deviate so far from optimal that exploiting their mistakes beats any balanced approach", "Same — both break even"], a: 1, why: "GTO is optimal vs. optimal opponents. Against recreational and weak players who make systematic mistakes, exploiting those specific mistakes yields far higher profits than playing balanced." },
      ]},
    ]
  },
];
const MODULE_INDEX = {};
LEARN.forEach((ch) => ch.modules.forEach((m) => (MODULE_INDEX[m.id] = { ...m, topic: ch.title })));

const CURRICULUM_ORDER = LEARN.flatMap((ch) => ch.modules.map((m) => m.id));

function getFrontier(progress) {
  return CURRICULUM_ORDER.find((id) => !progress[id]) || null;
}
function isModuleLocked(moduleId, progress) {
  if (UNLOCK_ALL_FOR_TESTING) return false;
  const idx = CURRICULUM_ORDER.indexOf(moduleId);
  if (idx <= 0) return false;
  for (let i = 0; i < idx; i++) { if (!progress[CURRICULUM_ORDER[i]]) return true; }
  return false;
}

/* ============================ ENGAGEMENT ENGINE: chips, levels, quests, badges ============================ */
// Chips are the single reward currency: xp_chips is the spendable balance, xp_total is
// lifetime chips earned and never decreases — it drives the player level.
function awardChips(tsIn, n) {
  const ts = { ...(tsIn || {}) };
  const today = new Date().toISOString().slice(0, 10);
  ts.xp_total = (ts.xp_total != null ? ts.xp_total : ts.xp_chips || 0) + n;
  ts.xp_chips = (ts.xp_chips || 0) + n;
  if (ts.daily_chips_date === today) ts.daily_chips = (ts.daily_chips || 0) + n;
  else { ts.daily_chips = n; ts.daily_chips_date = today; }
  return bumpQuest(ts, "chips", n);
}
const xpTotalOf = (ts) => (ts && (ts.xp_total != null ? ts.xp_total : ts.xp_chips)) || 0;
const levelNeed = (lv) => 80 + (lv - 1) * 45;
function levelInfo(xpTotal) {
  let lv = 1, rem = Math.max(0, xpTotal || 0);
  while (rem >= levelNeed(lv) && lv < 99) { rem -= levelNeed(lv); lv++; }
  return { level: lv, into: rem, need: levelNeed(lv), pct: Math.min(1, rem / levelNeed(lv)) };
}

const QUEST_POOL = [
  { id: "drill",   icon: "🎯", title: "Finish the daily drill", target: 1,  reward: 30 },
  { id: "hands",   icon: "♠️", title: "Play 10 hands",          target: 10, reward: 25 },
  { id: "wins",    icon: "🏆", title: "Win 3 pots",             target: 3,  reward: 25 },
  { id: "puzzles", icon: "🧠", title: "Nail 5 puzzles",         target: 5,  reward: 20 },
  { id: "lesson",  icon: "📗", title: "Complete a lesson",      target: 1,  reward: 25 },
  { id: "chips",   icon: "🪙", title: "Earn 60 chips",          target: 60, reward: 20 },
];
// 3 quests per day, same set for everyone (date-seeded).
function dailyQuestSet() {
  const d = new Date();
  const rng = mulberry32((d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) * 7 + 3);
  const pool = [...QUEST_POOL], picks = [];
  while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return picks;
}
function questsFor(ts) {
  const today = new Date().toISOString().slice(0, 10);
  const q = (ts && ts.quests && ts.quests.date === today) ? ts.quests : { progress: {}, claimed: {} };
  return dailyQuestSet().map((def) => ({
    ...def,
    n: Math.min((q.progress || {})[def.id] || 0, def.target),
    done: ((q.progress || {})[def.id] || 0) >= def.target,
    claimed: !!(q.claimed || {})[def.id],
  }));
}
function bumpQuest(tsIn, type, n = 1) {
  const ts = { ...(tsIn || {}) };
  const today = new Date().toISOString().slice(0, 10);
  const q = ts.quests && ts.quests.date === today ? { ...ts.quests } : { date: today, progress: {}, claimed: {} };
  q.progress = { ...(q.progress || {}), [type]: ((q.progress || {})[type] || 0) + n };
  ts.quests = q;
  return ts;
}
// Returns [newTrainerState, rewardChips]; reward is 0 when the quest isn't claimable.
function claimQuest(tsIn, id) {
  const def = QUEST_POOL.find((x) => x.id === id);
  const today = new Date().toISOString().slice(0, 10);
  const q = tsIn && tsIn.quests && tsIn.quests.date === today ? tsIn.quests : null;
  if (!def || !q || ((q.progress || {})[id] || 0) < def.target || (q.claimed || {})[id]) return [tsIn, 0];
  const ts = { ...tsIn, quests: { ...q, claimed: { ...(q.claimed || {}), [id]: true } } };
  ts.questsClaimed = (ts.questsClaimed || 0) + 1;
  return [awardChips(ts, def.reward), def.reward];
}
const questClaimable = (ts) => questsFor(ts).some((x) => x.done && !x.claimed);

const BADGES = [
  { id: "dealt-in",   icon: "♠",  name: "Dealt in",        desc: "Play your first hand",        check: (c) => c.hands >= 1 },
  { id: "grind-100",  icon: "🃏", name: "Century club",    desc: "Play 100 hands",              check: (c) => c.hands >= 100 },
  { id: "grind-500",  icon: "🎰", name: "Table regular",   desc: "Play 500 hands",              check: (c) => c.hands >= 500 },
  { id: "grind-1k",   icon: "🗿", name: "Iron grinder",    desc: "Play 1,000 hands",            check: (c) => c.hands >= 1000 },
  { id: "student",    icon: "🎓", name: "Student",         desc: "Finish your first lesson",    check: (c) => c.mods >= 1 },
  { id: "ch1",        icon: "📗", name: "Foundations",     desc: "Complete Chapter 1",          check: (c) => c.ch1 },
  { id: "curriculum", icon: "👑", name: "Curriculum king", desc: "Complete every module",       check: (c) => c.allMods },
  { id: "streak-3",   icon: "🔥", name: "Warming up",      desc: "3-day streak",                check: (c) => c.streak >= 3 },
  { id: "streak-7",   icon: "🔥", name: "Week of fire",    desc: "7-day streak",                check: (c) => c.streak >= 7 },
  { id: "streak-14",  icon: "🌋", name: "Two weeks deep",  desc: "14-day streak",               check: (c) => c.streak >= 14 },
  { id: "streak-30",  icon: "☄️", name: "Unstoppable",     desc: "30-day streak",               check: (c) => c.streak >= 30 },
  { id: "clean-10",   icon: "⚡", name: "Surgeon",         desc: "10 correct calls in a row",   check: (c) => c.clean >= 10 },
  { id: "clean-25",   icon: "💎", name: "Machine",         desc: "25 correct calls in a row",   check: (c) => c.clean >= 25 },
  { id: "puzzle-50",  icon: "🧠", name: "Puzzle hound",    desc: "Solve 50 trainer spots",      check: (c) => c.puzzles >= 50 },
  { id: "puzzle-250", icon: "🧬", name: "Spot savant",     desc: "Solve 250 trainer spots",     check: (c) => c.puzzles >= 250 },
  { id: "flawless",   icon: "✦",  name: "Flawless ten",    desc: "A perfect 10/10 daily drill", check: (c) => c.perfectDrills >= 1 },
  { id: "drill-7",    icon: "🎯", name: "Daily devotee",   desc: "Finish 7 daily drills",       check: (c) => c.drills >= 7 },
  { id: "chips-500",  icon: "🪙", name: "Chip stacker",    desc: "Earn 500 chips lifetime",     check: (c) => c.xpTotal >= 500 },
  { id: "chips-2k",   icon: "💰", name: "High roller",     desc: "Earn 2,000 chips lifetime",   check: (c) => c.xpTotal >= 2000 },
  { id: "level-5",    icon: "📈", name: "Rising star",     desc: "Reach level 5",               check: (c) => c.level >= 5 },
  { id: "level-10",   icon: "🥇", name: "Veteran",         desc: "Reach level 10",              check: (c) => c.level >= 10 },
  { id: "shark",      icon: "🦈", name: "Shark",           desc: "Reach 1650 Edge",             check: (c) => c.rating >= 1650 },
  { id: "crusher",    icon: "🏆", name: "Crusher",         desc: "Reach 1900 Edge",             check: (c) => c.rating >= 1900 },
  { id: "combo-5",    icon: "🌀", name: "Combo artist",    desc: "Hit a 5-combo in a lesson",   check: (c) => c.combo >= 5 },
  { id: "quests-10",  icon: "🗝", name: "Quest master",    desc: "Claim 10 quest rewards",      check: (c) => c.claims >= 10 },
  { id: "night-owl",  icon: "🌙", name: "Night owl",       desc: "Grind after midnight",        check: (c) => c.active && c.hour >= 0 && c.hour < 5 },
  { id: "early-bird", icon: "🌅", name: "Early bird",      desc: "Grind before 7am",            check: (c) => c.active && c.hour >= 5 && c.hour < 7 },
];
function badgeCtx(ts, lifetime, progress, streak, rating) {
  const fam = (ts && ts.famStats) || {};
  return {
    hands: (lifetime && lifetime.hands) || 0,
    mods: Object.keys(progress || {}).filter((id) => MODULE_INDEX[id]).length,
    ch1: LEARN[0].modules.every((m) => (progress || {})[m.id]),
    allMods: CURRICULUM_ORDER.every((id) => (progress || {})[id]),
    streak: Math.max(streak || 0, (ts && ts.bestStreak) || 0),
    clean: (ts && ts.cleanBest) || 0,
    puzzles: Object.values(fam).reduce((s, f) => s + (f.n || 0), 0),
    perfectDrills: (ts && ts.perfectDrills) || 0,
    drills: (ts && ts.drillsDone) || 0,
    xpTotal: xpTotalOf(ts),
    level: levelInfo(xpTotalOf(ts)).level,
    rating: rating || 0,
    combo: (ts && ts.bestCombo) || 0,
    claims: (ts && ts.questsClaimed) || 0,
    hour: new Date().getHours(),
  };
}
// Sweep the catalog; returns [newTrainerState, freshlyEarnedBadges].
function checkBadges(tsIn, ctx) {
  const got = { ...((tsIn && tsIn.badges) || {}) };
  const fresh = [];
  BADGES.forEach((b) => {
    if (!got[b.id] && b.check(ctx)) { got[b.id] = new Date().toISOString().slice(0, 10); fresh.push(b); }
  });
  return fresh.length ? [{ ...(tsIn || {}), badges: got }, fresh] : [tsIn, fresh];
}

/* ============================ UI ATOMS ============================ */
function PlayingCard({ card, hidden, w = 38, deal }) {
  const h = w * 1.42;
  if (hidden || !card) {
    const backs = {
      classic:        `repeating-linear-gradient(135deg, #27483A 0 3px, #1B3A2D 3px 6px)`,
      "back-crimson": `repeating-linear-gradient(135deg, #5A1F1C 0 3px, #3A1210 3px 6px)`,
      "back-gold":    `repeating-linear-gradient(45deg, #4A3A14 0 3px, #2E240C 3px 6px)`,
      "back-jade":    `repeating-linear-gradient(135deg, #1A3D28 0 3px, #0E2618 3px 6px)`,
      "back-royal":   `repeating-radial-gradient(circle at 50% 50%, #2A2050 0 4px, #1A1432 4px 8px)`,
      "back-ocean":   `repeating-linear-gradient(135deg, #0F3040 0 3px, #071E2A 3px 6px)`,
    };
    return (
      <div style={{ width: w, height: h, borderRadius: w * 0.14, background: backs[COSMETICS.back] || backs.classic, border: `1.5px solid ${T.brassDim}`, boxShadow: "0 2px 5px rgba(0,0,0,.45)" }} />
    );
  }
  const red = SUIT_RED[card.s];
  return (
    <div className={deal ? "deal" : ""} style={{ width: w, height: h, borderRadius: w * 0.14, background: T.card, color: red ? T.cordovan : T.ink, border: "1px solid rgba(0,0,0,.25)", boxShadow: "0 2px 6px rgba(0,0,0,.5)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
      <div className="mono" style={{ fontSize: w * 0.42, fontWeight: 600 }}>{rankLabel(card.r)}</div>
      <div style={{ fontSize: w * 0.42 }}>{SUIT_GLYPH[card.s]}</div>
    </div>
  );
}
function Btn({ children, onClick, kind = "ghost", style, disabled }) {
  const base = { padding: "12px 16px", borderRadius: 12, fontSize: 15, fontWeight: 600, border: "1px solid rgba(201,165,70,0.15)", background: "rgba(10,26,18,0.55)", color: T.card, opacity: disabled ? 0.4 : 1, transition: "transform .08s ease" };
  const kinds = {
    primary: { background: T.brass, color: "#1B1505", border: "1px solid " + T.brass, boxShadow: "0 4px 20px rgba(201,165,70,0.28)" },
    danger: { background: "transparent", color: T.bad, border: "1px solid rgba(224,113,107,.4)" },
    felt: { background: T.baize2, border: "1px solid " + T.line },
  };
  return (
    <button disabled={disabled} onClick={onClick} style={{ ...base, ...(kinds[kind] || {}), ...style }} onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = "scale(.97)")} onMouseUp={(e) => (e.currentTarget.style.transform = "none")} onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}>
      {children}
    </button>
  );
}
function StatChip({ label, value, accent }) {
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "2px 4px" }}>
      <div className="serif" style={{ fontSize: 27, lineHeight: 1, color: accent || T.card }}>{value}</div>
      <div style={{ fontSize: 9.5, color: T.faint, marginTop: 6, textTransform: "uppercase", letterSpacing: ".12em" }}>{label}</div>
    </div>
  );
}
function SectionTitle({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "22px 0 11px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 11, color: T.brass, letterSpacing: ".16em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{children}</div>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${T.line}, transparent)` }} />
      </div>
      {right}
    </div>
  );
}
function RangeGrid({ pos = "BTN", compact, heroCode }) {
  // 13x13 starting-hand matrix, the chart every poker player reads instantly.
  // Pairs on the diagonal, suited upper-right, offsuit lower-left.
  const order = "AKQJT98765432".split("");
  const range = OPEN_RANGE[pos] || new Set();
  const cell = compact ? 17 : 21;
  const inRange = (code) => range.has(code);
  const codeFor = (i, j) => {
    const hi = order[i], lo = order[j];
    if (i === j) return hi + lo;          // pair
    if (i < j) return hi + lo + "s";      // suited (upper-right of diagonal)
    return lo + hi + "o";                 // offsuit
  };
  const pct = Math.round((OPEN_PCT[pos] || 0) * 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["UTG", "HJ", "CO", "BTN", "SB"].map((p) => (
            <span key={p} className="mono" style={{ fontSize: 10.5, padding: "3px 7px", borderRadius: 6, color: p === pos ? "#1B1505" : T.mist, background: p === pos ? T.brass : "transparent", border: "1px solid " + (p === pos ? T.brass : T.line) }}>{p}</span>
          ))}
        </div>
        <span className="mono" style={{ fontSize: 11, color: T.brass }}>{pct}% of hands</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(13, ${cell}px)`, gap: 2, justifyContent: "center" }}>
        {order.map((_, i) => order.map((__, j) => {
          const code = codeFor(i, j);
          const on = inRange(code);
          const isPair = i === j;
          return (
            <div key={i + "-" + j} className="mono" title={code} style={{
              width: cell, height: cell, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: compact ? 7.5 : 9, borderRadius: 3,
              background: on ? (isPair ? T.brass : "rgba(201,165,70,.32)") : "rgba(255,255,255,.025)",
              color: on ? (isPair ? "#1B1505" : T.card) : T.faint,
              fontWeight: isPair ? 700 : 400,
              outline: heroCode && code === heroCode ? `2px solid ${T.good}` : "none",
              outlineOffset: "1px",
              zIndex: heroCode && code === heroCode ? 1 : "auto",
              position: "relative",
            }}>{compact ? "" : code.replace(/[so]$/, "")}</div>
          );
        }))}
      </div>
      {!compact && (
        <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 10.5, color: T.faint }}>
          <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: T.brass, marginRight: 5, verticalAlign: "middle" }} />Pairs</span>
          <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "rgba(201,165,70,.32)", marginRight: 5, verticalAlign: "middle" }} />In your raising range</span>
          <span style={{ marginLeft: "auto" }}>Suited up-right, offsuit down-left</span>
        </div>
      )}
    </div>
  );
}
function RatingBar({ value, delta, band }) {
  const tier = tierOf(value);
  const pct = Math.min(100, Math.max(0, ((value - 400) / 2400) * 100));
  const [info, setInfo] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span>
          <span className="mono" style={{ fontSize: 26, color: T.brass, fontWeight: 600 }}>{Math.round(value)}</span>
          <span className="serif" style={{ fontSize: 15, color: T.card, marginLeft: 8 }}>{tier}</span>
          <button onClick={() => setInfo((v) => !v)} aria-label="What is Edge?" style={{ marginLeft: 8, width: 18, height: 18, borderRadius: "50%", border: `1px solid ${T.line}`, background: info ? T.brass : "transparent", color: info ? "#1B1505" : T.mist, fontSize: 11, fontStyle: "italic", fontWeight: 700, lineHeight: 1, padding: 0, verticalAlign: "middle" }}>i</button>
        </span>
        {delta != null && <span className="mono" style={{ fontSize: 13, color: delta >= 0 ? T.good : T.bad }}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}</span>}
      </div>
      {info && (
        <div className="fadeup" style={{ background: "rgba(201,165,70,.07)", border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px", marginBottom: 10, fontSize: 12, color: T.mist, lineHeight: 1.55 }}>
          <b style={{ color: T.brass }}>Edge</b> rates the quality of your decisions, not whether you won or lost a hand. A correct fold that saves chips counts for you even in a pot you lost, and a lucky win with a bad call does not. It moves like a chess rating: beat tougher spots and it climbs. Most beginners start near 1000, and a solid winning player sits past 1500.
        </div>
      )}
      <div style={{ height: 8, borderRadius: 4, background: "rgba(201,165,70,0.08)", border: "1px solid " + T.line, position: "relative" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 4, background: `linear-gradient(90deg, ${T.brassDim}, ${T.brass})`, transition: "width .6s ease" }} />
        {TIERS.slice(1).map(([m]) => (
          <div key={m} style={{ position: "absolute", left: `${((m - 400) / 2400) * 100}%`, top: 0, bottom: 0, width: 1, background: "rgba(201,165,70,.25)" }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: T.faint, marginTop: 3 }}>
        <span>400</span><span>Edge Rating</span><span>2800</span>
      </div>
      <div style={{ fontSize: 11, color: T.mist, marginTop: 8, lineHeight: 1.45 }}>{TIER_MEANING[tier]}</div>
    </div>
  );
}
function NavBar({ screen, go, alerts = {} }) {
  const items = [
    { id: "home", label: "Home", glyph: "♣" },
    { id: "play", label: "Play", glyph: "♠" },
    { id: "log", label: "Log", glyph: "◈" },
    { id: "learn", label: "Learn", glyph: "♦" },
    { id: "profile", label: "Profile", glyph: "♥" },
  ];
  return (
    <nav className="gp" style={{ position: "fixed", bottom: 0, left: "max(0px, calc(50% - 220px))", right: "max(0px, calc(50% - 220px))", display: "flex", background: "rgba(8,18,13,0.72)", borderTop: "1px solid " + T.line, zIndex: 30 }}>
      {items.map((it) => {
        const playScreens = ["play", "lobby", "review", "replay", "mpsetup", "mptable", "puzzle", "puzzlereview", "mpreview"];
        const learnScreens = ["learn", "module"];
        const on = it.id === "play" ? playScreens.includes(screen) : it.id === "learn" ? learnScreens.includes(screen) : screen === it.id;
        const red = it.glyph === "♥" || it.glyph === "♦";
        const glyphColor = on ? (red ? T.cordovan : T.brass) : (red ? "rgba(224,113,107,.7)" : "rgba(201,165,70,.72)");
        return (
          <button key={it.id} onClick={() => go(it.id)} aria-label={it.label} style={{ flex: 1, padding: "10px 0 8px", display: "flex", flexDirection: "column", alignItems: "center", background: "none", border: "none", color: on ? (red ? T.cordovan : T.brass) : T.mist, position: "relative" }}>
            {alerts[it.id] && !on && <span style={{ position: "absolute", top: 6, left: "calc(50% + 9px)", width: 7, height: 7, borderRadius: "50%", background: T.cordovan, boxShadow: "0 0 6px rgba(194,69,62,.8)", animation: "riqDotBlink 1.6s ease infinite" }} />}
            <div style={{ fontSize: it.glyph === "◈" ? 16 : 20, lineHeight: 1, color: glyphColor }}>{it.glyph}</div>
            <div style={{ fontSize: 10, marginTop: 3, letterSpacing: ".05em", textTransform: "uppercase", fontWeight: on ? 700 : 500, color: on ? (red ? T.cordovan : T.brass) : T.mist }}>{it.label}</div>
          </button>
        );
      })}
    </nav>
  );
}

/* ============================ PLAY SCREEN ============================ */
const SEAT_POS = [
  { left: "50%", top: "86%" },  // hero
  { left: "9%",  top: "68%" },
  { left: "7%",  top: "28%" },
  { left: "50%", top: "9%" },
  { left: "93%", top: "28%" },
  { left: "91%", top: "68%" },
];
function Seat({ p, idx, game, isHero, intro, actionLabel, showdownReady, staticLabel, thinking }) {
  const acting = (game.toAct === idx && game.street !== "result") || thinking;
  const isBtn = game.button === idx;
  const showCards = isHero || (game.street === "result" && game.wentToShowdown && !p.folded && showdownReady);
  const won = game.winners && game.winners.some((w) => w.idx === idx);
  return (
    <div style={{ position: "absolute", ...SEAT_POS[idx], transform: "translate(-50%,-50%)", textAlign: "center", opacity: p.folded ? 0.38 : 1, transition: "opacity .3s", zIndex: 5 }}>
      <div style={{ display: "flex", gap: 3, justifyContent: "center", marginBottom: 4, minHeight: isHero ? 64 : 44 }}>
        {!p.folded && p.cards && p.cards.map((c, i) => (
          <PlayingCard key={i} card={showCards ? c : null} hidden={!showCards} w={isHero ? 44 : 30} deal={game.street === "preflop" && game.log.length === 0} />
        ))}
        {p.folded && intro && p.cards && p.cards.map((c, i) => (
          <div key={"m" + i} style={{ animation: `riqMuck .8s ease ${0.35 + idx * 0.3}s both` }}>
            <PlayingCard hidden w={30} />
          </div>
        ))}
      </div>
      <div style={{ background: won ? "rgba(201,165,70,.18)" : "rgba(7,16,11,.88)", border: `1.5px solid ${acting ? T.brass : won ? T.brass : T.line}`, borderRadius: 10, padding: "4px 9px", minWidth: 76, animation: acting ? "riqPulse 1.4s infinite" : "none", position: "relative" }}>
        {actionLabel && (
          <div key={actionLabel.key} style={{ position: "absolute", top: -22, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}>
            <span className="mono" style={{ background: "rgba(20,17,15,0.97)", border: `1px solid ${T.line}`, borderRadius: 99, padding: "2px 8px", fontSize: 10, fontWeight: 600, color: T.card, whiteSpace: "nowrap", lineHeight: "16px", animation: "riqActionLabel 2s ease forwards" }}>{actionLabel.text}</span>
          </div>
        )}
        {staticLabel && (
          <div style={{ position: "absolute", top: -24, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}>
            <span className="mono" style={{ background: "rgba(14,10,6,0.96)", border: `1px solid ${staticLabel.color || T.line}`, borderRadius: 99, padding: "2px 9px", fontSize: 10, fontWeight: 700, color: staticLabel.color || T.card, whiteSpace: "nowrap", lineHeight: "17px", opacity: staticLabel.visible ? 1 : 0, transform: staticLabel.visible ? "translateY(0)" : "translateY(-5px)", transition: "opacity 0.35s ease, transform 0.35s ease", boxShadow: staticLabel.visible ? `0 0 8px ${staticLabel.color || T.line}44` : "none" }}>{staticLabel.text}</span>
          </div>
        )}
        <div style={{ fontSize: 11, fontWeight: 700, color: won ? T.brass : T.card }}>{p.name}{isBtn && <span style={{ color: T.brass }}> ⓓ</span>}</div>
        <div className="mono" style={{ fontSize: 11.5, color: p.allIn ? T.cordovan : T.mist }}>{p.allIn ? "ALL-IN" : p.stack.toLocaleString()}</div>
      </div>
      {p.bet > 0 && game.street !== "result" && (
        <div className="mono" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", [idx === 0 ? "top" : "bottom"]: idx === 0 ? -26 : -26, background: "rgba(194,69,62,.92)", color: "#fff", borderRadius: 99, padding: "2px 9px", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", animation: intro ? "riqChipIn .45s ease 1.45s both" : "none" }}>
          {p.bet.toLocaleString()}
        </div>
      )}
    </div>
  );
}
function StrengthStrip({ hero, board, equity }) {
  const name = handName(hero, board);
  const pct = Math.round(equity * 100);
  return (
    <div className="gp" style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(10,26,18,0.72)", border: "1px solid " + T.line, borderLeft: `3px solid ${T.brass}`, borderRadius: 12, padding: "9px 14px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="serif" style={{ fontSize: 17, color: T.card, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ height: 5, borderRadius: 3, background: "rgba(201,165,70,0.08)", marginTop: 5 }}>
          <div style={{ height: "100%", width: pct + "%", borderRadius: 3, background: pct > 60 ? T.good : pct > 35 ? T.brass : T.cordovan, transition: "width .5s ease" }} />
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="mono" style={{ fontSize: 21, fontWeight: 600, color: pct > 60 ? T.good : pct > 35 ? T.brass : T.cordovan }}>{pct}%</div>
        <div style={{ fontSize: 9.5, color: T.faint, letterSpacing: ".07em" }}>EQUITY</div>
      </div>
    </div>
  );
}
const STREET_LABEL = { preflop: "PRE", flop: "FLOP", turn: "TURN", river: "RIVER", result: "," };

function PlayScreen({ game, setGame, equity, onHeroAct, onNextHand, onEndSession, sessionHandCount }) {
  const hero = game.players[0];
  const toCall = Math.max(0, game.currentBet - hero.bet);
  const heroTurn = game.toAct === 0 && game.street !== "result";
  const minRaiseTo = Math.min(game.currentBet + game.minRaise, hero.bet + hero.stack);
  const maxRaiseTo = hero.bet + hero.stack;
  const [raiseTo, setRaiseTo] = useState(minRaiseTo);
  useEffect(() => { setRaiseTo(Math.min(Math.max(minRaiseTo, game.currentBet * 2 || BB * 3), maxRaiseTo)); }, [game.handNo, game.street, game.currentBet]); // eslint-disable-line
  const pot = potTotal(game);
  const result = game.street === "result";

  // All-in runout reveal (unchanged)
  const [revealedBoardCount, setRevealedBoardCount] = useState(null);
  useEffect(() => {
    if (game.street === "result" && game.wentToShowdown && game.allInRevealFrom != null && game.allInRevealFrom < game.board.length) {
      setRevealedBoardCount(game.allInRevealFrom);
      const timers = [];
      for (let i = game.allInRevealFrom; i < game.board.length; i++) {
        timers.push(setTimeout(() => setRevealedBoardCount(i + 1), (i - game.allInRevealFrom + 1) * 850));
      }
      return () => timers.forEach(clearTimeout);
    }
    setRevealedBoardCount(null);
  }, [game.handNo, game.street]); // eslint-disable-line

  // Showdown delay
  const [showdownReady, setShowdownReady] = useState(false);
  useEffect(() => {
    if (game.street === "result" && game.wentToShowdown) {
      const t = setTimeout(() => setShowdownReady(true), 1000);
      return () => clearTimeout(t);
    }
    setShowdownReady(false);
  }, [game.street, game.handNo]); // eslint-disable-line

  // Staggered card flip reveal per street
  const [boardRevealCount, setBoardRevealCount] = useState(0);
  const boardRevealRef = useRef(0);
  useEffect(() => { boardRevealRef.current = 0; setBoardRevealCount(0); }, [game.handNo]); // eslint-disable-line
  useEffect(() => {
    if (game.board.length === 0) return;
    const from = boardRevealRef.current;
    if (from >= game.board.length) return;
    const timers = [];
    for (let i = from; i < game.board.length; i++) {
      timers.push(setTimeout(() => { boardRevealRef.current = i + 1; setBoardRevealCount(i + 1); }, (i - from) * CARD_REVEAL_DELAY_MS));
    }
    return () => timers.forEach(clearTimeout);
  }, [game.board.length, game.handNo]); // eslint-disable-line

  // Floating action labels per seat
  const [actionLabels, setActionLabels] = useState({});
  const actionLogRef = useRef({ len: 0, handNo: game.handNo });
  useEffect(() => {
    const prev = actionLogRef.current;
    if (game.handNo !== prev.handNo) { actionLogRef.current = { len: 0, handNo: game.handNo }; setActionLabels({}); return; }
    const newEntries = game.log.slice(prev.len);
    if (!newEntries.length) return;
    actionLogRef.current = { len: game.log.length, handNo: game.handNo };
    newEntries.forEach((entry) => {
      let text;
      if (entry.type === "fold") text = "Fold";
      else if (entry.type === "check") text = "Check";
      else if (entry.type === "call") text = "Call";
      else if (entry.type === "raise") text = entry.toCall === 0 ? `Bet ${(entry.amount || 0).toLocaleString()}` : `Raises ${(entry.amount || 0).toLocaleString()}`;
      if (!text) return;
      const labelKey = Date.now() + "-" + entry.idx;
      setActionLabels((a) => ({ ...a, [entry.idx]: { text, key: labelKey } }));
      setTimeout(() => setActionLabels((a) => { if (!a[entry.idx] || a[entry.idx].key !== labelKey) return a; const next = { ...a }; delete next[entry.idx]; return next; }), 2100);
    });
  }, [game.log.length, game.handNo]); // eslint-disable-line

  // Countdown timer with escalating glow
  const [timerSecs, setTimerSecs] = useState(TIMER_DURATION_S);
  useEffect(() => {
    if (!heroTurn) { setTimerSecs(TIMER_DURATION_S); return; }
    setTimerSecs(TIMER_DURATION_S);
    const iv = setInterval(() => setTimerSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, [heroTurn, game.log.length, game.handNo]); // eslint-disable-line
  const timerBarColor = timerSecs > TIMER_GLOW_THRESHOLD_SECONDS ? T.brass : timerSecs > 5 ? "#D97B20" : "#C94030";
  const timerGlowAnim = timerSecs <= TIMER_GLOW_THRESHOLD_SECONDS
    ? `${timerSecs <= 3 ? "riqTimerGlowHigh" : timerSecs <= 6 ? "riqTimerGlowMed" : "riqTimerGlowLow"} 1s ease-in-out infinite`
    : "none";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "calc(12px + env(safe-area-inset-top)) 12px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <button onClick={onEndSession} style={{ background: "none", border: "1px solid " + T.line, color: T.mist, borderRadius: 8, padding: "5px 10px", fontSize: 12 }}>End session</button>
        <div style={{ display: "flex", gap: 6 }}>
          {["preflop", "flop", "turn", "river"].map((s) => (
            <span key={s} className="mono" style={{ fontSize: 10, padding: "3px 7px", borderRadius: 6, letterSpacing: ".05em", border: "1px solid " + (game.street === s ? T.brass : "transparent"), color: game.street === s ? T.brass : T.faint }}>{STREET_LABEL[s]}</span>
          ))}
        </div>
        <span className="mono" style={{ fontSize: 12, color: T.faint }}>#{sessionHandCount + 1}</span>
      </div>

      {/* Table */}
      <div style={{ position: "relative", flex: 1, minHeight: 330, margin: "4px 0" }}>
        <div style={{ position: "absolute", inset: "7% 4%", borderRadius: "50%", background: ({ "felt-midnight": `radial-gradient(ellipse at 50% 38%, #14233B, #0A1322 75%)`, "felt-burgundy": `radial-gradient(ellipse at 50% 38%, #2A1018, #180A10 75%)`, "felt-slate": `radial-gradient(ellipse at 50% 38%, #1A2030, #0E1520 75%)`, "felt-forest": `radial-gradient(ellipse at 50% 38%, #0F2015, #091510 75%)` })[COSMETICS.felt] || `radial-gradient(ellipse at 50% 38%, ${T.baize2}, ${T.baize} 75%)`, border: `7px solid #2A2017`, boxShadow: `inset 0 0 40px rgba(0,0,0,.55), 0 0 0 2px ${T.brassDim}` }} />
        {/* community cards + pot */}
        <div style={{ position: "absolute", left: "50%", top: "44%", transform: "translate(-50%,-50%)", textAlign: "center", zIndex: 4 }}>
          <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
            {[0, 1, 2, 3, 4].map((i) => {
              if (revealedBoardCount !== null) {
                return game.board[i] && i < revealedBoardCount
                  ? <PlayingCard key={i} card={game.board[i]} w={40} deal />
                  : game.board[i]
                    ? <div key={i} style={{ width: 40, height: 57, borderRadius: 6, background: "rgba(201,165,70,.08)", border: "1.5px solid rgba(201,165,70,.35)", animation: "riqPulse 0.8s ease-in-out infinite" }} />
                    : <div key={i} style={{ width: 40, height: 57, borderRadius: 6, border: "1.5px dashed rgba(201,165,70,.25)" }} />;
              }
              if (!game.board[i]) return <div key={i} style={{ width: 40, height: 57, borderRadius: 6, border: "1.5px dashed rgba(201,165,70,.25)" }} />;
              if (i >= boardRevealCount) return <PlayingCard key={`${i}d`} hidden w={40} />;
              return <div key={`${i}u`} style={{ animation: "riqCardFlip .28s ease both" }}><PlayingCard card={game.board[i]} w={40} /></div>;
            })}
          </div>
          <div className="mono" style={{ marginTop: 8, fontSize: 14, color: T.brass, fontWeight: 600 }}>
            <span style={{ fontSize: 10, color: T.faint, letterSpacing: ".1em" }}>POT </span>{pot.toLocaleString()}
          </div>
        </div>
        {game.players.map((p, i) => <Seat key={i} p={p} idx={i} game={game} isHero={i === 0} actionLabel={actionLabels[i] || null} showdownReady={showdownReady} />)}
        {/* result overlay */}
        {(result && (!game.wentToShowdown || showdownReady)) && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20 }}>
            <div style={{ background: "rgba(7,16,11,.97)", border: "1.5px solid " + T.brass, borderRadius: 16, padding: "16px 22px", textAlign: "center", minWidth: 230, animation: "riqResultIn .2s ease forwards" }}>
              {game.wentToShowdown && game.players.filter((p, i) => i !== 0 && !p.folded).length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                  {game.players.filter((p, i) => i !== 0 && !p.folded).map((p, pi) => (
                    <div key={pi} style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 10, color: T.mist, marginRight: 4 }}>{p.name}</span>
                      {p.cards && p.cards.map((c, k) => <PlayingCard key={k} card={c} w={28} />)}
                    </div>
                  ))}
                </div>
              )}
              {game.winners.map((w) => (
                <div key={w.idx} style={{ marginBottom: 6 }}>
                  <span className="serif" style={{ fontSize: 19, color: T.brass }}>{game.players[w.idx].name}</span>
                  <span className="mono" style={{ color: T.good, marginLeft: 8, fontSize: 15 }}>+{w.amt.toLocaleString()}</span>
                  {w.score != null && <div style={{ fontSize: 12, color: T.mist, marginTop: 2 }}>{CAT_NAMES[scoreCat(w.score)]}</div>}
                </div>
              ))}
              {!game.wentToShowdown && <div style={{ fontSize: 11.5, color: T.faint }}>everyone folded</div>}
              <Btn kind="primary" onClick={() => { haptic("light"); onNextHand(); }} style={{ marginTop: 10, width: "100%" }}>Next hand</Btn>
            </div>
          </div>
        )}
      </div>

      <StrengthStrip hero={hero.cards} board={game.board} equity={equity} />

      {/* Action bar */}
      <div style={{ padding: "10px 0 86px", minHeight: 118 }}>
        {heroTurn ? (
          <>
            <div style={{ height: 3, borderRadius: 2, background: T.rail, marginBottom: 10, overflow: "hidden", animation: timerGlowAnim }}>
              <div key={game.log.length} style={{ height: "100%", background: timerBarColor, animation: `riqTimer ${TIMER_DURATION_S}s linear forwards`, transition: "background .5s" }} />
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
              <Btn kind="ghost" onClick={() => onHeroAct({ type: "fold" })} style={{ flex: "0 0 auto", padding: "12px 16px", color: T.faint, fontWeight: 500, fontSize: 14 }}>Fold</Btn>
              <Btn kind="felt" onClick={() => onHeroAct(toCall > 0 ? { type: "call" } : { type: "check" })} style={{ flex: 1 }}>
                {toCall > 0 ? <>Call <span className="mono">{Math.min(toCall, hero.stack).toLocaleString()}</span></> : "Check"}
              </Btn>
              <Btn kind="primary" onClick={() => onHeroAct({ type: "raise", amount: raiseTo })} style={{ flex: 1.7, fontSize: 16 }} disabled={hero.stack + hero.bet <= game.currentBet}>
                {raiseTo >= maxRaiseTo ? "All-in" : game.currentBet > 0 ? "Raise to" : "Bet"} <span className="mono">{raiseTo.toLocaleString()}</span>
              </Btn>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
              <input type="range" min={minRaiseTo} max={maxRaiseTo} step={SB} value={raiseTo} onChange={(e) => setRaiseTo(+e.target.value)} aria-label="Raise size" />
              {[{ l: "⅓", f: 0.33 }, { l: "½", f: 0.5 }, { l: "¾", f: 0.75 }, { l: "Pot", f: 1 }].map((b) => (
                <button key={b.l} onClick={() => setRaiseTo(Math.min(maxRaiseTo, Math.max(minRaiseTo, Math.round((pot * b.f + toCall + hero.bet) / SB) * SB)))} className="mono" style={{ background: "none", border: "1px solid " + T.line, color: T.mist, borderRadius: 7, padding: "3px 7px", fontSize: 11 }}>{b.l}</button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", color: T.faint, fontSize: 13, paddingTop: 24 }}>
            {result ? "Hand complete" : game.toAct >= 0 ? `${game.players[game.toAct].name} is thinking…` : "Dealing…"}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ SPOT TRAINER (table-rendered puzzles) ============================ */
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function rngPick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function cardsFromCode(code, rng) {
  const order = "23456789TJQKA";
  const r1 = order.indexOf(code[0]) + 2, r2 = order.indexOf(code[1]) + 2;
  if (code.length === 2) { const s1 = Math.floor(rng() * 4); let s2 = Math.floor(rng() * 4); if (s2 === s1) s2 = (s1 + 1) % 4; return [{ r: r1, s: s1 }, { r: r2, s: s2 }]; }
  if (code[2] === "s") { const s = Math.floor(rng() * 4); return [{ r: r1, s }, { r: r2, s }]; }
  const s1 = Math.floor(rng() * 4); let s2 = Math.floor(rng() * 4); if (s2 === s1) s2 = (s1 + 1) % 4;
  return [{ r: r1, s: s1 }, { r: r2, s: s2 }];
}
function drawBoard(rng, n, used) {
  const usedK = new Set(used.map(cardKey));
  const pool = newDeck().filter((c) => !usedK.has(cardKey(c)));
  const out = [];
  while (out.length < n) { const i = Math.floor(rng() * pool.length); out.push(pool.splice(i, 1)[0]); }
  return out;
}
function basePlayers(heroCards) {
  return Array.from({ length: 6 }, (_, i) => ({
    name: i === 0 ? "You" : AI_NAMES[i - 1], stack: START_STACK,
    cards: i === 0 ? heroCards : [{ r: 2, s: 0 }, { r: 3, s: 1 }],
    bet: 0, committed: 0, folded: i !== 0, allIn: false, hasActed: false, isHero: i === 0,
  }));
}
// Type A, preflop seat discipline
function puzzleOpen(rng, level = 0.6) {
  const pos = rngPick(rng, ["UTG", "HJ", "CO", "BTN", "SB"]);
  const posIdx = POS_FROM_BTN.indexOf(pos);
  const button = (6 - posIdx) % 6;
  const range = OPEN_RANGE[pos], th = OPEN_PCT[pos];
  const codes = Object.keys(HAND_PCT);
  const wantIn = rng() < 0.5;
  // adaptive: high level = boundary hands (hard calls), low level = obvious hands
  const nearLo = 0.02, nearHi = 0.10;
  const candidates = codes.filter((c) => {
    const gap = Math.abs(HAND_PCT[c] - th);
    const near = gap >= nearLo && gap <= nearHi;
    const fits = level >= 0.5 ? near : gap > nearHi + 0.05;
    return fits && (wantIn ? range.has(c) : (!range.has(c) && HAND_PCT[c] > th && HAND_PCT[c] < th + 0.35));
  });
  if (!candidates.length) candidates.push(...codes.filter((c) => wantIn ? range.has(c) : (!range.has(c) && HAND_PCT[c] > th + 0.05 && HAND_PCT[c] < th + 0.3)));
  const code = rngPick(rng, candidates);
  const heroCards = cardsFromCode(code, rng);
  const players = basePlayers(heroCards);
  const sb = (button + 1) % 6, bb = (button + 2) % 6;
  players[sb].folded = sb !== 0; players[bb].folded = bb !== 0;
  players[sb].bet = SB; players[sb].committed = SB;
  players[bb].bet = BB; players[bb].committed = BB;
  players[0].folded = false;
  const game = { players, board: [], street: "preflop", button, currentBet: BB, minRaise: BB, toAct: 0, winners: null, log: [], handNo: 0, heroPos: pos, deck: [] };
  return {
    game, eq: null,
    prompt: `Folded to you ${pos === "SB" ? "in the small blind" : pos === "BTN" ? "on the button" : pos === "UTG" ? "first to act" : "in the " + pos}. What's the play?`,
    correct: wantIn ? ["raise"] : ["fold"], alsoOk: [],
    why: wantIn
      ? `${code} is comfortably inside the solid range for this seat, and hands worth playing come in raising, not calling.`
      : `${code} is below the bar for this seat. It looks tempting, but from here it loses money over time. Patience is the edge.`,
    family: "pre",
  };
}
// Type B, pot odds on a bet (call or fold)
function puzzleOdds(rng, wantCall, level = 0.6) {
  for (let tries = 0; tries < 40; tries++) {
    const hero = drawBoard(rng, 2, []);
    const board = drawBoard(rng, 5, hero);
    const eq = equityMC(hero, board, 1, 260);
    const basePot = (4 + Math.floor(rng() * 10)) * BB;
    let bet, correct;
    const callMargin = 0.12 - level * 0.07, foldMargin = 0.08 - level * 0.04; // hard = closer to break-even
    if ((wantCall === undefined ? eq >= 0.45 : wantCall) && eq >= 0.38) { bet = Math.round(basePot * 0.5); if (eq < bet / (basePot + 2 * bet) + callMargin) continue; correct = ["call"]; }
    else if ((wantCall === undefined ? eq <= 0.2 : !wantCall) && eq <= 0.26) { bet = Math.round(basePot * 0.75); if (eq > bet / (basePot + 2 * bet) - foldMargin) continue; correct = ["fold"]; }
    else continue;
    const players = basePlayers(hero);
    const villain = 3;
    players[villain].folded = false;
    players[0].committed = Math.round(basePot / 2);
    players[villain].committed = Math.round(basePot / 2) + bet;
    players[villain].bet = bet;
    const game = { players, board, street: "river", button: 5, currentBet: bet, minRaise: bet, toAct: 0, winners: null, log: [], handNo: 0, heroPos: "BB", deck: [] };
    const need = Math.round((bet / (basePot + 2 * bet)) * 100);
    return {
      game, eq,
      prompt: `${players[villain].name} bets ${bet} into ${basePot} on the river. Call or fold?`,
      correct, alsoOk: eq > 0.82 ? ["raise"] : [],
      why: correct[0] === "call"
        ? `The call needs to win about ${need} times in 100 to break even, your hand wins about ${Math.round(eq * 100)}. The price is right.`
        : `The call needs about ${need} in 100, your hand only wins about ${Math.round(eq * 100)}. Paying here is a slow leak.`,
      family: correct[0] === "call" ? "defense" : "price",
    };
  }
  return puzzleOpen(rng);
}
// Type C, value bet or pot control when checked to
function puzzleValue(rng, wantBet, level = 0.6) {
  for (let tries = 0; tries < 40; tries++) {
    const hero = drawBoard(rng, 2, []);
    const board = drawBoard(rng, 5, hero);
    const eq = equityMC(hero, board, 1, 260);
    let correct;
    const betBar = 0.80 - level * 0.08; // hard = thinner value bets
    if ((wantBet === undefined ? eq >= betBar : wantBet) && eq >= 0.76) correct = ["raise"];
    else if ((wantBet === undefined ? true : !wantBet) && eq > (0.28 + level * 0.06) && eq < (0.42 + level * 0.05)) correct = ["check"];
    else continue;
    const basePot = (5 + Math.floor(rng() * 8)) * BB;
    const players = basePlayers(hero);
    players[3].folded = false;
    players[0].committed = basePot / 2; players[3].committed = basePot / 2;
    const game = { players, board, street: "river", button: 0, currentBet: 0, minRaise: BB, toAct: 0, winners: null, log: [], handNo: 0, heroPos: "BTN", deck: [] };
    return {
      game, eq,
      prompt: `${players[3].name} checks to you on the river, pot ${basePot}. Bet or check back?`,
      correct, alsoOk: [],
      why: correct[0] === "raise"
        ? `Your hand wins about ${Math.round(eq * 100)} in 100 here, that's a value bet. Checking lets worse hands off for free; about half the pot gets paid by them.`
        : `About ${Math.round(eq * 100)} in 100, decent, not strong. Betting only gets called by better hands. Check, see the showdown cheap.`,
      family: correct[0] === "raise" ? "value" : "bluff",
    };
  }
  return puzzleOpen(rng);
}
// Type D, never fold the monsters
function puzzlePremium(rng) {
  const code = rngPick(rng, ["AA", "KK", "QQ", "AKs", "AKo"]);
  const heroCards = cardsFromCode(code, rng);
  const players = basePlayers(heroCards);
  players[4].folded = false;
  players[4].bet = BB * 3; players[4].committed = BB * 3;
  players[0].bet = BB; players[0].committed = BB;
  players[1].committed = SB;
  const game = { players, board: [], street: "preflop", button: 2, currentBet: BB * 3, minRaise: BB * 2, toAct: 0, winners: null, log: [], handNo: 0, heroPos: "BB", deck: [] };
  return {
    game, eq: null,
    prompt: `You're in the big blind with ${code}. ${players[4].name} raises to ${BB * 3}. Call, raise, or fold?`,
    correct: ["raise"], alsoOk: ["call"],
    why: `${code} is one of the strongest hands you'll be dealt all session. It wants to re-raise and grow the pot, folding it to a standard raise gives away your biggest edge of the hour.`,
    family: "aggression",
  };
}
function genPuzzle(rng, family, level = 0.6) {
  if (family === "pre") return puzzleOpen(rng, level);
  if (family === "price") return puzzleOdds(rng, false, level);
  if (family === "defense") return puzzleOdds(rng, true, level);
  if (family === "value") return puzzleValue(rng, true, level);
  if (family === "bluff") return puzzleValue(rng, false, level);
  if (family === "aggression") return puzzlePremium(rng);
  const r = rng();
  return r < 0.3 ? puzzleOpen(rng, level) : r < 0.6 ? puzzleOdds(rng, undefined, level) : r < 0.85 ? puzzleValue(rng, undefined, level) : puzzlePremium(rng);
}
/* ---------- Advanced generators: multiway, multi-street, sizing, blinds, stacks ---------- */
const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
// Multiway: 2-3 live opponents, a bet and callers already on the felt
function genMultiway(rng, level = 0.5) {
  for (let tries = 0; tries < 40; tries++) {
    const hero = drawBoard(rng, 2, []);
    const streetN = rngPick(rng, [3, 4, 5]);
    const board = drawBoard(rng, streetN, hero);
    const street = streetN === 3 ? "flop" : streetN === 4 ? "turn" : "river";
    const nOpp = level > 0.6 && rng() < 0.4 ? 3 : 2;
    const eq = equityMC(hero, board, nOpp, 220);
    const basePot = (5 + Math.floor(rng() * 9)) * BB;
    const bet = Math.round(basePot * (0.5 + rng() * 0.25));
    const callers = Math.min(nOpp - 1, rng() < 0.6 ? 1 : 0);
    const potNow = basePot + bet * (1 + callers);
    const odds = bet / (potNow + bet);
    const margin = lerp(0.13, 0.06, level);
    let correct;
    if (eq > odds + margin) correct = ["call"];
    else if (eq < odds - margin * 0.8) correct = ["fold"];
    else continue;
    const seats = [2, 3, 4].slice(0, nOpp);
    const players = basePlayers(hero);
    const share = Math.round(basePot / (nOpp + 1));
    players[0].committed = share;
    seats.forEach((s, i) => {
      players[s].folded = false;
      players[s].committed = share + (i === 0 ? bet : i <= callers ? bet : 0);
      players[s].bet = i === 0 ? bet : i <= callers ? bet : 0;
    });
    const bettor = players[seats[0]].name;
    const caller = callers ? players[seats[1]].name : null;
    const game = { players, board, street, button: 5, currentBet: bet, minRaise: bet, toAct: 0, winners: null, log: [], handNo: 0, heroPos: "BB", deck: [] };
    const need = Math.round(odds * 100);
    return {
      game, eq, family: "multiway",
      prompt: `${bettor} bets ${bet}${caller ? `, ${caller} calls` : ""} on the ${street}. Pot is ${potNow}. Do you call ${bet}?`,
      correct, alsoOk: eq > 0.82 ? ["raise"] : [],
      why: correct[0] === "call"
        ? `${caller ? "With a caller already in, the" : "The"} pot is laying you a great price, you need about ${need} in 100 and your hand wins ~${Math.round(eq * 100)} against ${nOpp} opponents. Multiway pots make calls cheaper.`
        : `Against ${nOpp} players, someone usually has it. You need ~${need} in 100 and only win ~${Math.round(eq * 100)}. And note: bluff-raising into ${nOpp} people almost never works, fold and move on.`,
    };
  }
  return puzzleOdds(rng, undefined, level);
}
// Multi-street: call the flop with a plan, then face the turn
function genMultiStreet(rng, level = 0.5) {
  for (let tries = 0; tries < 50; tries++) {
    const hero = drawBoard(rng, 2, []);
    const full = drawBoard(rng, 5, hero);
    const flop = full.slice(0, 3), turn = full.slice(0, 4);
    const eqF = equityMC(hero, flop, 1, 220);
    const basePot = (5 + Math.floor(rng() * 7)) * BB;
    const b1 = Math.round(basePot * 0.5);
    const odds1 = b1 / (basePot + 2 * b1);
    const m = lerp(0.12, 0.06, level);
    if (!(eqF > odds1 + m && eqF < 0.72)) continue; // stage 1 must be a clear CALL (not a monster)
    const pot2 = basePot + 2 * b1;
    const b2 = Math.round(pot2 * (0.65 + rng() * 0.2));
    const eqT = equityMC(hero, turn, 1, 220);
    const odds2 = b2 / (pot2 + 2 * b2);
    let c2;
    if (eqT > odds2 + m) c2 = ["call"];
    else if (eqT < odds2 - m * 0.8) c2 = ["fold"];
    else continue;
    const mk = (board, street, bet, heroCom, vilCom) => {
      const players = basePlayers(hero);
      players[3].folded = false;
      players[0].committed = heroCom;
      players[3].committed = vilCom; players[3].bet = bet;
      return { players, board, street, button: 0, currentBet: bet, minRaise: bet, toAct: 0, winners: null, log: [], handNo: 0, heroPos: "BTN", deck: [] };
    };
    const vname = AI_NAMES[2];
    const tc = turn[3];
    return {
      family: "price", multi: true,
      stages: [
        { game: mk(flop, "flop", b1, basePot / 2, basePot / 2 + b1), eq: eqF,
          prompt: `${vname} bets ${b1} into ${basePot} on the flop. Your move?`,
          correct: ["call"], alsoOk: [],
          why: `You're getting the right price to continue, about ${Math.round(odds1 * 100)} in 100 needed, ~${Math.round(eqF * 100)} to win. The skill is calling with a plan for the turn.` },
        { game: mk(turn, "turn", b2, basePot / 2 + b1, basePot / 2 + b1 + b2), eq: eqT,
          prompt: `The turn is the ${rankLabel(tc.r)}${SUIT_GLYPH[tc.s]}. ${vname} fires again, ${b2} into ${pot2}.`,
          correct: c2, alsoOk: eqT > 0.82 ? ["raise"] : [],
          why: c2[0] === "call"
            ? `The turn kept your hand live: ~${Math.round(eqT * 100)} in 100 against a price of ~${Math.round(odds2 * 100)}. Calling down is right when the math holds street by street.`
            : `This is the discipline street. The flop call was correct, AND folding now is correct, the bigger bet needs ~${Math.round(odds2 * 100)} in 100 and the turn left you at ~${Math.round(eqT * 100)}. Good players fold here without regret.` },
      ],
    };
  }
  return puzzleOdds(rng, undefined, level);
}
// Sizing: the bet is right, is the amount?
function genSizing(rng, level = 0.5) {
  for (let tries = 0; tries < 50; tries++) {
    const hero = drawBoard(rng, 2, []);
    const board = drawBoard(rng, 5, hero);
    const eq = equityMC(hero, board, 1, 240);
    if (eq < 0.8) continue;
    const suits = {};
    board.forEach((c) => (suits[c.s] = (suits[c.s] || 0) + 1));
    const wet = Object.values(suits).some((n) => n >= 3);
    const band = wet ? [0.6, 0.95] : [0.45, 0.75];
    const basePot = (6 + Math.floor(rng() * 8)) * BB;
    const players = basePlayers(hero);
    players[3].folded = false;
    players[0].committed = basePot / 2; players[3].committed = basePot / 2;
    const game = { players, board, street: "river", button: 0, currentBet: 0, minRaise: BB, toAct: 0, winners: null, log: [], handNo: 0, heroPos: "BTN", deck: [] };
    return {
      game, eq, family: "value",
      prompt: `${players[3].name} checks the river, pot ${basePot}. You're very strong, pick your bet size.`,
      correct: ["raise"], alsoOk: [],
      sizing: { min: band[0], max: band[1], wet },
      why: wet
        ? `On a wet board like this, draws and second-best hands will pay, size up: ${Math.round(band[0] * 100)}–${Math.round(band[1] * 100)}% of the pot gets the most out of them.`
        : `Dry board, there's less for them to pay you with, so a ${Math.round(band[0] * 100)}–${Math.round(band[1] * 100)}% pot bet keeps worse hands calling. Overbetting here folds out everything you beat.`,
    };
  }
  return puzzleValue(rng, true, level);
}
// Blind defense: closing the action gets you a discount
function genBBDefend(rng, level = 0.5) {
  const stealer = rngPick(rng, ["BTN", "CO", "SB"]);
  const stealerSeat = { BTN: 5, CO: 4, SB: 1 }[stealer];
  const raiseTo = BB * 2.5;
  const m = lerp(0.12, 0.05, level);
  const codes = Object.keys(HAND_PCT);
  const want = rng();
  let pool;
  if (want < 0.2) pool = codes.filter((c) => HAND_PCT[c] <= 0.04); // 3-bet
  else if (want < 0.65) pool = codes.filter((c) => HAND_PCT[c] > 0.06 + m && HAND_PCT[c] < 0.42 - m); // defend
  else pool = codes.filter((c) => HAND_PCT[c] > 0.55 + m); // fold
  const code = rngPick(rng, pool);
  const pct = HAND_PCT[code];
  const heroCards = cardsFromCode(code, rng);
  const players = basePlayers(heroCards);
  players[stealerSeat].folded = false;
  players[stealerSeat].bet = raiseTo; players[stealerSeat].committed = raiseTo;
  players[0].bet = BB; players[0].committed = BB;
  players[1].committed = stealer === "SB" ? raiseTo : SB; if (stealer === "SB") { players[1].bet = raiseTo; }
  const game = { players, board: [], street: "preflop", button: stealer === "BTN" ? 5 : stealer === "CO" ? 4 : 0, currentBet: raiseTo, minRaise: BB * 2.5, toAct: 0, winners: null, log: [], handNo: 0, heroPos: "BB", deck: [] };
  const correct = pct <= 0.04 ? ["raise"] : pct < 0.42 ? ["call"] : ["fold"];
  return {
    game, eq: null, family: "defense",
    prompt: `${players[stealerSeat].name} raises to ${raiseTo} from ${stealer === "SB" ? "the small blind" : "the " + (stealer === "BTN" ? "button" : "cutoff")}. You're in the big blind with ${code}.`,
    correct, alsoOk: pct <= 0.04 ? ["call"] : [],
    why: correct[0] === "raise"
      ? `${code} is a premium, punish the steal with a re-raise. Flat-calling lets them see a cheap flop with junk.`
      : correct[0] === "call"
        ? `You already have a blind in and you close the action, that discount means the big blind defends wide. ${code} is comfortably good enough against a steal from ${stealer}.`
        : `Even with the discount, ${code} is too weak, you'd be out of position with a hand that rarely connects. The blind is a fee, not a commitment.`,
  };
}
// Short stacks: push or fold, no in-between
function genShove(rng, level = 0.5) {
  const pos = rngPick(rng, ["UTG", "HJ", "CO", "BTN", "SB"]);
  const stackBB = rngPick(rng, level > 0.6 ? [8, 10, 12, 15] : [10, 12]);
  const TH = { UTG: 0.17, HJ: 0.22, CO: 0.3, BTN: 0.42, SB: 0.5 };
  const th = Math.min(0.6, TH[pos] * Math.pow(10 / stackBB, 0.7));
  const m = lerp(0.1, 0.04, level);
  const codes = Object.keys(HAND_PCT);
  const wantPush = rng() < 0.5;
  const pool = codes.filter((c) => (wantPush ? HAND_PCT[c] < th - m : HAND_PCT[c] > th + m && HAND_PCT[c] < th + m + 0.3));
  const code = rngPick(rng, pool.length ? pool : codes);
  const heroCards = cardsFromCode(code, rng);
  const posIdx = POS_FROM_BTN.indexOf(pos);
  const button = (6 - posIdx) % 6;
  const players = basePlayers(heroCards);
  players[0].stack = stackBB * BB;
  const sb = (button + 1) % 6, bb = (button + 2) % 6;
  if (sb !== 0) { players[sb].bet = SB; players[sb].committed = SB; players[sb].folded = sb !== 0 ? true : false; }
  if (bb !== 0) { players[bb].bet = BB; players[bb].committed = BB; players[bb].folded = false; }
  if (sb === 0) { players[0].bet = SB; players[0].committed = SB; }
  const game = { players, board: [], street: "preflop", button, currentBet: BB, minRaise: BB, toAct: 0, winners: null, log: [], handNo: 0, heroPos: pos, deck: [] };
  const correct = wantPush ? ["raise"] : ["fold"];
  return {
    game, eq: null, family: "aggression", allinLabel: true,
    prompt: `You have ${stackBB} big blinds left with ${code}. With a stack this short, it is all-in or fold. Which one?`,
    correct, alsoOk: [],
    why: wantPush
      ? `At ${stackBB} big blinds, ${code} is a clear shove from ${pos}, going all-in first wins the blinds outright or gets called by a range you do fine against. Raising small just invites trouble.`
      : `${code} doesn't make the cut at ${stackBB} big blinds from ${pos}. Short stacks live and die by discipline: fold, keep your fold equity intact, and shove a better spot.`,
  };
}
/* Module id -> exercise generator */
const MODULE_GEN = {
  "hands-1": (rng, lv) => puzzleOpen(rng, lv),
  "table-1": (rng, lv) => puzzleOpen(rng, lv),
  "flow-1":  (rng, lv) => puzzleOpen(rng, lv),
  "vocab-1": (rng, lv) => puzzleOdds(rng, undefined, lv),
  "first-1": (rng, lv) => puzzleOpen(rng, lv),
  "pre-1":   (rng, lv) => puzzleOpen(rng, lv),
  "pre-2":   (rng, lv) => puzzleOpen(rng, lv),
  "pos-1":   (rng, lv) => puzzleOpen(rng, lv),
  "bb-1":    (rng, lv) => genBBDefend(rng, lv),
  "post-1":  (rng, lv) => puzzleValue(rng, rng() < 0.7 ? true : undefined, lv),
  "post-2":  (rng, lv) => (rng() < 0.5 ? puzzleValue(rng, undefined, lv) : puzzleOdds(rng, undefined, lv)),
  "size-1":  (rng, lv) => puzzleOdds(rng, undefined, lv),
  "size-2":  (rng, lv) => genSizing(rng, lv),
  "range-1": (rng, lv) => puzzleOdds(rng, rng() < 0.7 ? true : undefined, lv),
  "bluff-1": (rng, lv) => puzzleValue(rng, false, lv),
  "multi-1": (rng, lv) => genMultiway(rng, lv),
  "stack-1": (rng, lv) => genShove(rng, lv),
  "adv-1":   (rng, lv) => puzzleOpen(rng, lv),
  "adv-2":   (rng, lv) => puzzleOdds(rng, rng() < 0.5 ? true : undefined, lv),
  "adv-3":   (rng, lv) => puzzleValue(rng, undefined, lv),
  "adv-4":   (rng, lv) => (rng() < 0.5 ? puzzleValue(rng, undefined, lv) : puzzleOpen(rng, lv)),
};
function moduleExercise(modId, rng, lv) {
  return (MODULE_GEN[modId] || ((r, l) => genPuzzle(r, null, l)))(rng, lv);
}
/* Trainer level dispatch */
function trainerPuzzle(levelName, fam, rng, ts) {
  const lv = levelFor(ts, fam || "mixed");
  if (levelName === "easy") {
    // Easy still teaches cleanly, but brings crowded pots and two-street hands in early
    // so players are not stuck heads-up forever. ~40% multiway, ~20% multi-street.
    const r = rng();
    if (r < 0.4) return genMultiway(rng, 0.45);
    if (r < 0.6) return genMultiStreet(rng, 0.4);
    return genPuzzle(rng, fam, Math.min(lv, 0.4));
  }
  if (levelName === "medium") {
    // Medium is mostly crowded, multi-decision poker.
    const r = rng();
    if (r < 0.4) return genMultiway(rng, 0.6);
    if (r < 0.7) return genMultiStreet(rng, 0.6);
    if (r < 0.85) return genSizing(rng, 0.6);
    return genPuzzle(rng, fam, Math.max(0.55, lv));
  }
  const r = rng();
  if (r < 0.38) return genMultiStreet(rng, 0.8);
  if (r < 0.68) return genMultiway(rng, 0.88);
  if (r < 0.84) return genSizing(rng, 0.82);
  return genPuzzle(rng, fam, 0.9);
}
// Future performance gating (flip for launch): require ~70% over 10 puzzles at the level below
const TRAINER_LEVEL_LOCK = false;

/* ---------- Trainer memory: adaptive level + spaced leak reviews ---------- */
const dayISO = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
function levelFor(ts, fam) {
  const fs = ts && ts.famStats && ts.famStats[fam];
  if (!fs || !fs.recent || fs.recent.length < 3) return 0.45;
  const acc = fs.recent.reduce((s, x) => s + (x ? 1 : 0), 0) / fs.recent.length;
  return Math.max(0.15, Math.min(0.95, (acc - 0.4) / 0.5));
}
function recordPuzzleAnswer(ts, fam, ok) {
  const t = { ...(ts || {}) };
  t.famStats = { ...(t.famStats || {}) };
  const fs = { ...(t.famStats[fam || "mixed"] || { n: 0, c: 0, recent: [] }) };
  fs.n++; if (ok) fs.c++;
  fs.recent = [...(fs.recent || []), ok].slice(-10);
  t.famStats[fam || "mixed"] = fs;
  t.decisions = (t.decisions || 0) + 1;
  t.cleanRun = ok ? (t.cleanRun || 0) + 1 : 0;
  t.cleanBest = Math.max(t.cleanBest || 0, t.cleanRun);
  // spaced review: a correct answer on a due family clears today's review
  if (fam && t.schedule && t.schedule[fam] && ok) {
    t.schedule = { ...t.schedule, [fam]: t.schedule[fam].filter((d) => d > dayISO()) };
  }
  return t;
}
function scheduleLeakReviews(ts, families) {
  const t = { ...(ts || {}) };
  t.schedule = { ...(t.schedule || {}) };
  families.forEach((f) => {
    if (!f) return;
    const existing = t.schedule[f] || [];
    const future = existing.filter((d) => d > dayISO());
    if (future.length === 0) t.schedule[f] = [dayISO(2), dayISO(5), dayISO(12)];
  });
  return t;
}
function dueReviews(ts) {
  const out = [];
  const sch = (ts && ts.schedule) || {};
  Object.entries(sch).forEach(([fam, dates]) => { if ((dates || []).some((d) => d <= dayISO())) out.push(fam); });
  return out;
}
function dailyPuzzles() {
  // 10 puzzles, identical for every player on a given day (date-seeded).
  // Two clean warmups, then crowded pots and multi-street hands throughout.
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const rng = mulberry32(seed);
  const list = [];
  // 1-2 clean single decisions to warm up
  list.push(puzzleOpen(rng, 0.45));
  list.push(puzzleValue(rng, undefined, 0.45));
  // 3-4 crowded pots early
  list.push(genMultiway(rng, 0.55));
  list.push(genBBDefend(rng, 0.6));
  // 5-6 a two-street hand and a sizing read
  list.push(genMultiStreet(rng, 0.6));
  list.push(genSizing(rng, 0.7));
  // 7-8 harder multiway and a near break-even call
  list.push(genMultiway(rng, 0.85));
  list.push(puzzleOdds(rng, undefined, 0.85));
  // 9-10 hard multi-street, two-decision sequences
  list.push(genMultiStreet(rng, 0.8));
  list.push(genMultiStreet(rng, 0.92));
  return list;
}
const DAILY_COUNT = 10;
const FAM_LABEL = {
  pre: "Preflop hand selection",
  defense: "Defending your blinds",
  price: "Calling on the right price",
  value: "Betting for value",
  bluff: "Picking bluffs",
  aggression: "Applying pressure",
  multiway: "Crowded, multiway pots",
};
// Review shown after a full drill run, mirroring the solo session review format.
function PuzzleReviewScreen({ run, onDone }) {
  const list = run.list || [];
  const results = run.results || {};
  const total = list.length;
  const correct = list.filter((_, i) => results[i]).length;
  const acc = total ? Math.round((correct / total) * 100) : 0;
  // per-family breakdown
  const fam = {};
  list.forEach((pz, i) => {
    const f = pz.family || "pre";
    if (!fam[f]) fam[f] = { right: 0, total: 0 };
    fam[f].total++;
    if (results[i]) fam[f].right++;
  });
  const weak = Object.entries(fam).filter(([, v]) => v.right < v.total).sort((a, b) => (a[1].right / a[1].total) - (b[1].right / b[1].total));
  const strong = Object.entries(fam).filter(([, v]) => v.right === v.total);
  const moment = acc === 100 ? { kind: "good", title: "Flawless drill", line: "Every spot correct. This is what locking in your fundamentals looks like." }
    : acc >= 80 ? { kind: "good", title: "Sharp work", line: "You read most of these spots correctly. The misses below are the ones to lock down next." }
    : acc >= 50 ? { kind: "flag", title: "Solid reps", line: "A few of these went the wrong way. Drilling the same spots again is how they stick." }
    : { kind: "flag", title: "Good to spot these now", line: "Plenty missed, but that is the point of drilling. Run it again and watch the number climb." };
  return (
    <div style={{ padding: "calc(24px + env(safe-area-inset-top)) 18px 80px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="serif" style={{ fontSize: 27, color: T.card }}>Drill review</div>
        <button onClick={onDone} style={{ background: "none", border: "none", color: T.brass, fontSize: 13 }}>Done</button>
      </div>

      <div className="fadeup" style={{ marginTop: 16, padding: "16px 18px", borderRadius: 14, background: moment.kind === "good" ? "rgba(127,201,127,.08)" : "rgba(201,165,70,.07)", border: `1px solid ${moment.kind === "good" ? "rgba(127,201,127,.35)" : T.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontSize: 18, color: moment.kind === "good" ? T.good : T.brass }}>{moment.kind === "good" ? "♠" : "◆"}</span>
          <span className="serif" style={{ fontSize: 20, color: T.card }}>{moment.title}</span>
        </div>
        <div style={{ fontSize: 13, color: T.mist, marginTop: 6, lineHeight: 1.5 }}>{moment.line}</div>
      </div>

      <div style={{ background: T.baize2, border: "1px solid " + T.line, borderRadius: 14, padding: 18, marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div className="serif" style={{ fontSize: 30, color: acc >= 80 ? T.good : acc >= 50 ? T.brass : T.bad }}>{acc}%</div>
            <div style={{ fontSize: 9.5, color: T.faint, textTransform: "uppercase", letterSpacing: ".12em", marginTop: 5 }}>Correct</div>
          </div>
          <div style={{ width: 1, background: T.line, margin: "4px 0" }} />
          <div style={{ flex: 1, textAlign: "center" }}>
            <div className="serif" style={{ fontSize: 30, color: T.card }}>{correct}/{total}</div>
            <div style={{ fontSize: 9.5, color: T.faint, textTransform: "uppercase", letterSpacing: ".12em", marginTop: 5 }}>Spots</div>
          </div>
        </div>
      </div>

      {weak.length > 0 && (
        <>
          <SectionTitle>What to work on</SectionTitle>
          {weak.map(([f, v]) => (
            <div key={f} style={{ background: "rgba(194,69,62,.06)", border: "1px solid rgba(194,69,62,.28)", borderRadius: 12, padding: "13px 16px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontWeight: 700, fontSize: 14.5, color: T.card }}>{FAM_LABEL[f] || f}</span>
                <span className="mono" style={{ fontSize: 12, color: T.bad }}>{v.right}/{v.total}</span>
              </div>
              <div style={{ fontSize: 12, color: T.mist, marginTop: 5, lineHeight: 1.45 }}>You missed {v.total - v.right} of {v.total} {v.total - v.right === 1 ? "spot" : "spots"} here. The spot trainer on the Learn tab drills exactly this.</div>
            </div>
          ))}
        </>
      )}

      {strong.length > 0 && (
        <>
          <SectionTitle>Solid here</SectionTitle>
          <div style={{ background: T.baize2, border: "1px solid " + T.line, borderRadius: 12, padding: "12px 16px" }}>
            {strong.map(([f, v], i) => (
              <div key={f} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < strong.length - 1 ? `1px solid ${T.line}` : "none" }}>
                <span style={{ fontSize: 13, color: T.card }}>{FAM_LABEL[f] || f}</span>
                <span className="mono" style={{ fontSize: 12, color: T.good }}>{v.right}/{v.total} ✓</span>
              </div>
            ))}
          </div>
        </>
      )}

      <Btn kind="primary" onClick={onDone} style={{ width: "100%", marginTop: 22, padding: "15px" }}>Done</Btn>
    </div>
  );
}
function PuzzleScreen({ run, onResult, onNext, onExit, justCompleted }) {
  const puzzle = run.list[run.idx];
  const stages = puzzle ? (puzzle.stages || [puzzle]) : [];
  const [stageIdx, setStageIdx] = useState(0);
  const [answered, setAnswered] = useState(null); // {action, grade, sizingNote}
  const [stageGrades, setStageGrades] = useState([]);
  const [betAmt, setBetAmt] = useState(0);
  const [showWhy, setShowWhy] = useState(false);
  const [showRange, setShowRange] = useState(false);
  const [labelsIn, setLabelsIn] = useState(false);
  const [thinkingSeats, setThinkingSeats] = useState(new Set());
  useEffect(() => { setStageIdx(0); setAnswered(null); setStageGrades([]); setShowWhy(false); setShowRange(false); }, [run.idx]);
  // Sequence: board cards deal in → villain "thinks" (pulse) → action label appears
  useEffect(() => {
    setLabelsIn(false);
    setThinkingSeats(new Set());
    const s = stages[stageIdx];
    if (!s) return;
    const boardLen = s.game.board.length;
    const cardsDoneAt = boardLen === 0 ? 200 : 300 + (boardLen - 1) * 210 + 300; // last card done + settle
    const timers = [];
    // active villain seats for this stage
    const villainSeats = s.game.players
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => i !== 0 && !p.folded)
      .map(({ i }) => i);
    if (villainSeats.length > 0) {
      timers.push(setTimeout(() => setThinkingSeats(new Set(villainSeats)), cardsDoneAt));
      timers.push(setTimeout(() => { setThinkingSeats(new Set()); setLabelsIn(true); }, cardsDoneAt + 700));
    } else {
      timers.push(setTimeout(() => setLabelsIn(true), cardsDoneAt));
    }
    return () => timers.forEach(clearTimeout);
  }, [run.idx, stageIdx]); // eslint-disable-line
  const stage = stages[stageIdx];
  useEffect(() => {
    if (stage) setBetAmt(Math.round((potTotal(stage.game) * 0.66) / SB) * SB || BB * 3);
  }, [run.idx, stageIdx]); // eslint-disable-line
  if (!stage) return null;
  const g = stage.game;
  const hero = g.players[0];
  const toCall = Math.max(0, g.currentBet - hero.bet);
  const pot = potTotal(g);
  const isLastStage = stageIdx >= stages.length - 1;

  // Derive floating action labels from puzzle game state (what each villain already did)
  const ACTION_COLOR = { BET: T.cordovan, RAISE: T.cordovan, "3-BET": T.bad, SHOVE: T.bad, CALL: T.brass, CHECK: T.mist };
  const puzzleLabels = {};
  g.players.forEach((p, i) => {
    if (i === 0 || p.folded) return;
    let text = null;
    if (g.street === "preflop") {
      if (p.bet > BB * 2.4) {
        const bb = (g.button + 2) % 6;
        const prevRaise = g.players.some((pp, ii) => ii !== 0 && ii !== i && pp.bet > BB * 2.4);
        text = p.bet >= hero.stack ? "SHOVE" : prevRaise ? "3-BET" : "RAISE";
      }
    } else {
      if (p.bet > 0) {
        const activeBets = g.players.filter((pp, ii) => ii !== 0 && !pp.folded && pp.bet > 0);
        const maxBet = Math.max(...activeBets.map((pp) => pp.bet));
        text = p.bet === maxBet && activeBets.length <= 1 ? "BET" : p.bet === maxBet ? "RAISE" : "CALL";
      } else {
        text = "CHECK";
      }
    }
    if (text) puzzleLabels[i] = { text, color: ACTION_COLOR[text] || T.card, visible: labelsIn };
  });
  function answer(action, amount) {
    if (answered) return;
    let grade = stage.correct.includes(action) ? "correct" : (stage.alsoOk || []).includes(action) ? "ok" : "wrong";
    let sizingNote = null;
    if (action === "raise" && grade === "correct" && stage.sizing && amount != null) {
      const frac = amount / pot;
      if (frac < stage.sizing.min) { grade = "ok"; sizingNote = `Right idea, but ${Math.round(frac * 100)}% pot is too small here. Aim for ${Math.round(stage.sizing.min * 100)}–${Math.round(stage.sizing.max * 100)}%: you left ~${Math.round(pot * stage.sizing.min - amount)} chips behind.`; }
      else if (frac > stage.sizing.max) { grade = "ok"; sizingNote = `Right idea, but ${Math.round(frac * 100)}% pot is too big: it folds out the worse hands that would have paid you. ${Math.round(stage.sizing.min * 100)}–${Math.round(stage.sizing.max * 100)}% keeps them in.`; }
      else sizingNote = `${Math.round(frac * 100)}% pot, right in the band. Well sized.`;
    }
    const grades = [...stageGrades, grade];
    setStageGrades(grades);
    setAnswered({ action, grade, sizingNote });
    if (stageIdx >= stages.length - 1) {
      onResult(run.idx, grades.every((x) => x !== "wrong"));
    }
  }
  function continueStage() {
    setAnswered(null);
    setStageIdx(stageIdx + 1);
  }
  const finishRun = run.mode === "daily" && run.idx >= run.list.length - 1;
  const rightCount = stageGrades.filter((x) => x !== "wrong").length;
  // running combo: consecutive correct puzzles ending at the latest answered one
  let combo = 0;
  for (let i = run.idx; i >= 0; i--) {
    if (run.results[i] === true) combo++;
    else if (i === run.idx && run.results[i] === undefined) continue;
    else break;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "calc(12px + env(safe-area-inset-top)) 12px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <button onClick={onExit} style={{ background: "none", border: "1px solid " + T.line, color: T.mist, borderRadius: 8, padding: "5px 10px", fontSize: 12 }}>Exit</button>
        <span className="serif" style={{ fontSize: 16, color: T.brass }}>
          {run.mode === "daily" ? "Daily drill" : run.mode === "module" ? "Exercises" : "Spot trainer"}
          {run.levelName ? <span style={{ fontSize: 11, color: T.faint, marginLeft: 6, textTransform: "uppercase", letterSpacing: ".08em" }}>{run.levelName}</span> : null}
        </span>
        <span className="mono" style={{ fontSize: 12, color: T.faint, display: "flex", alignItems: "center", gap: 7 }}>
          {combo >= 2 && <span style={{ color: T.brass, fontWeight: 700, display: "inline-block", animation: "riqFlameFlicker 1.1s ease infinite" }}>🔥{combo}</span>}
          {run.mode === "daily" ? `${run.idx + 1}/${run.list.length}` : `#${run.idx + 1}`}
          {stages.length > 1 ? ` · ${stageIdx + 1}/${stages.length}` : ""}
        </span>
      </div>
      {run.mode === "daily" && (
        <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
          {run.list.map((_, i) => {
            const r = run.results[i];
            const bg = r === true ? T.good : r === false ? T.bad : i === run.idx ? T.brass : "rgba(201,165,70,.15)";
            return <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: bg, transition: "background .3s", animation: i === run.idx && r === undefined ? "riqShimmer 1.6s ease infinite" : "none" }} />;
          })}
        </div>
      )}
      {/* Table: compressed to fixed height when feedback is showing so cards stay visible */}
      <div key={"tbl" + run.idx + "-" + stageIdx} style={{ position: "relative", flex: answered ? "0 0 auto" : 1, height: answered ? 210 : undefined, minHeight: answered ? 210 : 300, margin: "4px 0" }}>
        <div style={{ position: "absolute", inset: "7% 4%", borderRadius: "50%", background: ({ "felt-midnight": `radial-gradient(ellipse at 50% 38%, #14233B, #0A1322 75%)`, "felt-burgundy": `radial-gradient(ellipse at 50% 38%, #2A1018, #180A10 75%)`, "felt-slate": `radial-gradient(ellipse at 50% 38%, #1A2030, #0E1520 75%)`, "felt-forest": `radial-gradient(ellipse at 50% 38%, #0F2015, #091510 75%)` })[COSMETICS.felt] || `radial-gradient(ellipse at 50% 38%, ${T.baize2}, ${T.baize} 75%)`, border: `7px solid #2A2017`, boxShadow: `inset 0 0 40px rgba(0,0,0,.55), 0 0 0 2px ${T.brassDim}` }} />
        <div style={{ position: "absolute", left: "50%", top: "44%", transform: "translate(-50%,-50%)", textAlign: "center", zIndex: 4 }}>
          {/* Street label */}
          <div className="mono" style={{ fontSize: 9, color: T.brassDim, letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 6 }}>
            {STREET_LABEL[g.street] || g.street.toUpperCase()}
          </div>
          <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
            {[0, 1, 2, 3, 4].map((i) => {
              if (!g.board[i]) return <div key={i} style={{ width: 40, height: 57, borderRadius: 6, border: "1.5px dashed rgba(201,165,70,.25)" }} />;
              const isNewCard = stageIdx > 0 && i === g.board.length - 1;
              const delay = stageIdx === 0 ? 260 + i * 210 : isNewCard ? 350 : 0;
              return <div key={i} style={{ animation: `riqDealIn .3s ease ${delay}ms both` }}><PlayingCard card={g.board[i]} w={40} /></div>;
            })}
          </div>
          <div className="mono" style={{ marginTop: 8, fontSize: 14, color: T.brass, fontWeight: 600 }}>
            <span style={{ fontSize: 10, color: T.faint, letterSpacing: ".1em" }}>POT </span>{pot.toLocaleString()}
          </div>
        </div>
        {g.players.map((p, i) => <Seat key={i} p={p} idx={i} game={g} isHero={i === 0} intro={stageIdx === 0} staticLabel={i !== 0 ? puzzleLabels[i] : null} thinking={thinkingSeats.has(i)} />)}
      </div>
      {answered ? (
        /* ── Bottom-sheet feedback: table stays visible above, cards never covered ── */
        (() => {
          const vColor = answered.grade === "correct" ? T.good : answered.grade === "ok" ? T.brass : T.bad;
          const heroCode = hero.cards && hero.cards.length === 2 ? handCode(hero.cards[0], hero.cards[1]) : null;
          const reqEq = toCall > 0 ? toCall / (pot + toCall) : null;
          return (
            <div className="fadeup" style={{ flex: 1, overflowY: "auto", background: "rgba(8,22,14,0.96)", borderTop: `3px solid ${vColor}`, borderRadius: "16px 16px 0 0", padding: "14px 16px", paddingBottom: "calc(14px + env(safe-area-inset-bottom))", animation: answered.grade === "wrong" ? "riqFadeUp .35s ease both, riqWrongShake .5s ease" : undefined }}>
              {/* Header row: verdict + best-play chip */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, position: "relative" }}>
                <span className="serif" style={{ fontSize: 19, color: vColor }}>
                  {answered.grade === "correct" ? "Correct." : answered.grade === "ok" ? "Works, note the detail." : "Not this time."}
                  {answered.grade === "correct" && isLastStage && (
                    <span className="mono" style={{ position: "absolute", left: 4, top: -6, fontSize: 14, fontWeight: 800, color: T.brass, animation: "riqChipFloat 1.1s .15s ease forwards", pointerEvents: "none", opacity: 0 }}>+3 🪙{combo >= 3 ? "  ×🔥" : ""}</span>
                  )}
                </span>
                <span style={{ fontSize: 11.5, background: "rgba(255,255,255,.06)", border: "1px solid " + T.line, borderRadius: 99, padding: "3px 10px", color: T.card, whiteSpace: "nowrap" }}>
                  Best: <b style={{ color: T.card }}>{stage.correct[0] === "raise" ? (stage.allinLabel ? "all-in" : g.currentBet > 0 ? "raise" : "bet") : stage.correct[0]}</b>
                </span>
              </div>
              {/* Why? collapsible prose */}
              <button onClick={() => setShowWhy((v) => !v)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid " + T.line, color: T.brass, fontSize: 12, padding: "5px 0 8px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span>Why?</span><span style={{ fontSize: 9 }}>{showWhy ? "▲" : "▼"}</span>
              </button>
              {showWhy && (
                <div style={{ fontSize: 13, color: "#D8E2DA", lineHeight: 1.6, marginBottom: 10 }}>
                  {answered.sizingNote && <div style={{ marginBottom: 5 }}>{answered.sizingNote}</div>}
                  {stage.why}
                </div>
              )}
              {/* Dual-track equity bars */}
              {stage.eq != null && (
                <div style={{ background: "rgba(6,13,9,.7)", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
                  {reqEq != null && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: T.faint, textTransform: "uppercase", letterSpacing: ".08em" }}>Required equity</span>
                        <span className="mono" style={{ fontSize: 11, color: T.cordovan }}>{Math.round(reqEq * 100)}%</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 4, background: T.baize, marginBottom: 9, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: Math.round(reqEq * 100) + "%", borderRadius: 4, background: T.cordovan + "BB" }} />
                      </div>
                    </>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: T.faint, textTransform: "uppercase", letterSpacing: ".08em" }}>Your equity</span>
                    <span className="mono" style={{ fontSize: 11, color: stage.eq > 0.6 ? T.good : stage.eq > 0.35 ? T.brass : T.bad }}>{Math.round(stage.eq * 100)}%</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 4, background: T.baize, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: Math.round(stage.eq * 100) + "%", borderRadius: 4, background: stage.eq > 0.6 ? T.good : stage.eq > 0.35 ? T.brass : T.cordovan }} />
                  </div>
                  {reqEq != null && (
                    <div style={{ fontSize: 10.5, textAlign: "center", marginTop: 6, color: stage.eq >= reqEq ? T.good : T.bad }}>
                      {stage.eq >= reqEq
                        ? `+${Math.round((stage.eq - reqEq) * 100)} pts above breakeven — profitable`
                        : `${Math.round((reqEq - stage.eq) * 100)} pts short of breakeven — losing call`}
                    </div>
                  )}
                </div>
              )}
              {/* Strategy range accordion — preflop spots only */}
              {g.street === "preflop" && OPEN_RANGE[g.heroPos] && (
                <div style={{ marginBottom: 12 }}>
                  <button onClick={() => setShowRange((v) => !v)} style={{ width: "100%", textAlign: "left", background: "none", border: `1px solid ${T.line}`, borderRadius: 9, padding: "8px 12px", color: T.mist, fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>View Strategy Range</span><span style={{ fontSize: 9 }}>{showRange ? "▲" : "▼"}</span>
                  </button>
                  {showRange && (
                    <div style={{ marginTop: 8, padding: "12px 10px", background: "#0A1A13", borderRadius: 12, border: "1px solid " + T.line }}>
                      <RangeGrid pos={g.heroPos} compact heroCode={heroCode} />
                    </div>
                  )}
                </div>
              )}
              {isLastStage && stages.length > 1 && (
                <div style={{ fontSize: 12, color: T.brass, marginBottom: 8 }}>Hand complete: {rightCount}/{stages.length} decisions right.</div>
              )}
              {isLastStage && justCompleted && (
                <div style={{ fontSize: 12.5, color: T.good, marginBottom: 8, fontWeight: 700 }}>✓ Module complete, nice work.</div>
              )}
              <Btn kind="primary" onClick={!isLastStage ? continueStage : finishRun ? onExit : onNext} style={{ width: "100%", marginTop: 4 }}>
                {!isLastStage ? "Continue the hand →" : run.mode === "daily" ? (run.idx >= run.list.length - 1 ? "Finish drill" : "Next puzzle") : "Next puzzle"}
              </Btn>
            </div>
          );
        })()
      ) : (
        <>
          <div key={"pr" + run.idx + "-" + stageIdx} style={{ background: "rgba(10,26,18,0.72)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", border: "1px solid rgba(201,165,70,0.18)", borderTop: `2px solid ${T.brass}`, borderRadius: 14, padding: "12px 16px", marginBottom: 8, animation: stageIdx === 0 ? `riqFadeUp .4s ease ${(stage.game.board.length === 0 ? 900 : 1200 + stage.game.board.length * 180)}ms both` : "riqFadeUp .4s ease .3s both" }}>
            <div className="mono" style={{ fontSize: 9, color: T.brassDim, letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 7 }}>
              {g.heroPos ? `${g.heroPos} · ` : ""}{(STREET_LABEL[g.street] || g.street).toUpperCase()} · Your action
            </div>
            <div style={{ fontSize: 14, color: T.card, lineHeight: 1.5 }}>{stage.prompt}</div>
          </div>
          <div style={{ padding: "4px 0 calc(14px + env(safe-area-inset-bottom))" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
              <Btn kind="ghost" disabled={!!answered} onClick={() => answer("fold")} style={{ flex: "0 0 auto", padding: "12px 16px", color: T.faint, fontWeight: 500, fontSize: 14 }}>Fold</Btn>
              <Btn kind="felt" disabled={!!answered} onClick={() => answer(toCall > 0 ? "call" : "check")} style={{ flex: 1 }}>
                {toCall > 0 ? <>Call <span className="mono">{toCall.toLocaleString()}</span></> : "Check"}
              </Btn>
              <Btn kind="primary" disabled={!!answered} onClick={() => answer("raise", stage.sizing ? betAmt : undefined)} style={{ flex: 1.7, fontSize: 16 }}>
                {stage.allinLabel ? "All-in" : g.currentBet > 0 ? "Raise" : stage.sizing ? <>Bet <span className="mono">{betAmt.toLocaleString()}</span></> : "Bet"}
              </Btn>
            </div>
            {stage.sizing && !answered && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                <input type="range" min={Math.round(pot * 0.2 / SB) * SB} max={Math.round(pot * 1.5 / SB) * SB} step={SB} value={betAmt} onChange={(e) => setBetAmt(+e.target.value)} aria-label="Bet size" />
                <span className="mono" style={{ fontSize: 11, color: T.mist, minWidth: 58, textAlign: "right" }}>{Math.round((betAmt / pot) * 100)}% pot</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
let LB_CACHE = null; // { at, data }, refetched only after 5 minutes
function LeaderboardScreen({ go }) {
  const fresh = LB_CACHE && Date.now() - LB_CACHE.at < 5 * 60 * 1000;
  const [data, setData] = useState(fresh ? LB_CACHE.data : null);
  const [state, setState] = useState(fresh ? "done" : "loading");
  useEffect(() => {
    if (fresh) return;
    (async () => {
      try {
        const r = await sbFetch("/functions/v1/leaderboard", { method: "POST", body: "{}" });
        if (r.ok) {
          const j = await r.json();
          LB_CACHE = { at: Date.now(), data: j };
          setData(j); setState("done");
        } else setState("error");
      } catch { setState("error"); }
    })();
  }, []); // eslint-disable-line
  return (
    <div style={{ padding: "calc(22px + env(safe-area-inset-top)) 18px 80px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="serif" style={{ fontSize: 25, color: T.card }}>♛ Leaderboard</div>
        <button onClick={() => go("home")} style={{ background: "none", border: "none", color: T.brass, fontSize: 13 }}>Done</button>
      </div>
      <div style={{ fontSize: 12, color: T.mist, marginTop: 4, lineHeight: 1.5 }}>Ranked by RiverIQ Rating, decision quality, not chips. You can't luck your way up this list.</div>
      {state === "loading" && (
        <div style={{ marginTop: 16 }}>
          <div style={{ height: 52, borderRadius: 14, background: T.baize2, border: "1px solid " + T.line, animation: "riqShimmer 1.2s ease infinite" }} />
          <div style={{ background: T.baize2, border: "1px solid " + T.line, borderRadius: 14, padding: "4px 14px", marginTop: 12 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid rgba(201,165,70,.08)" }}>
                <div style={{ width: "55%", height: 13, borderRadius: 6, background: "rgba(154,179,164,.18)", animation: `riqShimmer 1.2s ease ${i * 0.12}s infinite` }} />
                <div style={{ width: 60, height: 13, borderRadius: 6, background: "rgba(154,179,164,.18)", animation: `riqShimmer 1.2s ease ${i * 0.12}s infinite` }} />
              </div>
            ))}
          </div>
        </div>
      )}
      {state === "error" && <div style={{ color: T.bad, fontSize: 13, marginTop: 24 }}>Couldn't load it, is the leaderboard function deployed?</div>}
      {data && (
        <>
          <div style={{ background: "rgba(201,165,70,.08)", border: "1px solid " + T.line, borderRadius: 14, padding: 14, marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13.5, color: T.card }}>{data.leagueName ? data.leagueName + " League · this week" : "Your rank"}</span>
            <span className="mono" style={{ fontSize: 18, color: T.brass, fontWeight: 600 }}>#{data.myRank} <span style={{ fontSize: 12, color: T.faint }}>· {data.myRating} overall</span></span>
          </div>
          {(data.league || []).length > 0 && (
            <div style={{ background: T.baize2, border: "1px solid " + T.line, borderRadius: 14, padding: "4px 14px", marginTop: 12 }}>
              {data.league.map((u) => (
                <div key={"L" + u.rank} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "9px 0", borderBottom: "1px solid rgba(201,165,70,.08)", background: u.you ? "rgba(201,165,70,.07)" : "transparent", borderRadius: 8, paddingLeft: u.you ? 8 : 0, paddingRight: u.you ? 8 : 0 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                    <span className="mono" style={{ fontSize: 12, color: u.rank <= 3 ? T.brass : T.faint, width: 26 }}>{u.rank <= 3 ? ["①", "②", "③"][u.rank - 1] : "#" + u.rank}</span>
                    <span style={{ fontSize: 14, color: T.card, fontWeight: u.you ? 700 : 500 }}>{u.username}{u.you ? " (you)" : ""}</span>
                  </div>
                  <span className="mono" style={{ fontSize: 13, color: u.gain >= 0 ? T.good : T.bad }}>{u.gain >= 0 ? "+" : ""}{u.gain} <span style={{ fontSize: 10.5, color: T.faint }}>this week</span></span>
                </div>
              ))}
            </div>
          )}
          <SectionTitle>All-time</SectionTitle>
          <div style={{ background: T.baize2, border: "1px solid " + T.line, borderRadius: 14, padding: "4px 14px" }}>
            {(data.allTime || data.ladder || []).map((u) => (
              <div key={u.rank} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "9px 0", borderBottom: "1px solid rgba(201,165,70,.08)", background: u.you ? "rgba(201,165,70,.07)" : "transparent", borderRadius: 8, paddingLeft: u.you ? 8 : 0, paddingRight: u.you ? 8 : 0 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                  <span className="mono" style={{ fontSize: 12, color: u.rank <= 3 ? T.brass : T.faint, width: 26 }}>{u.rank <= 3 ? ["①", "②", "③"][u.rank - 1] : "#" + u.rank}</span>
                  <span style={{ fontSize: 14, color: T.card, fontWeight: u.you ? 700 : 500 }}>{u.username}{u.you ? " (you)" : ""}</span>
                </div>
                <span className="mono" style={{ fontSize: 13, color: T.mist }}>{u.rating} <span style={{ fontSize: 10.5, color: T.faint }}>{u.tier}</span></span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================ ONBOARDING & HOME ============================ */
function AuthScreen({ onAuthed, pendingJoin }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [username, setUsername] = useState("");
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [quiz, setQuiz] = useState(null); // holds profile while running the intro quiz
  const [restoring, setRestoring] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        // 1) OAuth / email-confirm redirect: tokens arrive in the URL hash
        const hash = window.location.hash;
        if (hash && hash.includes("access_token")) {
          const params = new URLSearchParams(hash.slice(1));
          const at = params.get("access_token"), rt = params.get("refresh_token");
          if (at) {
            const ur = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + at } });
            if (ur.ok) {
              const u = await ur.json();
              saveSession({ access_token: at, refresh_token: rt, user: u });
              window.history.replaceState(null, "", window.location.pathname);
              const uname = (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || (u.email || "player").split("@")[0];
              const prof = await ensureProfile(uname.replace(/\s+/g, ""));
              // New if no sessions logged yet and they have not completed onboarding on this device.
              const seen = (() => { try { return localStorage.getItem("riq_onboarded_" + prof.id); } catch (e) { return null; } })();
              const fresh = !prof.streak_day && Number(prof.skill_rating || 0) <= 100;
              if (fresh && !seen) setQuiz(prof); else onAuthed(prof, {});
              return;
            }
          }
        }
        // 2) stored session: validate and walk straight in
        if (Auth.session && Auth.session.access_token) {
          let ur = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + Auth.session.access_token } });
          if (!ur.ok && Auth.session.refresh_token && (await sbRefresh())) {
            ur = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + Auth.session.access_token } });
          }
          if (ur.ok) {
            const u = await ur.json();
            const prof = await ensureProfile((u.email || "player").split("@")[0]);
            onAuthed(prof, {});
            return;
          }
          saveSession(null);
        }
      } catch {}
      setRestoring(false);
    })();
  }, []); // eslint-disable-line
  const [quizStep, setQuizStep] = useState(1);
  const [showIntro, setShowIntro] = useState(false);
  const [ans, setAns] = useState({});
  const QS = [
    { k: "exp", q: "How long have you played?", opts: ["Brand new", "Casual home games", "Online regular", "Serious grinder"] },
    { k: "stakes", q: "What do you usually play?", opts: ["Play money", "Micro stakes", "Low stakes", "Mid stakes+"] },
    { k: "goal", q: "What's the goal?", opts: ["Beat my friends", "Stop losing", "Move up in stakes", "Go pro"] },
  ];
  const inputStyle = { width: "100%", padding: "13px 16px", borderRadius: 12, border: "1px solid " + T.line, background: T.baize2, color: T.card, fontSize: 15, marginBottom: 10 };

  async function submit() {
    setErr(null); setInfo(null);
    if (!email.trim() || !pw) { setErr("Email and password, please."); return; }
    if (mode === "signup" && !username.trim()) { setErr("Pick a username too."); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { ok, data } = await sbSignUp(email.trim(), pw);
        if (!ok) { setErr(data.msg || data.error_description || data.message || "Sign-up failed."); return; }
        if (!data.access_token) {
          setMode("signin");
          setInfo("Account created, confirm the email we just sent, then sign in here. (Testing tip: Supabase → Authentication → Sign In/Up → turn off Confirm email to skip this step.)");
          return;
        }
        saveSession(data);
        const prof = await ensureProfile(username.trim());
        // Invited via a table link: skip the quiz and let handleAuthed route to the table.
        if (pendingJoin) { onAuthed(prof, {}); return; }
        setQuiz(prof);
      } else {
        const { ok, data } = await sbSignIn(email.trim(), pw);
        if (!ok) { setErr(data.error_description || data.msg || data.message || "Sign-in failed."); return; }
        const prof = await ensureProfile(email.split("@")[0]);
        onAuthed(prof, {});
      }
    } catch (e) { setErr("Network error, check the connection and try again."); }
    finally { setBusy(false); }
  }

  if (quiz) {
    if (showIntro) return <IntroSlides onDone={() => { try { localStorage.setItem("riq_onboarded_" + quiz.id, "1"); } catch (e) {} onAuthed(quiz, ans); }} />;
    const q = QS[quizStep - 1];
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 28 }} className="fadeup" key={quizStep}>
        <div className="mono" style={{ color: T.brass, fontSize: 12, letterSpacing: ".1em" }}>QUESTION {quizStep} OF 3</div>
        <div className="serif" style={{ fontSize: 26, color: T.card, margin: "10px 0 22px" }}>{q.q}</div>
        {q.opts.map((o) => (
          <Btn key={o} kind="felt" style={{ marginBottom: 10, textAlign: "left" }} onClick={() => {
            const next = { ...ans, [q.k]: o };
            setAns(next);
            if (quizStep === 3) {
              try { localStorage.setItem("riq_onboarded_" + quiz.id, "1"); } catch (e) {}
              // brand-new players get the basics + Edge intro before entering
              if (next.exp === "Brand new") setShowIntro(true);
              else onAuthed(quiz, next);
            } else setQuizStep(quizStep + 1);
          }}>{o}</Btn>
        ))}
      </div>
    );
  }
  if (restoring && !quiz) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div className="serif" style={{ fontSize: 50, color: T.brass }}>♠</div>
        <div style={{ color: T.mist, fontSize: 13, marginTop: 12 }}>Taking your seat…</div>
      </div>
    );
  }
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 28 }}>
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <div className="serif" style={{ fontSize: 50, color: T.brass, lineHeight: 1 }}>♠</div>
        <div className="serif" style={{ fontSize: 38, color: T.card, marginTop: 6 }}>RiverIQ</div>
        <div style={{ color: T.mist, marginTop: 8, fontSize: 14 }}>Play real hands. Find your leaks.</div>
      </div>
      {pendingJoin && (
        <div style={{ background: "rgba(201,165,70,.1)", border: `1px solid ${T.brass}`, borderRadius: 12, padding: "12px 14px", marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 13.5, color: T.card }}>A friend invited you to table <span className="mono" style={{ color: T.brass, letterSpacing: ".1em" }}>{pendingJoin}</span></div>
          <div style={{ fontSize: 11.5, color: T.mist, marginTop: 3 }}>Make a quick account and you will be seated automatically.</div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["signin", "Sign in"], ["signup", "Create account"]].map(([m, l]) => (
          <button key={m} onClick={() => { setMode(m); setErr(null); }} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid " + (mode === m ? T.brass : T.line), background: mode === m ? "rgba(201,165,70,.12)" : "transparent", color: mode === m ? T.brass : T.mist, fontWeight: 600, fontSize: 14 }}>{l}</button>
        ))}
      </div>
      {mode === "signup" && <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" style={inputStyle} />}
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" style={inputStyle} />
      <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password (6+ characters)" type="password" onKeyDown={(e) => e.key === "Enter" && !busy && submit()} style={inputStyle} />
      {err && <div style={{ color: T.bad, fontSize: 13, marginBottom: 10, lineHeight: 1.45 }}>{err}</div>}
      {info && <div style={{ color: T.good, fontSize: 13, marginBottom: 10, lineHeight: 1.45 }}>{info}</div>}
      <Btn kind="primary" disabled={busy} onClick={submit} style={{ width: "100%" }}>{busy ? "One moment…" : mode === "signin" ? "Take a seat" : "Join the table"}</Btn>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 4px" }}>
        <div style={{ flex: 1, height: 1, background: T.line }} />
        <span style={{ fontSize: 11, color: T.faint }}>or</span>
        <div style={{ flex: 1, height: 1, background: T.line }} />
      </div>
      {OAUTH_PROVIDERS.map((p) => (
        <button key={p} onClick={() => { window.location.href = oauthUrl(p); }} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1px solid " + T.line, background: T.baize2, color: T.card, fontSize: 14, fontWeight: 600, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {p === "google" ? <><span style={{ fontWeight: 700 }}>G</span> Continue with Google</> : <> Continue with Apple</>}
        </button>
      ))}
      <div style={{ fontSize: 11, color: T.faint, marginTop: 16, textAlign: "center" }}>Sessions, rating, and learn progress save to your account.</div>
    </div>
  );
}
/* ============ ENGAGEMENT UI: level ring, quests, countdowns, toasts, celebrations ============ */
function LevelRing({ ts, size = 46 }) {
  const info = levelInfo(xpTotalOf(ts));
  const rad = (size - 7) / 2, circ = 2 * Math.PI * rad;
  return (
    <div title={`Level ${info.level} · ${info.into}/${info.need} chips to next`} style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke="rgba(201,165,70,.15)" strokeWidth="3.5" />
        <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={T.brass} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - info.pct)} style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span className="mono" style={{ fontSize: 7.5, color: T.faint, letterSpacing: ".08em", lineHeight: 1 }}>LVL</span>
        <span className="mono" style={{ fontSize: size * 0.3, fontWeight: 700, color: T.brass, lineHeight: 1.1 }}>{info.level}</span>
      </div>
    </div>
  );
}
function useMidnightCountdown() {
  const calc = () => { const now = new Date(); const mid = new Date(now); mid.setHours(24, 0, 0, 0); return mid - now; };
  const [ms, setMs] = React.useState(calc);
  React.useEffect(() => { const t = setInterval(() => setMs(calc()), 30000); return () => clearInterval(t); }, []);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function QuestsCard({ trainerState, onClaim }) {
  const quests = questsFor(trainerState || {});
  const left = useMidnightCountdown();
  const [burst, setBurst] = React.useState(null);
  const claimable = quests.some((q) => q.done && !q.claimed);
  const allClaimed = quests.every((q) => q.claimed);
  return (
    <div className="gp" style={{ background: T.baize2, border: `1px solid ${claimable ? "rgba(201,165,70,.42)" : T.line}`, borderRadius: 14, padding: "13px 16px", marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span className="mono" style={{ fontSize: 10, color: T.brass, letterSpacing: ".12em", textTransform: "uppercase" }}>⚔️ Today's quests</span>
        <span className="mono" style={{ fontSize: 10, color: allClaimed ? T.good : T.faint }}>{allClaimed ? "All claimed ✓" : `gone in ${left}`}</span>
      </div>
      {quests.map((q, qi) => {
        const isClaimable = q.done && !q.claimed;
        return (
          <div key={q.id} style={{ position: "relative", display: "flex", alignItems: "center", gap: 11, padding: "9px 0", borderTop: qi > 0 ? `1px solid ${T.line}` : "none", opacity: q.claimed ? 0.55 : 1 }}>
            <span style={{ fontSize: 19, filter: q.claimed ? "grayscale(.7)" : "none" }}>{q.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12.5, color: q.claimed ? T.mist : T.card, fontWeight: 600, textDecoration: q.claimed ? "line-through" : "none" }}>{q.title}</span>
                <span className="mono" style={{ fontSize: 10.5, color: q.done ? T.good : T.faint }}>{q.n}/{q.target}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: "rgba(201,165,70,.1)", overflow: "hidden" }}>
                <div style={{ width: `${(q.n / q.target) * 100}%`, height: "100%", background: q.done ? T.good : T.brass, borderRadius: 2, transition: "width .5s ease" }} />
              </div>
            </div>
            {isClaimable ? (
              <button onClick={() => { setBurst(q.id); setTimeout(() => setBurst(null), 950); onClaim(q.id); }} style={{ background: T.brass, color: "#1B1505", border: "none", borderRadius: 9, padding: "7px 11px", fontSize: 11.5, fontWeight: 800, animation: "riqClaimPulse 1.6s ease infinite", flexShrink: 0, whiteSpace: "nowrap" }}>
                +{q.reward} 🪙
              </button>
            ) : q.claimed ? (
              <span style={{ color: T.good, fontSize: 15, flexShrink: 0 }}>✓</span>
            ) : (
              <span className="mono" style={{ fontSize: 10.5, color: T.faint, flexShrink: 0 }}>+{q.reward}🪙</span>
            )}
            {burst === q.id && <span className="mono" style={{ position: "absolute", right: 26, top: 8, color: T.brass, fontWeight: 800, fontSize: 15, animation: "riqChipFloat .95s ease forwards", pointerEvents: "none", zIndex: 3 }}>+{q.reward} 🪙</span>}
          </div>
        );
      })}
    </div>
  );
}
function BadgeToast({ badge, onDone }) {
  React.useEffect(() => { const t = setTimeout(onDone, 3400); return () => clearTimeout(t); }, [badge.id]); // eslint-disable-line
  return (
    <div style={{ position: "absolute", bottom: 78, left: "50%", zIndex: 80, width: "min(320px, calc(100% - 40px))", animation: "riqToastIn 3.4s ease both", pointerEvents: "none" }}>
      <div className="gp" style={{ display: "flex", alignItems: "center", gap: 13, background: "rgba(10,26,18,0.96)", border: "1px solid rgba(201,165,70,.5)", borderRadius: 14, padding: "12px 16px" }}>
        <span style={{ fontSize: 28 }}>{badge.icon}</span>
        <div>
          <div className="mono" style={{ fontSize: 9, color: T.brass, letterSpacing: ".18em", textTransform: "uppercase" }}>Achievement unlocked</div>
          <div className="serif" style={{ fontSize: 17, color: T.card, marginTop: 2 }}>{badge.name}</div>
          <div style={{ fontSize: 11, color: T.mist }}>{badge.desc}</div>
        </div>
      </div>
    </div>
  );
}
function CelebrationOverlay({ celeb, onClose }) {
  if (!celeb) return null;
  const isStreak = celeb.type === "streak";
  const confetti = Array.from({ length: 26 }, (_, i) => ({
    left: (i * 37 + 11) % 100, delay: (i % 9) * 130,
    color: i % 3 === 0 ? T.brass : i % 3 === 1 ? T.good : T.cordovan, size: 5 + (i % 3) * 3,
  }));
  const nextMs = isStreak ? STREAK_MILESTONES.find(([d]) => celeb.streak < d) : null;
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 90, background: "rgba(4,10,7,.9)", display: "flex", alignItems: "center", justifyContent: "center", animation: "riqOverlayIn .25s ease both", cursor: "pointer" }}>
      {confetti.map((c, i) => (
        <div key={i} style={{ position: "absolute", top: "16%", left: c.left + "%", width: c.size, height: c.size * 1.6, background: c.color, borderRadius: 2, animation: `riqConfetti 1.7s ${c.delay}ms cubic-bezier(.3,.6,.6,1) forwards` }} />
      ))}
      <div onClick={(e) => e.stopPropagation()} style={{ textAlign: "center", padding: "34px 28px 28px", borderRadius: 22, background: "rgba(10,26,18,.94)", border: "1px solid rgba(201,165,70,.45)", boxShadow: "0 0 60px rgba(201,165,70,.18)", width: "min(320px, calc(100% - 48px))", animation: "riqBigPop .5s cubic-bezier(.2,1.2,.4,1) both", cursor: "default" }}>
        <div style={{ fontSize: 58, display: "inline-block", animation: "riqFlameFlicker 1.1s ease infinite" }}>{isStreak ? "🔥" : "🏅"}</div>
        <div className="serif" style={{ fontSize: 30, color: T.brass, marginTop: 10 }}>
          {isStreak ? `${celeb.streak}-day streak!` : `Level ${celeb.level}!`}
        </div>
        <div style={{ fontSize: 13.5, color: T.mist, marginTop: 8, lineHeight: 1.55 }}>
          {isStreak
            ? <>Day banked.{celeb.chips ? <> You earned <b style={{ color: T.brass }}>+{celeb.chips} 🪙</b> streak chips.</> : null} Come back tomorrow to keep the fire alive.</>
            : <>Your grind is paying off. Keep stacking chips to hit level {celeb.level + 1}.</>}
        </div>
        {nextMs && <div className="mono" style={{ fontSize: 11, color: T.faint, marginTop: 12 }}>{nextMs[0] - celeb.streak} day{nextMs[0] - celeb.streak !== 1 ? "s" : ""} to unlock: {nextMs[1]}</div>}
        <Btn kind="primary" onClick={onClose} style={{ width: "100%", marginTop: 20 }}>Keep going →</Btn>
      </div>
    </div>
  );
}

const STREAK_MILESTONES = [
  [3, "Crimson card back"],
  [7, "Gold card back"],
  [14, "Midnight felt"],
  [30, "Royal card back"],
];

function StreakActivityCard({ streak, streakDay, daily, trainerState, profile, go, sessionHandCount }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDone = daily.drill && daily.session;
  const shields = (trainerState && trainerState.shields) || 0;
  const DAY_ABBR = ["Su", "M", "T", "W", "Th", "F", "Sa"];

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    return { date: d.toISOString().slice(0, 10), label: DAY_ABBR[d.getDay()] };
  });

  const isStreakDone = (dateStr) => {
    if (dateStr === todayStr) return todayDone;
    if (!streakDay || streak <= 0) return false;
    const diffDays = Math.round((new Date(streakDay) - new Date(dateStr)) / 86400000);
    return diffDays >= 0 && diffDays < streak;
  };

  const nextMs = STREAK_MILESTONES.find(([d]) => streak < d);
  const msProgress = nextMs ? Math.min(1, streak / nextMs[0]) : 1;
  const daysToNext = nextMs ? nextMs[0] - streak : 0;

  // Calendar state
  const [drillDates, setDrillDates] = useState(null);
  const [playDates, setPlayDates] = useState(null);
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth(), todayNum = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const ds = (d) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  useEffect(() => {
    const dDates = new Set();
    for (let d = 1; d <= daysInMonth; d++) {
      if (localStorage.getItem(`riq_daily_drill_${ds(d)}`) === "true") dDates.add(ds(d));
    }
    setDrillDates(dDates);
    if (!profile) return;
    (async () => {
      const monthISO = `${year}-${String(month + 1).padStart(2, "0")}`;
      const rows = await dbSelect("sessions", `user_id=eq.${profile.id}&hands_played=gt.0&select=started_at,hands_played&started_at=gte.${monthISO}-01T00:00:00`);
      const byDate = {};
      (rows || []).forEach((r) => {
        const d = new Date(r.started_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        byDate[key] = (byDate[key] || 0) + (r.hands_played || 0);
      });
      setPlayDates(new Set(Object.entries(byDate).filter(([, h]) => h >= 10).map(([k]) => k)));
    })();
  }, [profile && profile.id]); // eslint-disable-line

  const loaded = drillDates !== null && playDates !== null;
  const todayKey = ds(todayNum);
  const todayDrill = (drillDates?.has(todayKey)) || (daily?.drill ?? false);
  const todayPlay = playDates?.has(todayKey) ?? false;
  const todayHandsCount = todayPlay ? 10 : Math.min(sessionHandCount || 0, 10);
  const todayFull = todayDrill && todayPlay;

  let fullDays = 0;
  if (loaded) {
    for (let d = 1; d <= Math.min(todayNum, daysInMonth); d++) {
      if (drillDates.has(ds(d)) && playDates.has(ds(d))) fullDays++;
    }
  }

  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: totalCells }, (_, i) => i - firstDow + 1);
  const monthName = now.toLocaleString("en-US", { month: "long" });
  const DULL = T.brassDim;
  const VOID = "rgba(194,69,62,0.14)";

  return (
    <div className="gp" style={{ background: T.baize2, border: `1px solid ${todayDone ? "rgba(127,201,127,.35)" : T.line}`, borderRadius: 14, padding: "14px 16px", marginTop: 16, marginBottom: 4 }}>
      {/* Streak header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
          <span className="serif" style={{ fontSize: 34, lineHeight: 1, color: streak > 0 ? T.cordovan : T.faint }}>{streak}</span>
          <span style={{ fontSize: 13, color: T.mist }}>day streak</span>
          {shields > 0 && (
            <span className="mono" style={{ fontSize: 10, color: T.brass, background: "rgba(201,165,70,.1)", border: `1px solid ${T.line}`, borderRadius: 6, padding: "1px 6px", marginLeft: 2 }}>
              {shields} shield{shields !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          {todayDone
            ? <span style={{ fontSize: 11, color: T.good, fontWeight: 600 }}>✓ Banked today</span>
            : streak > 0
            ? <span style={{ fontSize: 11, color: T.brass, animation: "riqShimmer 2s ease infinite" }}>Play to keep it</span>
            : <span style={{ fontSize: 11, color: T.faint }}>Start your streak</span>}
        </div>
      </div>

      {/* 7-day dot chain */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        {last7.map(({ date, label }, i) => {
          const done = isStreakDone(date);
          const isToday = date === todayStr;
          const dotColor = done ? T.good : isToday ? T.brass : T.line;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: done ? (isToday ? T.good : "rgba(127,201,127,.22)") : "transparent", border: `2px solid ${dotColor}`, display: "flex", alignItems: "center", justifyContent: "center", animation: isToday && !done ? "riqPulse 2s ease infinite" : "none", transition: "background .3s, border-color .3s" }}>
                {done ? <span style={{ fontSize: 12, color: isToday ? T.baize : T.good, fontWeight: 700 }}>✓</span> : isToday ? <span style={{ fontSize: 8, color: T.brass }}>◆</span> : null}
              </div>
              <span style={{ fontSize: 9.5, color: isToday ? T.brass : done ? "#9AB3A4" : T.faint, fontWeight: isToday ? 700 : 400, letterSpacing: ".04em" }}>{label}</span>
            </div>
          );
        })}
      </div>

      {/* Divider + calendar header */}
      <div style={{ height: 1, background: T.line, margin: "4px 0 12px" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span className="mono" style={{ fontSize: 10, color: T.mist, letterSpacing: ".1em", textTransform: "uppercase" }}>{monthName} {year}</span>
        <span style={{ fontSize: 11, color: fullDays > 0 ? T.brass : T.faint }}>
          {loaded ? `${fullDays} full ${fullDays === 1 ? "day" : "days"}` : ""}
        </span>
      </div>

      {/* Day-of-week labels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {["M","T","W","T","F","S","S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 9, color: T.faint, fontWeight: 600 }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 14 }}>
        {cells.map((day, i) => {
          if (day < 1 || day > daysInMonth) return <div key={i} style={{ aspectRatio: "1" }} />;
          const isTodayCell = day === todayNum;
          const isPast = day < todayNum;
          const isFuture = day > todayNum;
          const hasDrill = loaded && drillDates.has(ds(day));
          const hasPlay = loaded && playDates.has(ds(day));
          const both = hasDrill && hasPlay;
          let s = { aspectRatio: "1", borderRadius: 5, boxSizing: "border-box", cursor: "default" };
          let onClick;
          if (isFuture) {
            s.border = "1px solid rgba(201,165,70,0.08)";
          } else if (isTodayCell) {
            if (both) {
              s.background = T.brass;
              s.boxShadow = "0 0 10px 3px rgba(201,165,70,0.5), inset 0 1px 0 rgba(255,255,255,0.22)";
            } else if (hasDrill) {
              s.background = `linear-gradient(135deg, ${DULL} 50%, rgba(201,165,70,0.10) 50%)`;
              s.border = `1.5px solid ${T.brass}`; s.animation = "riqBeckon 2s ease-in-out infinite";
            } else if (hasPlay) {
              s.background = `linear-gradient(135deg, rgba(201,165,70,0.10) 50%, ${DULL} 50%)`;
              s.border = `1.5px solid ${T.brass}`; s.animation = "riqBeckon 2s ease-in-out infinite";
            } else {
              s.background = "rgba(201,165,70,0.08)"; s.border = `1.5px solid ${T.brass}`; s.animation = "riqBeckon 2s ease-in-out infinite";
            }
          } else if (isPast) {
            if (both) {
              s.background = T.brass; s.boxShadow = "0 0 8px 2px rgba(201,165,70,0.45), inset 0 1px 0 rgba(255,255,255,0.22)";
              s.cursor = "pointer"; onClick = () => { localStorage.setItem("riq_log_jump", ds(day)); go("log"); };
            } else if (hasDrill && !hasPlay) {
              s.background = `linear-gradient(135deg, ${DULL} 50%, ${VOID} 50%)`; s.border = "1px solid rgba(194,69,62,0.22)"; s.animation = "riqMissed 3.2s ease-in-out infinite";
            } else if (hasPlay && !hasDrill) {
              s.background = `linear-gradient(135deg, ${VOID} 50%, ${DULL} 50%)`; s.border = "1px solid rgba(194,69,62,0.22)"; s.animation = "riqMissed 3.2s ease-in-out infinite";
            } else {
              s.background = VOID; s.border = "1px solid rgba(194,69,62,0.3)"; s.animation = "riqMissed 3.2s ease-in-out infinite";
            }
          }
          return <div key={i} onClick={onClick} style={s} />;
        })}
      </div>

      {/* Today's completion status */}
      {loaded && !todayFull && (
        <div style={{ fontSize: 11, color: T.mist, marginBottom: 10 }}>
          {todayDrill ? "Drill ✓" : "Drill —"}{" · "}{todayPlay ? "Play ✓" : `Play ${todayHandsCount}/10`}
        </div>
      )}

      {/* Milestone progress bar */}
      {nextMs ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: T.mist }}>Next unlock: {nextMs[1]}</span>
            <span className="mono" style={{ fontSize: 10, color: T.brass }}>{daysToNext} day{daysToNext !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: "rgba(201,165,70,.1)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 2, background: `linear-gradient(90deg, ${T.brassDim}, ${T.brass})`, width: `${msProgress * 100}%`, transition: "width .6s ease" }} />
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: T.good, textAlign: "center" }}>All streak milestones unlocked ✓</div>
      )}
    </div>
  );
}

function HomeScreen({ user, sessions, lifetime, rating, go, streak, streakDay, daily, onDailyDrill, trainerState, ratingHistory, onOpenHands, sessionHandCount = 0, profile, onClaimQuest }) {
  const last = sessions[sessions.length - 1];
  const lastDelta = last ? last.ratingDelta : null;
  const hr = new Date().getHours();
  const greet = hr < 12 ? "Morning" : hr < 18 ? "Afternoon" : "Evening";
  const bankedToday = daily.drill && daily.session;
  const reviewDue = trainerState && dueReviews(trainerState).length > 0;
  const wkProgress = weekProgress(sessions);
  const today = new Date().toISOString().slice(0, 10);
  const drillCount = daily.drill ? 10 : (() => { try { const n = parseInt(localStorage.getItem("riq_drill_count_" + today), 10); return Number.isFinite(n) ? Math.min(n, 10) : 0; } catch { return 0; } })();
  const _today2 = new Date().toISOString().slice(0, 10);
  const _storedDailyHands = (() => { try { return parseInt(localStorage.getItem("riq_session_hands_" + _today2) || "0", 10); } catch { return 0; } })();
  const sessCount = daily.session ? 10 : Math.min(Math.max(sessionHandCount, _storedDailyHands), 10);
  const [scenarioFamily, setScenarioFamily] = useState(null);

  const resetIn = useMidnightCountdown();
  const streakAtRisk = !bankedToday && streak > 0 && new Date().getHours() >= 17;
  return (
    <div style={{ padding: "calc(26px + env(safe-area-inset-top)) 20px 80px", overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div className="serif" style={{ fontSize: 30, color: T.card, lineHeight: 1.05 }}>{greet}, {user.name}.</div>
          <div style={{ color: T.faint, fontSize: 13, marginTop: 4 }}>{lifetime.hands > 0 ? percentileLine(rating) : "A seat is open whenever you are."}</div>
        </div>
        <LevelRing ts={trainerState} size={50} />
      </div>

      {/* stat strip: numerals as the hero, hairline dividers instead of three boxes */}
      <div data-tour="stat-strip" style={{ display: "flex", alignItems: "stretch", marginTop: 22, marginBottom: 4 }}>
        <StatChip label="Hands" value={lifetime.hands} />
        <div style={{ width: 1, background: T.line, margin: "4px 0" }} />
        <StatChip label="Edge" value={Math.round(rating)} accent={T.brass} />
        <div style={{ width: 1, background: T.line, margin: "4px 0" }} />
        <StatChip label="Studied" value={(trainerState && trainerState.decisions) || 0} />
      </div>
      {ratingHistory && ratingHistory.length > 1 && (() => {
        const W = 320, H = 30;
        const lo = Math.min(...ratingHistory) - 20, hi = Math.max(...ratingHistory) + 20;
        const y = (v) => H - ((v - lo) / Math.max(1, hi - lo)) * H;
        const pts = ratingHistory.map((v, i) => `${(i / (ratingHistory.length - 1)) * W},${y(v)}`).join(" ");
        const up = rating >= ratingHistory[0];
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block", flex: 1, height: 30 }} aria-label="Rating trend over sessions">
              <polyline points={pts} fill="none" stroke={T.brass} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="mono" style={{ fontSize: 11, color: up ? T.good : T.bad, whiteSpace: "nowrap" }}>{up ? "▲" : "▼"} {Math.abs(Math.round(rating - ratingHistory[0]))}</span>
          </div>
        );
      })()}

      {wkProgress && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(127,201,127,.06)", border: "1px solid rgba(127,201,127,.25)" }}>
          <span style={{ color: T.good, fontSize: 13 }}>▲</span>
          <span style={{ fontSize: 12.5, color: "#CFE3D2" }}>{wkProgress}</span>
        </div>
      )}

      {streakAtRisk && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "11px 14px", borderRadius: 10, background: "rgba(194,69,62,.09)", border: "1px solid rgba(194,69,62,.35)" }}>
          <span style={{ fontSize: 18, display: "inline-block", animation: "riqFlameFlicker 1.2s ease infinite" }}>🔥</span>
          <span style={{ fontSize: 12.5, color: "#E8C9C4", lineHeight: 1.45 }}>Your <b>{streak}-day streak</b> is on the line — it resets in <b className="mono">{resetIn}</b>.</span>
        </div>
      )}

      <div data-tour="take-seat">
        <Btn kind="primary" onClick={() => go("lobby")} style={{ width: "100%", marginTop: 22, padding: "17px", fontSize: 17 }}>
          ♠ &nbsp;Take a seat
        </Btn>
      </div>

      {/* Daily chips goal */}
      {(() => {
        const today = new Date().toISOString().slice(0, 10);
        const dailyChips = (trainerState && trainerState.daily_chips_date === today) ? (trainerState.daily_chips || 0) : 0;
        const totalChips = (trainerState && trainerState.xp_chips) || 0;
        const target = 100;
        const pct = Math.min(dailyChips / target, 1);
        const done = dailyChips >= target;
        return (
          <div style={{ marginTop: 18, marginBottom: 4, background: done ? "rgba(127,201,127,0.06)" : T.baize2, border: "1px solid " + (done ? "rgba(127,201,127,0.25)" : T.line), borderLeft: `3px solid ${done ? T.good : T.brass}`, borderRadius: 12, padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span className="mono" style={{ fontSize: 10, color: done ? T.good : T.brass, letterSpacing: ".12em", textTransform: "uppercase" }}>🪙 Daily chips goal</span>
              <span className="mono" style={{ fontSize: 10, color: done ? T.good : T.mist }}>{dailyChips}/{target}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "rgba(201,165,70,0.1)", overflow: "hidden" }}>
              <div style={{ width: `${pct * 100}%`, height: "100%", borderRadius: 3, background: done ? T.good : T.brass, transition: "width .5s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 11, color: T.faint }}>Earn chips in lessons</span>
              <span className="mono" style={{ fontSize: 11, color: T.brass }}>🪙 {totalChips.toLocaleString()} total</span>
            </div>
          </div>
        );
      })()}
      <QuestsCard trainerState={trainerState} onClaim={onClaimQuest} />
      <div data-tour="streak-card">
        <StreakActivityCard streak={streak} streakDay={streakDay} daily={daily} trainerState={trainerState} profile={profile} go={go} sessionHandCount={sessionHandCount} />
      </div>

      <SectionTitle>Daily</SectionTitle>
      <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
        {[["pre", "Preflop Opens"], ["price", "River Calls"], ["value", "Value Sizing"]].map(([fam, label]) => {
          const sel = scenarioFamily === fam;
          return (
            <button key={fam} onClick={() => setScenarioFamily(sel ? null : fam)} style={{ flex: 1, padding: "7px 4px", borderRadius: 20, border: sel ? `1px solid ${T.brass}` : `1px solid ${T.brass}26`, background: sel ? "rgba(201,165,70,.18)" : "rgba(201,165,70,.05)", color: sel ? T.brass : T.mist, fontSize: 11.5, fontWeight: sel ? 700 : 500, transition: "all .18s ease" }}>{label}</button>
          );
        })}
      </div>
      {/* daily card: the brass left-rail signals "this is the thing to do today" */}
      <button onClick={() => onDailyDrill(scenarioFamily)} style={{ width: "100%", textAlign: "left", background: bankedToday ? "rgba(201,165,70,.07)" : T.baize2, border: "1px solid " + T.line, borderLeft: `3px solid ${bankedToday ? T.good : T.brass}`, borderRadius: 12, padding: "16px 18px", color: T.card }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span className="mono" style={{ fontSize: 10, color: bankedToday ? T.good : T.brass, letterSpacing: ".12em", textTransform: "uppercase" }}>
            {bankedToday ? "Streak banked for today" : "Keep the streak alive"}
          </span>
          {!bankedToday && <span className="mono" style={{ fontSize: 10, color: T.cordovan }}>⏳ {resetIn}</span>}
        </div>
        <div className="serif" style={{ fontSize: 21, marginTop: 5 }}>Today's ten puzzles</div>
        <div style={{ fontSize: 11, color: T.faint, marginTop: 2 }}>Everyone gets the same ten spots — they vanish at midnight.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {[["Daily drill", drillCount], ["Ten-hand session", sessCount]].map(([label, count]) => (
            <div key={label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: count >= 10 ? T.good : T.mist }}>{label}</span>
                <span className="mono" style={{ fontSize: 11, color: count >= 10 ? T.good : T.brass }}>{count}/10</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: "rgba(201,165,70,.12)", overflow: "hidden" }}>
                <div style={{ width: `${(count / 10) * 100}%`, height: "100%", borderRadius: 3, background: count >= 10 ? T.good : T.brass, transition: "width .4s ease", animation: count >= 10 ? "riqPulse 1.6s ease-out 1" : "none" }} />
              </div>
            </div>
          ))}
        </div>
        {reviewDue && (
          <div style={{ fontSize: 11, color: T.cordovan, marginTop: 9, paddingTop: 9, borderTop: `1px solid ${T.line}` }}>
            A review is due today.
          </div>
        )}
      </button>

      <SectionTitle right={<button onClick={() => go("log")} style={{ background: "none", border: "none", color: T.brass, fontSize: 12, padding: 0, whiteSpace: "nowrap" }}>All sessions →</button>}>Last session</SectionTitle>
      {last ? (
        <button onClick={() => go("review")} className="gp" style={{ width: "100%", textAlign: "left", background: T.baize2, border: "1px solid " + T.line, borderRadius: 12, padding: "16px 18px", color: T.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="serif" style={{ fontSize: 24, color: last.stats.net >= 0 ? T.good : T.bad }}>{last.stats.net >= 0 ? "+" : ""}{last.stats.net.toLocaleString()}</span>
            <span style={{ fontSize: 12, color: T.faint }}>{last.stats.hands} hands, tap to review</span>
          </div>
          {last.leaks[0] && <div style={{ fontSize: 12.5, color: T.mist, marginTop: 7 }}>Biggest leak: {last.leaks[0].title.toLowerCase()}</div>}
          {lastDelta != null && <div className="mono" style={{ fontSize: 12, marginTop: 4, color: lastDelta >= 0 ? T.good : T.bad }}>Edge {lastDelta >= 0 ? "+" : ""}{lastDelta}</div>}
        </button>
      ) : (
        <div style={{ position: "relative", border: "1px dashed " + T.line, borderRadius: 12, padding: "26px 20px", overflow: "hidden" }}>
          <div className="serif" style={{ position: "absolute", right: 14, bottom: -10, fontSize: 90, color: "rgba(201,165,70,.05)", lineHeight: 1, pointerEvents: "none" }}>♠</div>
          <div style={{ fontSize: 14, color: T.mist, lineHeight: 1.5, position: "relative" }}>Your first session will show you exactly where your chips went, and the decision behind each one.</div>
        </div>
      )}

      <SectionTitle>Sharpen up</SectionTitle>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => go("learn")} style={{ flex: 1, textAlign: "left", background: T.baize2, border: "1px solid " + T.line, borderRadius: 12, padding: "14px 16px", color: T.card }}>
          <div style={{ fontSize: 19, color: T.brass }}>♠</div>
          <div className="serif" style={{ fontSize: 16, marginTop: 6 }}>Spot trainer</div>
          <div style={{ fontSize: 11.5, color: T.mist, marginTop: 3, lineHeight: 1.4 }}>One decision at a time, with the verdict.</div>
        </button>
        <button onClick={onOpenHands} style={{ flex: 1, textAlign: "left", background: T.baize2, border: "1px solid " + T.line, borderRadius: 12, padding: "14px 16px", color: T.card }}>
          <div style={{ fontSize: 19, color: T.cordovan }}>♥</div>
          <div className="serif" style={{ fontSize: 16, marginTop: 6 }}>Hand rankings</div>
          <div style={{ fontSize: 11.5, color: T.mist, marginTop: 3, lineHeight: 1.4 }}>What beats what, strongest to weakest.</div>
        </button>
      </div>

      <div style={{ fontSize: 10.5, color: T.faint, textAlign: "center", marginTop: 24, lineHeight: 1.5 }}>Practice chips only. RiverIQ trains decisions, it never deals real money.</div>
    </div>
  );
}
function Lobby({ onStart, onPrivate, go, rating, progress }) {
  return (
    <div style={{ padding: "calc(22px + env(safe-area-inset-top)) 18px 80px", height: "100%", overflowY: "auto" }}>
      <div className="serif" style={{ fontSize: 25, color: T.card, marginBottom: 4 }}>Choose your table</div>
      <div style={{ color: T.faint, fontSize: 13, marginBottom: 20 }}>6-max No-Limit Hold'em · blinds {SB}/{BB} · {START_STACK.toLocaleString()} chips</div>
      <SectionTitle>Solo ladder</SectionTitle>
      {BOT_TIERS.map((t) => {
        const unlocked = UNLOCK_ALL_FOR_TESTING || t.riq === 0 || rating >= t.riq || progress["tier-unlock-" + t.id];
        return (
          <button key={t.id} disabled={!unlocked} onClick={() => unlocked && onStart(t)} className="gp" style={{ width: "100%", textAlign: "left", background: T.baize2, border: "1px solid " + T.line, borderLeft: unlocked ? `3px solid rgba(201,165,70,0.5)` : "3px solid rgba(94,122,107,0.2)", borderRadius: 14, padding: 16, color: T.card, marginBottom: 10, opacity: unlocked ? 1 : 0.45 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="serif" style={{ fontSize: 18 }}>{"♠".repeat(t.id)} {t.name}</span>
              {!unlocked && <span className="mono" style={{ fontSize: 10, color: T.faint, border: "1px solid " + T.line, borderRadius: 6, padding: "2px 6px", height: "fit-content" }}>🔒 Edge {t.riq} or beat tier {t.id - 1}</span>}
            </div>
            <div style={{ fontSize: 12.5, color: T.mist, marginTop: 5 }}>{t.desc}</div>
          </button>
        );
      })}
      <SectionTitle>With people</SectionTitle>
      <button onClick={() => onPrivate()} className="gp" style={{ width: "100%", textAlign: "left", background: T.baize2, border: "1px solid " + T.line, borderLeft: `3px solid rgba(201,165,70,0.45)`, borderRadius: 14, padding: 18, color: T.card, marginBottom: 12 }}>
        <span className="serif" style={{ fontSize: 19 }}>Private table</span>
        <div style={{ fontSize: 12.5, color: T.mist, marginTop: 5 }}>Real friends, one 6-digit code. The server deals, so nobody can peek at the deck. Every hand scores your decisions against how they actually play.</div>
      </button>
    </div>
  );
}

/* ============================ REVIEW & REPLAY ============================ */
function LeakCard({ l, i, openModule, allHands, openReplay }) {
  const linkedHands = allHands
    ? allHands.filter((h) => h.actions && h.actions.some((a) => a.idx === 0 && a.ruleId === l.ruleId && a.evLoss > 0)).slice(0, 3)
    : [];
  return (
    <div style={{ background: "rgba(194,69,62,.06)", border: "1px solid rgba(194,69,62,.28)", borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
          <span className="mono" style={{ fontSize: 11, color: T.cordovan, fontWeight: 600 }}>LEAK {i + 1}</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: T.card }}>{l.title}</span>
        </div>
        <span className="mono" style={{ fontSize: 12, color: T.bad, whiteSpace: "nowrap" }}>−{l.costChips}</span>
      </div>
      <div style={{ fontSize: 12.5, color: T.mist, marginTop: 7, lineHeight: 1.5 }}>{l.why}</div>
      <div style={{ fontSize: 12.5, color: "#D8E2DA", marginTop: 8, paddingLeft: 11, borderLeft: `2px solid ${T.brass}`, lineHeight: 1.5 }}><b style={{ color: T.brass }}>Fix:</b> {l.fix}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 11 }}>
        <span style={{ fontSize: 10.5, color: T.faint }}>
          {l.confidence}{l.history > 1 ? ` · seen in ${l.history} sessions` : ""}{l.estimate ? " · estimated" : ""}
        </span>
        <Btn kind="felt" onClick={() => openModule(l.module)} style={{ padding: "7px 13px", fontSize: 12.5 }}>Drill this →</Btn>
      </div>
      {linkedHands.length > 0 && openReplay && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {linkedHands.map((h) => (
            <button key={h.handNo} onClick={() => openReplay(h)} style={{ background: "none", border: "1px solid " + T.line, color: T.brass, borderRadius: 7, padding: "4px 9px", fontSize: 11 }}>Hand #{h.handNo + 1} →</button>
          ))}
        </div>
      )}
    </div>
  );
}
function ReviewScreen({ session, rating, band, go, openModule, openReplay, lifetimeBuckets }) {
  const [showAllHands, setShowAllHands] = useState(false);
  const [showBuckets, setShowBuckets] = useState(false);
  // Clear the persisted review on unmount — covers the Done button, NavBar
  // navigation, and any other exit path so the user is never stuck in review.
  useEffect(() => () => { try { localStorage.removeItem("riq_active_review"); } catch {} }, []);
  const s = session.stats;
  const buckets = (lifetimeBuckets && lifetimeBuckets.length >= 3 ? lifetimeBuckets : session.buckets) || [];
  const worst = buckets[0], best = buckets[buckets.length - 1];
  const handList = showAllHands ? session.allHands : session.keyHands;
  return (
    <div style={{ padding: "calc(24px + env(safe-area-inset-top)) 18px 80px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="serif" style={{ fontSize: 27, color: T.card }}>The hand back</div>
        <button onClick={() => go("home")} style={{ background: "none", border: "none", color: T.brass, fontSize: 13 }}>Done</button>
      </div>

      {/* The moment: one earned, plain-language beat that gives the session emotional shape */}
      {session.moment && (
        <div className="fadeup" style={{ marginTop: 16, padding: "16px 18px", borderRadius: 14, background: session.moment.kind === "good" ? "rgba(127,201,127,.08)" : "rgba(201,165,70,.07)", border: `1px solid ${session.moment.kind === "good" ? "rgba(127,201,127,.35)" : T.line}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 18, color: session.moment.kind === "good" ? T.good : T.brass }}>{session.moment.kind === "good" ? "♠" : "◆"}</span>
            <span className="serif" style={{ fontSize: 20, color: T.card }}>{session.moment.title}</span>
          </div>
          <div style={{ fontSize: 13, color: T.mist, marginTop: 6, lineHeight: 1.5 }}>{session.moment.line}</div>
        </div>
      )}

      {/* Rating card: the headline number gets the serif weight, stats sit on hairlines */}
      <div style={{ background: T.baize2, border: "1px solid " + T.line, borderRadius: 14, padding: 18, marginTop: 12 }}>
        <RatingBar value={rating} delta={session.ratingDelta} band={band} />
        <div style={{ display: "flex", alignItems: "stretch", marginTop: 16 }}>
          <StatChip label="Decisions" value={session.accuracy + "%"} accent={session.accuracy >= 85 ? T.good : session.accuracy >= 65 ? T.brass : T.bad} />
          <div style={{ width: 1, background: T.line, margin: "4px 0" }} />
          <StatChip label="Chips" value={(s.net >= 0 ? "+" : "") + s.net.toLocaleString()} accent={s.net >= 0 ? T.good : T.bad} />
          <div style={{ width: 1, background: T.line, margin: "4px 0" }} />
          <StatChip label="Blunders" value={s.blunders} accent={s.blunders === 0 ? T.good : T.bad} />
        </div>
        <div style={{ fontSize: 12, color: T.mist, marginTop: 12, lineHeight: 1.5 }}>{percentileLine(rating)}</div>
      </div>

      <SectionTitle>What to work on</SectionTitle>
      {session.leaks.length === 0 && (
        <div style={{ color: T.mist, fontSize: 13, lineHeight: 1.5, padding: "4px 2px" }}>
          A clean session, no real leaks found. Keep stacking hands and the picture sharpens.
        </div>
      )}
      {session.leaks.slice(0, 3).map((l, i) => <LeakCard key={l.ruleId} l={l} i={i} openModule={openModule} allHands={session.allHands} openReplay={openReplay} />)}

      {session.planCheck && (
        <>
          <SectionTitle>How last session's plan went</SectionTitle>
          <div style={{ padding: "2px 2px" }}>
            {session.planCheck.map((p, i) => (
              <div key={i} style={{ display: "flex", gap: 9, alignItems: "baseline", marginBottom: i < session.planCheck.length - 1 ? 9 : 0 }}>
                <span style={{ color: p.passed ? T.good : T.bad, fontSize: 14 }}>{p.passed ? "✓" : "✗"}</span>
                <span style={{ fontSize: 13, color: T.card }}>{p.goal} <span style={{ color: T.faint }}>({p.checkText})</span></span>
              </div>
            ))}
          </div>
        </>
      )}

      {session.plan.length > 0 && (
        <>
          <SectionTitle>Your plan for next time</SectionTitle>
          {session.plan.map((d, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div className="serif" style={{ fontSize: 22, color: T.brass, lineHeight: 1, flex: "0 0 auto", width: 22 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, color: T.card, fontWeight: 600 }}>{d.goal}</div>
                {d.steps.map((st, k) => <div key={k} style={{ fontSize: 12.5, color: T.mist, marginTop: 6, lineHeight: 1.5 }}>{st}</div>)}
                <div style={{ fontSize: 11, color: T.faint, marginTop: 7 }}>Checked automatically next session: {d.checkText}.</div>
              </div>
            </div>
          ))}
        </>
      )}

      <SectionTitle right={buckets.length > 0 && <button onClick={() => setShowBuckets(!showBuckets)} style={{ background: "none", border: "none", color: T.brass, fontSize: 12 }}>{showBuckets ? "Hide" : "Show all"}</button>}>Where you win & lose</SectionTitle>
      {buckets.length === 0 ? (
        <div style={{ color: T.faint, fontSize: 12.5, background: T.baize2, borderRadius: 14, padding: 14, border: "1px dashed " + T.line }}>Play more hands and your profit map appears here.</div>
      ) : (
        <div style={{ background: T.baize2, border: "1px solid " + T.line, borderRadius: 14, padding: "6px 14px" }}>
          {(showBuckets ? buckets : [worst, best].filter((b, i, arr) => b && arr.indexOf(b) === i)).map((b) => (
            <div key={b.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "9px 0", borderBottom: "1px solid rgba(201,165,70,.08)" }}>
              <div>
                <div style={{ fontSize: 13, color: T.card }}>{b.label}</div>
                <div style={{ fontSize: 10.5, color: T.faint }}>{b.hands} hand{b.hands === 1 ? "" : "s"}{b.mistakes ? ` · ${b.mistakes} mistake${b.mistakes === 1 ? "" : "s"}` : ""}{!showBuckets ? (b === worst && b.netBB < 0 ? " · your biggest money pit" : b === best && b.netBB > 0 ? " · your most profitable spot" : "") : ""}</div>
              </div>
              <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: b.netBB >= 0 ? T.good : T.bad }}>{b.netBB >= 0 ? "+" : ""}{Math.round(b.netBB)} bb</span>
            </div>
          ))}
        </div>
      )}

      <SectionTitle right={<button onClick={() => setShowAllHands(!showAllHands)} style={{ background: "none", border: "none", color: T.brass, fontSize: 12 }}>{showAllHands ? "Key hands only" : `All ${session.allHands.length} hands`}</button>}>
        {showAllHands ? "Every hand" : "Hands worth replaying"}
      </SectionTitle>
      {s.hands >= 60 && (
        <div style={{ background: T.baize2, border: "1px solid " + T.line, borderRadius: 14, padding: 13, marginBottom: 12, fontSize: 12.5, color: T.mist, lineHeight: 1.5 }}>
          That was a long one, {s.hands} hands. Decision quality measurably drops with fatigue; the math will still be here tomorrow.
        </div>
      )}
      {handList.map((h, i) => (
        <button key={h.handNo + "-" + i} onClick={() => openReplay(h)} className="gp" style={{ width: "100%", textAlign: "left", background: T.baize2, border: "1px solid " + T.line, borderRadius: 14, padding: 12, marginBottom: 8, color: T.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span className="mono" style={{ fontSize: 11, color: T.faint, marginRight: 5 }}>#{h.handNo + 1}</span>
              {h.heroCards.map((c, k) => <PlayingCard key={k} card={c} w={28} />)}
              {h.mistakes > 0 && <span style={{ fontSize: 10, color: T.bad, border: "1px solid rgba(224,113,107,.4)", borderRadius: 99, padding: "2px 7px", marginLeft: 6 }}>{h.mistakes} mistake{h.mistakes === 1 ? "" : "s"}</span>}
            </div>
            <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: h.net >= 0 ? T.good : T.bad }}>{h.net >= 0 ? "+" : ""}{h.net}</span>
          </div>
          <div style={{ fontSize: 11.5, color: T.mist, marginTop: 6 }}>{h.headline} · tap to replay →</div>
        </button>
      ))}
      <div style={{ fontSize: 10.5, color: T.faint, textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
        RiverIQ deals practice chips only. We train decisions, we never deal real money.
      </div>
    </div>
  );
}
function ReplayScreen({ hand, back }) {
  const [step, setStep] = useState(0);
  const acts = hand.actions;
  const a = acts[step];
  const boardNow = hand.board.slice(0, a ? a.board : 0);
  const totalLost = Math.round(acts.filter((x) => x.idx === 0).reduce((s, x) => s + (x.evLoss || 0), 0) * BB);
  const v = a && a.idx === 0 ? verdictFor(a) : null;
  return (
    <div style={{ padding: "calc(22px + env(safe-area-inset-top)) 18px 80px", height: "100%", overflowY: "auto" }}>
      <button onClick={back} style={{ background: "none", border: "none", color: T.brass, fontSize: 13, padding: 0 }}>← Back to review</button>
      <div className="serif" style={{ fontSize: 23, color: T.card, margin: "10px 0 4px" }}>Hand #{hand.handNo + 1} replay</div>
      <div style={{ fontSize: 12, color: T.faint, marginBottom: 14 }}>
        Result: <span className="mono" style={{ color: hand.net >= 0 ? T.good : T.bad }}>{hand.net >= 0 ? "+" : ""}{hand.net} chips</span>
        {totalLost > 0 && <> · better choices were worth ~<span className="mono" style={{ color: T.brass }}>{totalLost} chips</span></>}
      </div>
      <div style={{ background: T.baize2, border: "1px solid " + T.line, borderRadius: 14, padding: 16 }}>
        <div style={{ fontSize: 11, color: T.faint, letterSpacing: ".08em" }}>YOUR HAND{hand.pos ? " · " + hand.pos : ""}</div>
        <div style={{ display: "flex", gap: 5, margin: "6px 0 12px" }}>{hand.heroCards.map((c, k) => <PlayingCard key={k} card={c} w={38} />)}</div>
        <div style={{ fontSize: 11, color: T.faint, letterSpacing: ".08em" }}>BOARD {a ? "· " + a.street.toUpperCase() : ""}</div>
        <div style={{ display: "flex", gap: 5, marginTop: 6, minHeight: 50 }}>
          {boardNow.length ? boardNow.map((c, k) => <PlayingCard key={k} card={c} w={34} />) : <span style={{ color: T.faint, fontSize: 12, alignSelf: "center" }}>before the flop</span>}
        </div>
      </div>
      {(() => {
        // Equity curve: hero win probability at each decision, street by street.
        const pts = acts.filter((x) => x.idx === 0 && x.eq != null).map((x) => ({ eq: x.eq, street: x.street }));
        if (pts.length < 2) return null;
        const W = 320, H = 70, pad = 6;
        const x = (i) => pad + (i / (pts.length - 1)) * (W - pad * 2);
        const y = (e) => pad + (1 - e) * (H - pad * 2);
        const line = pts.map((p, i) => `${x(i)},${y(p.eq)}`).join(" ");
        const area = `${x(0)},${H - pad} ` + line + ` ${x(pts.length - 1)},${H - pad}`;
        const last = pts[pts.length - 1].eq;
        const curStreet = a ? a.street : null;
        return (
          <div style={{ background: T.baize2, border: "1px solid " + T.line, borderRadius: 14, padding: "14px 16px 12px", marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span className="mono" style={{ fontSize: 10.5, color: T.brass, letterSpacing: ".12em" }}>YOUR EQUITY THROUGH THE HAND</span>
              <span className="mono" style={{ fontSize: 13, color: last >= 0.5 ? T.good : T.bad }}>{Math.round(last * 100)}%</span>
            </div>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
              <line x1={pad} y1={y(0.5)} x2={W - pad} y2={y(0.5)} stroke={T.line} strokeDasharray="3 3" strokeWidth="1" />
              <polygon points={area} fill="rgba(201,165,70,.10)" />
              <polyline points={line} fill="none" stroke={T.brass} strokeWidth="2" strokeLinejoin="round" />
              {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.eq)} r={2.5} fill={p.eq >= 0.5 ? T.good : T.bad} />)}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              {pts.map((p, i) => <span key={i} className="mono" style={{ fontSize: 8.5, color: p.street === curStreet ? T.brass : T.faint, textTransform: "uppercase" }}>{p.street.slice(0, 4)}</span>)}
            </div>
            <div style={{ fontSize: 10.5, color: T.faint, marginTop: 6 }}>The dashed line is a coin flip. Above it you were ahead; below it you were drawing.</div>
          </div>
        );
      })()}
      {a && (
        <div className="fadeup" key={step} style={{ background: T.baize2, border: "1px solid " + T.line, borderLeft: `4px solid ${a.idx === 0 ? (v ? v.color : T.brass) : T.faint}`, borderRadius: 14, padding: 15, marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 14, color: T.card }}>
              <b>{a.idx === 0 ? "You" : a.name}</b> {a.type === "raise" ? `raise${a.idx === 0 ? "" : "s"} to ${a.amount}` : a.type + (a.amount ? ` ${a.amount}` : "")}
              <span className="mono" style={{ color: T.faint, fontSize: 11, marginLeft: 8 }}>pot {a.potBefore}</span>
            </div>
            {v && (
              <span style={{ fontSize: 11, fontWeight: 700, color: v.color, border: `1px solid ${v.color}55`, borderRadius: 99, padding: "2px 9px", whiteSpace: "nowrap" }}>
                {v.label}{v.chips < 0 ? ` ${v.chips}` : ""}
              </span>
            )}
          </div>
          {a.idx === 0 && <div style={{ fontSize: 12.5, color: a.evLoss > 0 ? "#E8B5B1" : T.mist, marginTop: 8, lineHeight: 1.55 }}>{commentFor(a)}</div>}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <Btn kind="felt" disabled={step === 0} onClick={() => setStep(step - 1)} style={{ flex: 1 }}>← Prev</Btn>
        <span className="mono" style={{ alignSelf: "center", color: T.faint, fontSize: 12 }}>{step + 1}/{acts.length}</span>
        <Btn kind="felt" disabled={step >= acts.length - 1} onClick={() => setStep(step + 1)} style={{ flex: 1 }}>Next →</Btn>
      </div>
    </div>
  );
}
/* ============================ LEARN & PROFILE ============================ */

function LearnScreen({ progress, openModule, focusLeaks, onTrainer, ratingHistory, trainerState }) {
  const frontier = getFrontier(progress);
  const totalModules = CURRICULUM_ORDER.length;
  const doneTotal = CURRICULUM_ORDER.filter((id) => progress[id]).length;
  const recIds = (focusLeaks || []).map((l) => l.module).filter((id) => MODULE_INDEX[id]);
  const due = dueReviews(trainerState || {});
  const mastery = (trainerState && trainerState.mastery) || {};
  const frontierRef = React.useRef(null);
  React.useEffect(() => {
    // land the user on their current node, Duolingo-style
    const t = setTimeout(() => { if (frontierRef.current) frontierRef.current.scrollIntoView({ block: "center" }); }, 80);
    return () => clearTimeout(t);
  }, []);
  let gi = 0; // global node index drives the serpentine offset
  return (
    <div style={{ padding: "calc(24px + env(safe-area-inset-top)) 18px 96px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="serif" style={{ fontSize: 27, color: T.card }}>Learn</div>
        <span className="mono" style={{ fontSize: 12, color: T.faint }}>{doneTotal}/{totalModules} modules</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "rgba(201,165,70,0.08)", margin: "10px 0 14px" }}>
        <div style={{ height: "100%", width: `${(doneTotal / totalModules) * 100}%`, background: `linear-gradient(90deg, ${T.brassDim}, ${T.brass})`, borderRadius: 2, transition: "width .5s" }} />
      </div>

      {/* Spaced-repetition review due: the highest-urgency item on this screen */}
      {due.length > 0 && (
        <button onClick={() => onTrainer("medium")} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, background: "rgba(194,69,62,.09)", border: "1px solid rgba(194,69,62,.4)", borderRadius: 12, padding: "12px 14px", marginBottom: 10, color: T.card }}>
          <span style={{ fontSize: 20, display: "inline-block", animation: "riqDotBlink 1.8s ease infinite" }}>⏰</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Review due today</div>
            <div style={{ fontSize: 11.5, color: T.mist, marginTop: 2 }}>{due.slice(0, 2).map((f) => FAM_LABEL[f] || f).join(" · ")} — clear it before it fades.</div>
          </div>
          <span style={{ color: T.bad, fontSize: 14 }}>→</span>
        </button>
      )}

      {/* Spot trainer, compact entry */}
      <div data-tour="spot-trainer" style={{ background: "rgba(201,165,70,.07)", border: "1px solid " + T.line, borderRadius: 14, padding: "13px 15px", marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div className="serif" style={{ fontSize: 16, color: T.brass }}>♠ Spot trainer</div>
            <div style={{ fontSize: 11, color: T.mist, marginTop: 2 }}>{recIds.length ? "Puzzles aimed at your leaks" : "Endless graded reps, +3 🪙 each"}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {[["easy", "Easy"], ["medium", "Med"], ["hard", "Hard"]].map(([lv, label]) => (
              <button key={lv} onClick={() => onTrainer(lv)} style={{ padding: "8px 12px", borderRadius: 9, border: `1px solid ${T.line}`, background: T.baize2, color: T.mist, fontWeight: 600, fontSize: 12 }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Leak-targeted module shortcuts */}
      {recIds.slice(0, 2).map((id) => (
        <button key={id} onClick={() => openModule(id)} style={{ width: "100%", textAlign: "left", background: "rgba(194,69,62,.07)", border: "1px solid rgba(194,69,62,.3)", borderRadius: 12, padding: "11px 14px", marginBottom: 8, color: T.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{MODULE_INDEX[id].title}</div>
            <div style={{ fontSize: 11, color: T.mist, marginTop: 2 }}>{MODULE_INDEX[id].topic} · targets a leak</div>
          </div>
          <span style={{ color: T.bad, fontSize: 13, flexShrink: 0 }}>→</span>
        </button>
      ))}

      {/* THE PATH: serpentine node trail through the curriculum */}
      {LEARN.map((ch, chIdx) => {
        const doneMods = ch.modules.filter((m) => progress[m.id]).length;
        const complete = doneMods === ch.modules.length;
        const isChLocked = !UNLOCK_ALL_FOR_TESTING && chIdx > 0 && !LEARN[chIdx - 1].modules.every((m) => progress[m.id]);
        const suitRed = ["♥", "♦"].includes(ch.suit);
        const accent = suitRed ? T.cordovan : T.brass;
        return (
          <div key={ch.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0 4px", padding: "13px 16px", borderRadius: 14, background: complete ? "rgba(127,201,127,.07)" : `linear-gradient(135deg, ${accent}22, rgba(10,26,18,.6))`, border: `1px solid ${complete ? "rgba(127,201,127,.3)" : accent + "40"}`, opacity: isChLocked ? 0.55 : 1 }}>
              <span className="serif" style={{ fontSize: 24, color: complete ? T.good : accent, flexShrink: 0 }}>{complete ? "✓" : ch.suit}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mono" style={{ fontSize: 9, color: T.faint, letterSpacing: ".16em", textTransform: "uppercase" }}>Chapter {ch.chapter}</div>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: T.card, marginTop: 1 }}>{ch.title}</div>
                <div style={{ fontSize: 11, color: T.mist, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isChLocked ? `Finish ${LEARN[chIdx - 1].title} to unlock` : ch.desc}</div>
              </div>
              <span className="mono" style={{ fontSize: 11, color: complete ? T.good : T.faint, flexShrink: 0 }}>{isChLocked ? "🔒" : `${doneMods}/${ch.modules.length}`}</span>
            </div>

            <div style={{ position: "relative", padding: "6px 0" }}>
              {/* faint spine the nodes weave around */}
              <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 0, borderLeft: "2px dashed rgba(201,165,70,.1)" }} />
              {ch.modules.map((m, i) => {
                const idx = gi++;
                const off = Math.round(Math.sin(idx * 1.05) * 68);
                const done = !!progress[m.id];
                const locked = isChLocked || isModuleLocked(m.id, progress);
                const isCurrent = frontier === m.id && !locked;
                const stars = mastery[m.id] || (done ? 1 : 0);
                const size = isCurrent ? 66 : 56;
                return (
                  <div key={m.id} ref={isCurrent ? frontierRef : null} style={{ display: "flex", justifyContent: "center", padding: "10px 0", transform: `translateX(${off}px)`, position: "relative" }}>
                    {isCurrent && (
                      <div className="mono" style={{ position: "absolute", top: -8, left: "50%", animation: "riqStartFloat 1.4s ease infinite", background: T.brass, color: "#1B1505", fontWeight: 800, fontSize: 10, letterSpacing: ".14em", padding: "4px 12px", borderRadius: 8, zIndex: 3, boxShadow: "0 4px 12px rgba(0,0,0,.45)" }}>START</div>
                    )}
                    <button onClick={() => !locked && openModule(m.id)} disabled={locked} style={{ background: "none", border: "none", padding: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: locked ? "default" : "pointer", width: 128 }}>
                      <div style={{
                        width: size, height: size, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: isCurrent ? 25 : 21,
                        background: done ? `radial-gradient(circle at 35% 30%, ${T.brass}, ${T.brassDim})` : isCurrent ? "rgba(201,165,70,.15)" : "rgba(10,26,18,.72)",
                        border: done ? "2px solid rgba(255,244,214,.5)" : isCurrent ? `2.5px solid ${T.brass}` : `2px solid ${locked ? "rgba(94,122,107,.25)" : T.line}`,
                        boxShadow: done ? "0 4px 14px rgba(201,165,70,.35), inset 0 2px 4px rgba(255,255,255,.25)" : isCurrent ? "0 0 22px rgba(201,165,70,.35)" : "0 3px 8px rgba(0,0,0,.4)",
                        color: done ? "#1B1505" : locked ? T.faint : T.brass,
                        animation: isCurrent ? "riqPulse 2s ease infinite" : "none",
                      }}>
                        {done ? ch.suit : locked ? "🔒" : isCurrent ? "★" : <span className="mono" style={{ fontSize: 17, fontWeight: 700 }}>{i + 1}</span>}
                      </div>
                      {done && (
                        <div className="mono" style={{ fontSize: 9, color: T.brass, letterSpacing: 1 }}>{"★".repeat(Math.min(stars, 5))}{"☆".repeat(Math.max(0, 5 - stars))}</div>
                      )}
                      <div style={{ fontSize: 11, fontWeight: 600, color: locked ? T.faint : done ? T.mist : T.card, lineHeight: 1.25, textAlign: "center", maxWidth: 118 }}>{m.title}</div>
                    </button>
                  </div>
                );
              })}
              {/* chapter trophy */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 0 2px", position: "relative" }}>
                <div style={{ fontSize: 30, filter: complete ? "none" : "grayscale(1) brightness(.45)", animation: complete ? "riqShimmer 2.2s ease infinite" : "none" }}>🏆</div>
                {complete && <div className="mono" style={{ fontSize: 9, color: T.good, letterSpacing: ".12em", marginTop: 2 }}>CHAPTER CLEAR</div>}
              </div>
            </div>
          </div>
        );
      })}

      {/* curriculum crown */}
      <div style={{ textAlign: "center", margin: "24px 0 8px" }}>
        <div style={{ fontSize: 42, filter: doneTotal === totalModules ? "none" : "grayscale(1) brightness(.4)" }}>👑</div>
        <div className="serif" style={{ fontSize: 16, color: doneTotal === totalModules ? T.brass : T.faint, marginTop: 6 }}>
          {doneTotal === totalModules ? "Curriculum complete — you're the real deal." : `${totalModules - doneTotal} module${totalModules - doneTotal !== 1 ? "s" : ""} between you and the crown`}
        </div>
      </div>
    </div>
  );
}

function parseCardStr(s) {
  if (!s || s.length < 2) return null;
  const RANK_MAP = { A: 14, K: 13, Q: 12, J: 11, T: 10 };
  const SUIT_MAP = { "♠": 0, "♥": 1, "♦": 2, "♣": 3 };
  const r = RANK_MAP[s[0]] !== undefined ? RANK_MAP[s[0]] : parseInt(s[0], 10);
  const suit = SUIT_MAP[s[1]];
  if (!r || isNaN(r) || suit === undefined) return null;
  return { r, s: suit };
}

function parseTextBlocks(text) {
  const parts = text.split(/([AKQJT2-9][♠♥♦♣])/g);
  const blocks = [];
  let cardBuf = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      const card = parseCardStr(parts[i]);
      if (card) cardBuf.push(card);
    } else {
      const hasWords = /[a-zA-Z0-9]/.test(parts[i]);
      if (cardBuf.length && hasWords) {
        blocks.push({ type: "cards", cards: [...cardBuf] });
        cardBuf = [];
      }
      if (parts[i]) {
        let val = parts[i];
        if (blocks.length && blocks[blocks.length - 1].type === "cards") {
          val = val.replace(/^[\s.,;–—]+/, "");
        }
        if (val) blocks.push({ type: "text", value: val });
      }
    }
  }
  if (cardBuf.length) blocks.push({ type: "cards", cards: cardBuf });
  return blocks;
}

function cardAutoWidth(count) {
  const avail = 318;
  const gap = 8;
  const computed = Math.floor((avail - gap * (count - 1)) / count);
  const caps = [0, 110, 130, 92, 74, 62, 52];
  return Math.min(computed, caps[count] || 46);
}

function LessonContent({ text, isQuestion = false }) {
  const blocks = parseTextBlocks(text);
  const els = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const next = blocks[i + 1];
    const prev = blocks[i - 1];
    if (block.type === "text") {
      const isLabel = next && next.type === "cards" && /:\s*$/.test(block.value.trimEnd());
      if (isLabel) {
        const label = block.value.replace(/:\s*$/, "").replace(/\n/g, " ").trim();
        els.push(
          <div key={i} className="mono" style={{
            fontSize: 9.5, color: T.brassDim, letterSpacing: ".16em", textTransform: "uppercase",
            marginTop: i > 0 ? 24 : 0, marginBottom: 10,
          }}>
            {label}
          </div>
        );
      } else {
        const lines = block.value.split("\n");
        els.push(
          <div key={i} style={{
            fontSize: isQuestion ? 19 : 15.5,
            color: isQuestion ? T.card : "#c8ddd2",
            lineHeight: isQuestion ? 1.55 : 1.85,
            marginTop: (prev && prev.type === "cards") ? 18 : 0,
          }}>
            {lines.map((line, li) => (
              <React.Fragment key={li}>{li > 0 && <br />}{line}</React.Fragment>
            ))}
          </div>
        );
      }
    } else {
      const w = cardAutoWidth(block.cards.length);
      const afterLabel = prev && prev.type === "text" && /:\s*$/.test(prev.value.trimEnd());
      els.push(
        <div key={i} style={{
          display: "flex", gap: 8, justifyContent: "center", alignItems: "flex-end",
          margin: afterLabel ? "8px 0 4px 0" : "22px 0",
          flexWrap: block.cards.length > 6 ? "wrap" : "nowrap",
        }}>
          {block.cards.map((card, ci) => <PlayingCard key={ci} card={card} w={w} />)}
        </div>
      );
    }
  }
  return <>{els}</>;
}

function InlineRich({ text, size = 14 }) {
  const parts = text.split(/([AKQJT2-9][♠♥♦♣])/g);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          const card = parseCardStr(part);
          if (card) return (
            <span key={i} style={{ display: "inline-block", verticalAlign: "middle", margin: "0 2px", position: "relative", top: -1 }}>
              <PlayingCard card={card} w={size + 6} />
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function ModuleScreen({ moduleId, back, progress, onExercises, openModule, onComplete, trainerState }) {
  const m = MODULE_INDEX[moduleId];
  const [stepIdx, setStepIdx] = React.useState(0);
  const [mistakes, setMistakes] = React.useState(0);
  const [picked, setPicked] = React.useState(null);
  const [revealed, setRevealed] = React.useState(false);
  const [finished, setFinished] = React.useState(false);
  const [hearts, setHearts] = React.useState(3);
  const [combo, setCombo] = React.useState(0);
  const [peakCombo, setPeakCombo] = React.useState(0);
  const [outOfHearts, setOutOfHearts] = React.useState(false);
  // animation state
  const [floatingChips, setFloatingChips] = React.useState([]);
  const [heartBreaking, setHeartBreaking] = React.useState(-1);
  const [wrongShakeIdx, setWrongShakeIdx] = React.useState(-1);
  const [redFlash, setRedFlash] = React.useState(false);
  const [comboMilestone, setComboMilestone] = React.useState(null);
  const [screenShake, setScreenShake] = React.useState(false);
  const [comboBounce, setComboBounce] = React.useState(false);
  const [displayedChips, setDisplayedChips] = React.useState(0);
  const [showParticles, setShowParticles] = React.useState(false);

  // animate chip counter on completion
  React.useEffect(() => {
    if (!finished || !m) { setDisplayedChips(0); return; }
    const steps2 = m.steps || [];
    const mcq2 = steps2.filter((s) => s.type === "mcq").length;
    const alreadyDone2 = !!progress[moduleId];
    const xp2 = m.xp || 50;
    const base2 = mistakes === 0 ? xp2 : Math.max(Math.round(xp2 * 0.6), Math.round(xp2 * (1 - mistakes / Math.max(mcq2, 1)) * 0.8));
    const mult2 = peakCombo >= 5 ? 2.0 : peakCombo >= 3 ? 1.5 : 1.0;
    const flawless2 = mistakes === 0 && !alreadyDone2;
    const target = Math.round(base2 * mult2 * (flawless2 ? 1.5 : 1.0));
    if (flawless2) setTimeout(() => setShowParticles(true), 300);
    let frame;
    const t0 = performance.now();
    const dur = 950;
    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayedChips(Math.round(eased * target));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [finished]); // eslint-disable-line

  if (!m) return null;

  if (isModuleLocked(moduleId, progress)) {
    const frontier = getFrontier(progress);
    const ch = LEARN.find((c) => c.modules.some((mod) => mod.id === moduleId));
    const GLASS_LOCK = {
      background: "rgba(10,26,18,0.68)",
      backdropFilter: "blur(20px) saturate(150%)",
      WebkitBackdropFilter: "blur(20px) saturate(150%)",
      border: "1px solid rgba(201,165,70,0.16)",
      boxShadow: "0 6px 28px rgba(0,0,0,0.38), inset 0 1px 0 rgba(201,165,70,0.08)",
      borderRadius: 20,
    };
    return (
      <div style={{ padding: "calc(22px + env(safe-area-inset-top)) 18px 80px", height: "100%", overflowY: "auto", background: T.baize }}>
        <button onClick={back} style={{ background: "none", border: "none", color: T.brass, fontSize: 13, padding: 0 }}>← Learn</button>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginTop: 36 }}>
          <div style={{ ...GLASS_LOCK, padding: "36px 28px 32px", maxWidth: 340, width: "100%" }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>🔒</div>
            {ch && <div className="mono" style={{ fontSize: 10, color: T.faint, letterSpacing: ".1em", marginBottom: 8 }}>CHAPTER {ch.chapter} · {ch.title.toUpperCase()}</div>}
            <div className="serif" style={{ fontSize: 24, color: T.card, marginBottom: 10 }}>{m.title}</div>
            <div style={{ fontSize: 14, color: T.mist, lineHeight: 1.65, marginBottom: 28 }}>
              You haven't reached this yet. Build your foundation and it unlocks naturally as you progress.
            </div>
            {frontier && (
              <Btn kind="primary" onClick={() => openModule(frontier)} style={{ width: "100%" }}>
                Continue where you left off →
              </Btn>
            )}
          </div>
        </div>
      </div>
    );
  }

  const steps = m.steps || [];
  const mcqSteps = steps.filter((s) => s.type === "mcq").length;
  const step = steps[stepIdx];
  const alreadyDone = !!progress[moduleId];

  if (outOfHearts) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", background: T.baize, position: "relative", overflow: "hidden" }}>
        {/* entry red wash */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at center, transparent 30%, rgba(194,69,62,0.22) 100%)" }} />
        <div style={{
          background: "rgba(10,26,18,0.68)", backdropFilter: "blur(20px) saturate(150%)", WebkitBackdropFilter: "blur(20px) saturate(150%)",
          border: "1px solid rgba(224,113,107,0.35)", boxShadow: "0 0 40px rgba(194,69,62,0.18), 0 6px 28px rgba(0,0,0,0.45)",
          borderRadius: 20, padding: "38px 28px", maxWidth: 340, width: "100%", textAlign: "center",
          animation: "riqHeartbeatIn .55s cubic-bezier(.22,1,.36,1) both",
        }}>
          <div style={{ fontSize: 52, marginBottom: 14, display: "inline-block", animation: "riqHeartBreak .7s .1s ease forwards" }}>💔</div>
          <div className="serif" style={{ fontSize: 28, color: T.bad, marginBottom: 8, marginTop: 8 }}>Out of hearts</div>
          <div style={{ fontSize: 14, color: T.mist, lineHeight: 1.65, marginBottom: 28 }}>
            Mistakes are how we learn. Take another run at it.
          </div>
          <Btn kind="primary" onClick={() => {
            setStepIdx(0); setMistakes(0); setPicked(null); setRevealed(false);
            setFinished(false); setHearts(3); setCombo(0); setPeakCombo(0);
            setOutOfHearts(false); setRedFlash(false); setScreenShake(false);
            setFloatingChips([]); setComboMilestone(null);
          }} style={{ width: "100%", marginBottom: 10 }}>
            Try again →
          </Btn>
          <Btn onClick={back} style={{ width: "100%" }}>← Back to Learn</Btn>
        </div>
      </div>
    );
  }

  if (finished || stepIdx >= steps.length) {
    const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    const xp = m.xp || 50;
    const baseEarned = mistakes === 0 ? xp : Math.max(Math.round(xp * 0.6), Math.round(xp * (1 - mistakes / Math.max(mcqSteps, 1)) * 0.8));
    const multiplier = peakCombo >= 5 ? 2.0 : peakCombo >= 3 ? 1.5 : 1.0;
    const flawless = mistakes === 0 && !alreadyDone;
    const earned = Math.round(baseEarned * multiplier * (flawless ? 1.5 : 1.0));
    const nextCurrIdx = CURRICULUM_ORDER.indexOf(moduleId) + 1;
    const nextId = nextCurrIdx < CURRICULUM_ORDER.length ? CURRICULUM_ORDER[nextCurrIdx] : null;
    const nextMod = nextId ? MODULE_INDEX[nextId] : null;
    const starEmoji = ["★★★", "★★☆", "★☆☆"][3 - stars];
    const mastery = (trainerState && trainerState.mastery && trainerState.mastery[moduleId]) || 0;
    return (
      <div style={{ padding: "calc(22px + env(safe-area-inset-top)) 18px 80px", height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", background: T.baize, position: "relative" }}>

        {/* flawless particles */}
        {showParticles && Array.from({ length: 16 }, (_, i) => {
          const angle = (i / 16) * 2 * Math.PI;
          const dist = 80 + (i % 4) * 35;
          const px = Math.round(Math.cos(angle) * dist);
          const py = Math.round(Math.sin(angle) * dist);
          return (
            <div key={i} style={{
              position: "fixed", top: "42%", left: "50%",
              width: i % 3 === 0 ? 8 : 5, height: i % 3 === 0 ? 8 : 5,
              borderRadius: "50%", pointerEvents: "none", zIndex: 300,
              background: i % 3 === 0 ? T.brass : i % 3 === 1 ? "#FFF8E7" : T.brassDim,
              "--px": `${px}px`, "--py": `${py}px`,
              animation: `riqGoldParticle 1.3s ${i * 55}ms cubic-bezier(.2,.8,.4,1) forwards`,
            }} />
          );
        })}

        <div style={{
          background: "rgba(10,26,18,0.68)", backdropFilter: "blur(20px) saturate(150%)", WebkitBackdropFilter: "blur(20px) saturate(150%)",
          border: `1px solid ${flawless ? "rgba(201,165,70,0.5)" : "rgba(201,165,70,0.16)"}`,
          boxShadow: flawless ? "0 6px 28px rgba(0,0,0,0.38)" : "0 6px 28px rgba(0,0,0,0.38), inset 0 1px 0 rgba(201,165,70,0.08)",
          borderRadius: 20, marginTop: 32, padding: "32px 28px 28px", width: "100%", maxWidth: 340,
          animation: flawless ? "riqFlawlessBorder 2s .4s ease infinite" : "none",
        }}>
          {flawless && (
            <div className="mono" style={{ fontSize: 10, letterSpacing: ".28em", color: T.brass, marginBottom: 14, textTransform: "uppercase", animation: "riqShimmer 1.8s ease infinite" }}>✦ Flawless ✦</div>
          )}
          <div style={{ fontSize: 52, letterSpacing: 4, color: T.brass, animation: "riqFadeUp .4s ease" }}>{starEmoji}</div>
          <div className="serif" style={{ fontSize: 26, color: T.card, marginTop: 12, animation: "riqFadeUp .4s .1s ease both" }}>
            {alreadyDone ? "Reviewed!" : flawless ? "Perfect run!" : "Complete!"}
          </div>
          <div style={{ fontSize: 14, color: T.mist, marginTop: 6, animation: "riqFadeUp .4s .15s ease both" }}>{m.title}</div>
          {mastery > 0 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 10, animation: "riqFadeUp .4s .2s ease both" }}>
              {[1,2,3,4,5].map((s) => (
                <span key={s} style={{ fontSize: 12, color: s <= mastery ? T.brass : T.faint }}>★</span>
              ))}
            </div>
          )}
          {/* animated chip counter */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20,
            background: "rgba(201,165,70,0.10)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
            border: "1px solid rgba(201,165,70,0.22)", borderRadius: 12, padding: "14px 28px",
            animation: "riqFadeUp .5s .25s ease both",
          }}>
            <span style={{ fontSize: 16 }}>🪙</span>
            <span style={{ fontSize: 30, fontWeight: 800, color: T.brass, fontFamily: "IBM Plex Mono, monospace", animation: "riqChipRoll .3s ease" }}>
              +{displayedChips}
            </span>
            {multiplier > 1 && <span className="mono" style={{ fontSize: 12, color: T.brassDim }}>×{multiplier.toFixed(1)}</span>}
          </div>
          {(flawless || multiplier > 1) && (
            <div className="mono" style={{ fontSize: 10, color: T.brassDim, marginTop: 7, letterSpacing: ".1em", animation: "riqFadeUp .4s .35s ease both" }}>
              {peakCombo > 0 ? `${peakCombo}-COMBO` : ""}{peakCombo > 0 && flawless ? " + " : ""}{flawless ? "FLAWLESS BONUS" : ""}
            </div>
          )}
          {mistakes > 0 && (
            <div style={{ fontSize: 12, color: T.mist, marginTop: 12 }}>{mistakes} mistake{mistakes !== 1 ? "s" : ""} — keep drilling to sharpen it</div>
          )}
        </div>
        <div style={{ width: "100%", maxWidth: 340, marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {nextMod && !isModuleLocked(nextId, progress) && (
            <Btn kind="primary" onClick={() => openModule(nextId)} style={{ width: "100%" }}>
              Next: {nextMod.title} →
            </Btn>
          )}
          <Btn kind="felt" onClick={() => onExercises && onExercises(moduleId)} style={{ width: "100%" }}>
            Keep drilling ↗
          </Btn>
          <Btn onClick={back} style={{ width: "100%" }}>
            ← Back to Learn
          </Btn>
        </div>
      </div>
    );
  }

  const pct = steps.length > 0 ? stepIdx / steps.length : 0;

  const advance = () => {
    setPicked(null);
    setRevealed(false);
    if (stepIdx + 1 >= steps.length) {
      const xp = m.xp || 50;
      const baseEarned = mistakes === 0 ? xp : Math.max(Math.round(xp * 0.6), Math.round(xp * (1 - mistakes / Math.max(mcqSteps, 1)) * 0.8));
      const multiplier = peakCombo >= 5 ? 2.0 : peakCombo >= 3 ? 1.5 : 1.0;
      const flawless = mistakes === 0 && !alreadyDone;
      const earned = Math.round(baseEarned * multiplier * (flawless ? 1.5 : 1.0));
      if (onComplete) onComplete(moduleId, earned, alreadyDone, peakCombo);
      setFinished(true);
    } else {
      setStepIdx((i) => i + 1);
    }
  };

  const submitMCQ = (i) => {
    if (revealed) return;
    setPicked(i);
    setRevealed(true);
    if (i === step.a) {
      const newCombo = combo + 1;
      setCombo(newCombo);
      setPeakCombo((p) => Math.max(p, newCombo));
      // combo bounce badge
      setComboBounce(true);
      setTimeout(() => setComboBounce(false), 420);
      // floating chip text — per-question estimate
      const mult = newCombo >= 5 ? 2.0 : newCombo >= 3 ? 1.5 : 1.0;
      const chipEst = Math.max(1, Math.round(((m.xp || 50) / Math.max(mcqSteps, 1)) * mult));
      const fcId = Date.now();
      setFloatingChips((fc) => [...fc, { id: fcId, amount: chipEst }]);
      setTimeout(() => setFloatingChips((fc) => fc.filter((f) => f.id !== fcId)), 900);
      // milestone overlays
      if (newCombo === 3 || newCombo === 5 || newCombo === 10) {
        const labels = { 3: "3× STREAK  🔥", 5: "ON FIRE  🔥🔥", 10: "UNSTOPPABLE  ⚡" };
        setComboMilestone(labels[newCombo]);
        setTimeout(() => setComboMilestone(null), 1500);
      }
    } else {
      setMistakes((ms) => ms + 1);
      setCombo(0);
      const newHearts = hearts - 1;
      setHearts(newHearts);
      // wrong-answer shake on that button
      setWrongShakeIdx(i);
      setTimeout(() => setWrongShakeIdx(-1), 620);
      // red vignette flash
      setRedFlash(true);
      setTimeout(() => setRedFlash(false), 520);
      // heart break animation for the heart we just lost
      setHeartBreaking(newHearts);
      setTimeout(() => setHeartBreaking(-1), 620);
      if (newHearts <= 0) {
        setScreenShake(true);
        setTimeout(() => setScreenShake(false), 520);
        setTimeout(() => setOutOfHearts(true), 1200);
      }
    }
  };

  const qNum = steps.slice(0, stepIdx).filter((s) => s.type === "mcq").length + 1;
  const isLast = stepIdx + 1 >= steps.length;

  const GLASS = {
    background: "rgba(10,26,18,0.68)",
    backdropFilter: "blur(20px) saturate(150%)",
    WebkitBackdropFilter: "blur(20px) saturate(150%)",
    border: "1px solid rgba(201,165,70,0.16)",
    boxShadow: "0 6px 28px rgba(0,0,0,0.38), inset 0 1px 0 rgba(201,165,70,0.08)",
    borderRadius: 20,
  };

  const multiplierNow = combo >= 5 ? 2.0 : combo >= 3 ? 1.5 : 1.0;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", paddingTop: "calc(env(safe-area-inset-top) + 12px)", background: T.baize, animation: screenShake ? "riqScreenShake .5s ease" : "none" }}>

      {/* ── Red vignette flash on wrong answer ── */}
      {redFlash && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: "none", background: "radial-gradient(ellipse at center, transparent 35%, rgba(194,69,62,0.6) 100%)", animation: "riqRedFlash .52s ease forwards" }} />
      )}

      {/* ── Combo milestone stamp ── */}
      {comboMilestone && (
        <div style={{ position: "fixed", inset: 0, zIndex: 201, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", left: "50%", animation: "riqComboStamp 1.5s ease forwards", fontSize: 30, fontWeight: 800, letterSpacing: ".1em", color: T.brass, textShadow: `0 0 40px rgba(201,165,70,.9), 0 0 80px rgba(201,165,70,.5)`, fontFamily: "DM Serif Display, Georgia, serif", whiteSpace: "nowrap" }}>
            {comboMilestone}
          </div>
        </div>
      )}

      {/* ── Floating chip texts ── */}
      {floatingChips.map((fc) => (
        <div key={fc.id} style={{ position: "fixed", top: "28%", left: "50%", transform: "translateX(-50%)", zIndex: 202, pointerEvents: "none", animation: "riqChipFloat .9s ease forwards", fontSize: 22, fontWeight: 800, color: T.brass, fontFamily: "IBM Plex Mono, monospace", textShadow: "0 0 24px rgba(201,165,70,.7)", whiteSpace: "nowrap" }}>
          +{fc.amount} 🪙
        </div>
      ))}

      {/* ── Progress header ── */}
      <div style={{ padding: "0 20px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={back} style={{ background: "none", border: "none", color: T.mist, fontSize: 20, padding: 0, lineHeight: 1, flexShrink: 0, opacity: 0.7 }}>✕</button>
          <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(201,165,70,0.1)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct * 100}%`, background: `linear-gradient(90deg, ${T.brassDim}, ${T.brass})`, borderRadius: 3, transition: "width .4s cubic-bezier(.4,0,.2,1)" }} />
          </div>
          {/* Hearts */}
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {[0,1,2].map((i) => (
              <span key={i} style={{
                fontSize: 14,
                display: "inline-block",
                opacity: (i < hearts || i === heartBreaking) ? 1 : 0.18,
                transition: i !== heartBreaking ? "opacity .25s" : "none",
                animation: i === heartBreaking ? "riqHeartBreak .6s ease forwards" : "none",
                transformOrigin: "center",
              }}>❤️</span>
            ))}
          </div>
          {/* Combo badge */}
          {combo >= 2 && (
            <div className="mono" style={{
              fontSize: 10, fontWeight: 700,
              color: combo >= 5 ? T.good : combo >= 3 ? T.brass : T.brassDim,
              background: combo >= 5 ? "rgba(127,201,127,0.15)" : "rgba(201,165,70,0.15)",
              border: `1px solid ${combo >= 5 ? "rgba(127,201,127,0.4)" : "rgba(201,165,70,0.3)"}`,
              borderRadius: 10, padding: "2px 7px", flexShrink: 0, letterSpacing: ".08em",
              display: "inline-block",
              animation: comboBounce ? "riqComboBounce .42s ease" : "none",
              transformOrigin: "center",
            }}>
              {combo}× {combo >= 5 ? "🔥" : ""}
            </div>
          )}
        </div>
      </div>

      {/* ── INFO STEP ── */}
      {step.type === "info" && (
        <div key={`i${stepIdx}`} style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px", animation: "riqFadeUp .3s ease" }}>
          <div style={{ ...GLASS, borderTop: "2px solid rgba(201,165,70,0.32)", padding: "26px 22px 28px", minHeight: "100%" }}>
            <div className="mono" style={{ fontSize: 9.5, color: T.brassDim, letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 16 }}>
              {m.topic} · {m.title}
            </div>
            <div className="serif" style={{ fontSize: 30, color: T.card, lineHeight: 1.18, marginBottom: 26 }}>
              {step.heading}
            </div>
            <div style={{ fontSize: 15.5, color: "#c8ddd2", lineHeight: 1.85 }}>
              <LessonContent text={step.body} />
            </div>
          </div>
        </div>
      )}

      {/* ── MCQ STEP ── */}
      {step.type === "mcq" && (
        <div key={`q${stepIdx}`} style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 12, animation: "riqFadeUp .3s ease" }}>

          {/* Question glass panel */}
          <div style={{ ...GLASS, padding: "20px 22px 22px" }}>
            <div className="mono" style={{ fontSize: 9, color: T.faint, letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 16 }}>
              Question {qNum} of {mcqSteps}
            </div>
            <LessonContent text={step.q} isQuestion />
          </div>

          {/* Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {step.opts.map((opt, i) => {
              const isCorrect = i === step.a;
              const isPicked = picked === i;
              const showGreen = revealed && isCorrect;
              const showRed = revealed && isPicked && !isCorrect;
              const badgeCol = showGreen ? T.good : showRed ? T.bad : T.brass;
              const optBg = showGreen ? "rgba(127,201,127,0.10)" : showRed ? "rgba(224,113,107,0.09)" : "rgba(10,26,18,0.60)";
              const optBorder = showGreen ? "rgba(127,201,127,0.4)" : showRed ? "rgba(224,113,107,0.4)" : "rgba(201,165,70,0.14)";
              return (
                <button key={i} onClick={() => submitMCQ(i)} style={{
                  width: "100%", textAlign: "left",
                  background: optBg,
                  backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
                  border: `1px solid ${optBorder}`,
                  boxShadow: showGreen ? "0 0 14px rgba(127,201,127,0.22), inset 0 1px 0 rgba(127,201,127,0.08)"
                            : showRed   ? "0 0 14px rgba(224,113,107,0.18), inset 0 1px 0 rgba(224,113,107,0.06)"
                                        : "inset 0 1px 0 rgba(201,165,70,0.05)",
                  borderRadius: 16, padding: "15px 16px",
                  display: "flex", alignItems: "center", gap: 14,
                  transition: "background .22s, border-color .22s, box-shadow .22s",
                  fontFamily: "inherit", cursor: "pointer",
                  animation: wrongShakeIdx === i ? "riqWrongShake .6s ease" : "none",
                }}>
                  <span className="mono" style={{
                    width: 30, height: 30, borderRadius: 15, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: showGreen ? "rgba(127,201,127,0.18)" : showRed ? "rgba(224,113,107,0.15)" : "rgba(201,165,70,0.08)",
                    border: `1.5px solid ${badgeCol}50`,
                    fontSize: 12, fontWeight: 700, color: badgeCol,
                    transition: "all .22s",
                  }}>
                    {["A","B","C"][i]}
                  </span>
                  <span style={{ flex: 1, fontSize: 14.5, color: T.card, lineHeight: 1.5 }}>
                    <InlineRich text={opt} size={14} />
                  </span>
                  {showGreen && <span style={{ color: T.good, fontSize: 19, flexShrink: 0 }}>✓</span>}
                  {showRed   && <span style={{ color: T.bad,  fontSize: 19, flexShrink: 0 }}>✗</span>}
                </button>
              );
            })}
          </div>

          {/* Explanation panel */}
          {revealed && (
            <div style={{
              background: picked === step.a ? "rgba(127,201,127,0.08)" : "rgba(224,113,107,0.08)",
              backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              border: `1px solid ${picked === step.a ? "rgba(127,201,127,0.35)" : "rgba(224,113,107,0.35)"}`,
              borderLeft: `3px solid ${picked === step.a ? T.good : T.bad}`,
              borderRadius: 16, padding: "16px 18px",
              boxShadow: `inset 0 1px 0 ${picked === step.a ? "rgba(127,201,127,0.06)" : "rgba(224,113,107,0.05)"}`,
              animation: "riqFadeUp .24s ease",
            }}>
              <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: picked === step.a ? T.good : T.bad, marginBottom: 8, letterSpacing: ".12em" }}>
                {picked === step.a ? "✓  CORRECT" : "✗  NOT QUITE"}
              </div>
              {picked === step.a && combo >= 3 && (
                <div className="mono" style={{ fontSize: 10, color: combo >= 5 ? T.good : T.brass, marginBottom: 6, letterSpacing: ".08em" }}>
                  {combo}-STREAK · ×{multiplierNow.toFixed(1)} XP
                </div>
              )}
              <div style={{ fontSize: 14, color: "#c8ddd2", lineHeight: 1.65 }}>
                <InlineRich text={step.why} size={14} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Footer CTA ── */}
      <div style={{
        padding: "14px 20px", paddingBottom: "calc(14px + env(safe-area-inset-bottom))", flexShrink: 0,
        borderTop: `1px solid rgba(201,165,70,0.12)`,
        background: "rgba(8,18,13,0.75)",
        backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
      }}>
        {(step.type === "info" || revealed) ? (
          <Btn kind="primary" onClick={advance} style={{ width: "100%", fontSize: 16, padding: "17px", borderRadius: 16 }}>
            {isLast ? (alreadyDone ? "Done reviewing" : "Complete!  ★") : step.type === "info" ? "Got it  →" : "Continue  →"}
          </Btn>
        ) : (
          <div style={{ height: 56, borderRadius: 16, background: "rgba(201,165,70,0.04)", border: `1px solid rgba(201,165,70,0.10)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 13, color: T.faint }}>Choose an answer above</span>
          </div>
        )}
      </div>
    </div>
  );
}
function TendencyStat({ label, value, raw, lo, hi, lowText, highText, okText }) {
  // value is a percent string like "42%"; raw is the number; lo/hi define the healthy band.
  let read = okText, color = T.good;
  if (raw != null && lo != null && raw < lo) { read = lowText; color = T.brass; }
  else if (raw != null && hi != null && raw > hi) { read = highText; color = T.cordovan; }
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "2px 2px" }}>
      <div className="serif" style={{ fontSize: 22, lineHeight: 1, color: T.card }}>{value}</div>
      <div style={{ fontSize: 9, color: T.faint, marginTop: 5, textTransform: "uppercase", letterSpacing: ".1em" }}>{label}</div>
      {read && <div style={{ fontSize: 9, color, marginTop: 3 }}>{read}</div>}
    </div>
  );
}
function ProfileScreen({ user, rating, ratingHistory, sessions, progress, answers, lifetime, onSignOut, onDeleteAccount, tendencies, cosmetics, onCosmetic, trainer, go }) {
  const allStats = sessions.length ? sessions[sessions.length - 1].stats : null;
  const agg = { hands: lifetime.hands, net: lifetime.net };
  const modsDone = Object.keys(progress).length;
  const ts = tendencies && tendencies.trainer ? tendencies.trainer : trainer || {};
  const W = 320, H = 90;
  const lo = Math.min(...ratingHistory) - 30, hi = Math.max(...ratingHistory) + 30;
  const yOf = (v) => H - ((v - lo) / Math.max(1, hi - lo)) * H;
  const pts = ratingHistory.length > 1 ? ratingHistory.map((v, i) => `${(i / (ratingHistory.length - 1)) * W},${yOf(v)}`).join(" ") : null;
  return (
    <div style={{ padding: "calc(24px + env(safe-area-inset-top)) 18px 80px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div className="serif" style={{ width: 56, height: 56, borderRadius: "50%", background: T.baize2, border: "2px solid " + T.brass, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: T.brass }}>{user.name[0].toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="serif" style={{ fontSize: 23, color: T.card }}>{user.name}</div>
          <div style={{ fontSize: 12, color: T.faint }}>Level {levelInfo(xpTotalOf(trainer)).level} · {tierOf(rating)} · {answers.exp || "Player"}</div>
        </div>
        <LevelRing ts={trainer} size={46} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18, padding: "12px 16px", background: T.baize2, border: "1px solid " + T.line, borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🪙</span>
          <div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: T.brass, lineHeight: 1 }}>{((trainer && trainer.xp_chips) || 0).toLocaleString()}</div>
            <div style={{ fontSize: 11, color: T.mist, marginTop: 2 }}>chips earned</div>
          </div>
        </div>
        {go && <button onClick={() => go("shop")} style={{ background: T.brass, color: "#1B1505", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700 }}>Shop →</button>}
      </div>
      <SectionTitle>Rating</SectionTitle>
      <div className="gp" style={{ background: T.baize2, border: "1px solid " + T.line, borderRadius: 14, padding: 16 }}>
        <RatingBar value={rating} delta={sessions.length ? sessions[sessions.length - 1].ratingDelta : null} band={ratingBand(lifetime.hands)} />
        {pts && (
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ marginTop: 14, display: "block" }} aria-label="Rating history">
            <polyline points={pts} fill="none" stroke={T.brass} strokeWidth="2.5" strokeLinejoin="round" />
            {ratingHistory.map((v, i) => <circle key={i} cx={(i / (ratingHistory.length - 1)) * W} cy={yOf(v)} r="3.5" fill={T.brass} />)}
          </svg>
        )}
      </div>
      <SectionTitle>Lifetime</SectionTitle>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <StatChip label="Hands" value={agg.hands} />
        <div style={{ width: 1, background: T.line, margin: "4px 0" }} />
        <StatChip label="Net chips" value={(agg.net >= 0 ? "+" : "") + agg.net.toLocaleString()} accent={agg.net >= 0 ? T.good : T.bad} />
        <div style={{ width: 1, background: T.line, margin: "4px 0" }} />
        <StatChip label="Modules" value={modsDone} />
      </div>
      {allStats && (
        <>
          <SectionTitle>Last session</SectionTitle>
          <div style={{ display: "flex", alignItems: "stretch" }}>
            <StatChip label="VPIP" value={allStats.vpip + "%"} />
            <div style={{ width: 1, background: T.line, margin: "4px 0" }} />
            <StatChip label="PFR" value={allStats.pfr + "%"} />
            <div style={{ width: 1, background: T.line, margin: "4px 0" }} />
            <StatChip label="3-bet" value={allStats.threeBetPct + "%"} />
            <div style={{ width: 1, background: T.line, margin: "4px 0" }} />
            <StatChip label="Aggression" value={allStats.af} />
          </div>
        </>
      )}
      {(() => {
        const cos = (typeof profileCosmetics !== "undefined" ? profileCosmetics : null) || cosmetics || {};
        const unlocked = ["classic", ...(cos.unlocked || [])];
        const backs = unlocked.filter((u) => u === "classic" || u.startsWith("back-"));
        const felts = ["default", ...(cos.unlocked || []).filter((u) => u.startsWith("felt-"))];
        if (backs.length <= 1 && felts.length <= 1) return null;
        return (
          <>
            <SectionTitle>Table style <span style={{ fontSize: 11, color: T.faint }}>(streak rewards)</span></SectionTitle>
            <div style={{ background: T.baize2, border: "1px solid " + T.line, borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 11.5, color: T.faint, marginBottom: 6 }}>Card back</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {backs.map((b) => (
                  <button key={b} onClick={() => onCosmetic("back", b)} style={{ borderRadius: 8, border: "2px solid " + ((cos.back || "classic") === b ? T.brass : T.line), background: "none", padding: 3 }}>
                    <PlayingCard hidden w={30} />
                    <span style={{ display: "none" }}>{b}</span>
                  </button>
                ))}
              </div>
              {felts.length > 1 && (
                <>
                  <div style={{ fontSize: 11.5, color: T.faint, margin: "10px 0 6px" }}>Felt</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {felts.map((f) => {
                      const feltBg = { default: T.baize, "felt-forest": "#0F2015", "felt-midnight": "#14233B", "felt-burgundy": "#2A1018", "felt-slate": "#1A2030" };
                      const feltLabel = { default: "Classic", "felt-forest": "Forest", "felt-midnight": "Midnight", "felt-burgundy": "Burgundy", "felt-slate": "Slate" };
                      return (
                        <button key={f} onClick={() => onCosmetic("felt", f === "default" ? null : f)} style={{ flex: 1, padding: 9, borderRadius: 10, border: "1px solid " + (((cos.felt || null) === (f === "default" ? null : f)) ? T.brass : T.line), background: feltBg[f] || T.baize, color: T.mist, fontSize: 11 }}>{feltLabel[f] || f}</button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </>
        );
      })()}
      {tendencies && tendencies.hands >= 10 && (() => {
        const m = tendencies.metrics || {};
        const rawPct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
        const pct = (a, b) => { const v = rawPct(a, b); return v == null ? "-" : v + "%"; };
        const frd = (st) => pct(m.folded?.[st] || 0, m.faced?.[st] || 0);
        const frdRaw = (st) => rawPct(m.folded?.[st] || 0, m.faced?.[st] || 0);
        const vpipRaw = rawPct(m.vpip || 0, tendencies.hands);
        const pfrRaw = rawPct(m.pfr || 0, tendencies.hands);
        return (
          <>
            <SectionTitle right={<span className="mono" style={{ fontSize: 10, color: T.faint }}>{tendencies.hands} hands tracked</span>}>Your tendencies</SectionTitle>
            <div style={{ background: T.baize2, border: "1px solid " + T.line, borderRadius: 14, padding: "16px 14px" }}>
              <div style={{ display: "flex" }}>
                <TendencyStat label="Plays hands" value={pct(m.vpip || 0, tendencies.hands)} raw={vpipRaw} lo={22} hi={32} lowText="bit tight" highText="too loose" okText="solid" />
                <div style={{ width: 1, background: T.line, margin: "2px 0" }} />
                <TendencyStat label="Raises first" value={pct(m.pfr || 0, tendencies.hands)} raw={pfrRaw} lo={15} hi={26} lowText="too passive" highText="aggressive" okText="solid" />
                <div style={{ width: 1, background: T.line, margin: "2px 0" }} />
                <TendencyStat label="Gap" value={vpipRaw != null && pfrRaw != null ? (vpipRaw - pfrRaw) + "%" : "-"} raw={vpipRaw != null && pfrRaw != null ? vpipRaw - pfrRaw : null} lo={0} hi={12} highText="too much calling" okText="tight gap" />
              </div>
              <div style={{ display: "flex", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
                <TendencyStat label="Folds flop" value={frd("flop")} raw={frdRaw("flop")} lo={38} hi={62} lowText="calls a lot" highText="overfolds" okText="balanced" />
                <div style={{ width: 1, background: T.line, margin: "2px 0" }} />
                <TendencyStat label="Folds turn" value={frd("turn")} raw={frdRaw("turn")} lo={40} hi={64} lowText="sticky" highText="overfolds" okText="balanced" />
                <div style={{ width: 1, background: T.line, margin: "2px 0" }} />
                <TendencyStat label="Folds river" value={frd("river")} raw={frdRaw("river")} lo={42} hi={68} lowText="calls down" highText="overfolds" okText="balanced" />
              </div>
              <div style={{ fontSize: 11, color: T.faint, marginTop: 12, lineHeight: 1.5 }}>
                This is how you actually play, measured. The colored read is against a winning baseline. Opponents never see this, and you never see theirs.
              </div>
            </div>
          </>
        );
      })()}
      {(() => {
        const got = (trainer && trainer.badges) || {};
        const earned = BADGES.filter((b) => got[b.id]).length;
        return (
          <>
            <SectionTitle right={<span className="mono" style={{ fontSize: 10, color: earned > 0 ? T.brass : T.faint }}>{earned}/{BADGES.length}</span>}>Badge case</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {BADGES.map((b) => {
                const has = !!got[b.id];
                return (
                  <div key={b.id} title={b.desc + (has ? ` — earned ${got[b.id]}` : "")} style={{ textAlign: "center", padding: "10px 3px 8px", borderRadius: 12, background: has ? "rgba(201,165,70,.1)" : "rgba(10,26,18,.5)", border: `1px solid ${has ? "rgba(201,165,70,.42)" : T.line}`, opacity: has ? 1 : 0.42 }}>
                    <div style={{ fontSize: 20, filter: has ? "none" : "grayscale(1) brightness(.6)" }}>{b.icon}</div>
                    <div style={{ fontSize: 8.5, color: has ? T.brass : T.faint, marginTop: 4, fontWeight: 700, lineHeight: 1.25 }}>{b.name}</div>
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}
      <Btn kind="danger" onClick={onSignOut} style={{ width: "100%", marginTop: 16 }}>Sign out</Btn>
      <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid rgba(194,69,62,.18)" }}>
        <div style={{ fontSize: 11, color: T.faint, textAlign: "center", marginBottom: 10, lineHeight: 1.5 }}>
          Deletes your account, rating, sessions, and all gameplay data permanently.
        </div>
        <Btn kind="danger" onClick={onDeleteAccount} style={{ width: "100%", background: "rgba(194,69,62,.08)", border: "1px solid rgba(194,69,62,.35)", fontSize: 13 }}>Delete account</Btn>
      </div>
    </div>
  );
}

/* ============================ MULTIPLAYER (private tables) ============================ */
async function tableCall(type, table_id, extra = {}) {
  try {
    const r = await sbFetch("/functions/v1/table-action", { method: "POST", body: JSON.stringify({ type, table_id, ...extra }) });
    return { ok: r.ok, data: await r.json().catch(() => ({})) };
  } catch { return { ok: false, data: {} }; }
}
function MpSetup({ onSeated, back }) {
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [code, setCode] = useState("");
  const [minHands, setMinHands] = useState(0);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  async function go(create) {
    setErr(null); setBusy(true);
    try {
      const r = await sbFetch("/functions/v1/join-table", { method: "POST", body: JSON.stringify(create ? { create: true, min_hands: minHands } : { table_code: code.trim() }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(data.error || `Table server answered ${r.status}, check that join-table is deployed with that exact name.`); return; }
      if (!data.table) { setErr("Unexpected reply from join-table, it may still be running the old version. Paste the new code over it and redeploy."); return; }
      onSeated(data.table, data.seat);
    } catch (e) {
      setErr("Couldn't reach the table server. Usually this means the join-table function isn't deployed yet (or was deployed under a different name), Edge Functions → Deploy → name it exactly join-table, then paste the new code.");
    } finally { setBusy(false); }
  }
  const inputStyle = { width: "100%", padding: "13px 16px", borderRadius: 12, border: "1px solid " + T.line, background: T.baize2, color: T.card, fontSize: 17, textAlign: "center", letterSpacing: ".3em" };
  return (
    <div style={{ padding: "calc(22px + env(safe-area-inset-top)) 18px 80px", height: "100%", overflowY: "auto" }}>
      <button onClick={back} style={{ background: "none", border: "none", color: T.brass, fontSize: 13, padding: 0 }}>← Lobby</button>
      <div className="serif" style={{ fontSize: 25, color: T.card, margin: "12px 0 4px" }}>Private table</div>
      <div style={{ color: T.faint, fontSize: 13, marginBottom: 20 }}>Real people only, share a 6-digit code. The server deals; nobody can peek.</div>
      {!mode && (
        <>
          <Btn kind="primary" onClick={() => setMode("create")} style={{ width: "100%", marginBottom: 10 }}>Create a table</Btn>
          <Btn kind="felt" onClick={() => setMode("join")} style={{ width: "100%" }}>Join with a code</Btn>
        </>
      )}
      {mode === "create" && (
        <>
          <div style={{ fontSize: 13, color: T.mist, marginBottom: 8 }}>Require players to have experience?</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[[0, "Anyone"], [25, "25+ hands"], [100, "100+ hands"]].map(([v, l]) => (
              <button key={v} onClick={() => setMinHands(v)} style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid " + (minHands === v ? T.brass : T.line), background: minHands === v ? "rgba(201,165,70,.12)" : "transparent", color: minHands === v ? T.brass : T.mist, fontSize: 13, fontWeight: 600 }}>{l}</button>
            ))}
          </div>
          <Btn kind="primary" disabled={busy} onClick={() => go(true)} style={{ width: "100%" }}>{busy ? "Setting up…" : "Create & get code"}</Btn>
        </>
      )}
      {mode === "join" && (
        <>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" inputMode="numeric" style={inputStyle} className="mono" />
          <Btn kind="primary" disabled={busy || code.length !== 6} onClick={() => go(false)} style={{ width: "100%", marginTop: 12 }}>{busy ? "Joining…" : "Join table"}</Btn>
        </>
      )}
      {err && <div style={{ color: T.bad, fontSize: 13, marginTop: 12, lineHeight: 1.5 }}>{err}</div>}
    </div>
  );
}
function MpSeatBox({ p, slot, isMe, toAct, button, winners, showdown }) {
  if (!p || p.left) return null;
  const acting = toAct === p.seat;
  const won = winners && winners.some((w) => w.idx === p.seat);
  const showCards = (isMe || (showdown && p.cards)) && p.cards;
  const showBacksAtShowdown = showdown && !p.cards && !p.folded && !isMe;
  return (
    <div style={{ position: "absolute", ...SEAT_POS[slot], transform: "translate(-50%,-50%)", textAlign: "center", opacity: p.folded ? 0.38 : 1, zIndex: 5 }}>
      <div style={{ display: "flex", gap: 3, justifyContent: "center", marginBottom: 4, minHeight: isMe ? 64 : 44 }}>
        {showBacksAtShowdown
          ? [0, 1].map((i) => <PlayingCard key={i} card={null} hidden={true} w={isMe ? 44 : 30} />)
          : [0, 1].map((i) => (
            <PlayingCard key={i} card={showCards ? p.cards[i] : null} hidden={!showCards} w={isMe ? 44 : 30} />
          ))
        }
      </div>
      <div style={{ background: won ? "rgba(201,165,70,.18)" : "rgba(7,16,11,.88)", border: `1.5px solid ${acting || won ? T.brass : T.line}`, borderRadius: 10, padding: "4px 9px", minWidth: 76, animation: acting ? "riqPulse 1.4s infinite" : "none", position: "relative" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: won ? T.brass : T.card }}>{p.name}{button === p.seat && <span style={{ color: T.brass }}> ⓓ</span>}</div>
        <div className="mono" style={{ fontSize: 11.5, color: p.allIn ? T.cordovan : T.mist }}>{p.allIn ? "ALL-IN" : (p.stack ?? 0).toLocaleString()}</div>
      </div>
      {p.bet > 0 && (
        <div className="mono" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: -26, background: "rgba(194,69,62,.92)", color: "#fff", borderRadius: 99, padding: "2px 9px", fontSize: 11.5, fontWeight: 600 }}>{p.bet.toLocaleString()}</div>
      )}
    </div>
  );
}
const MP_AFK_SECONDS = 90;
const MP_AFK_KICK_STREAK = 2;
function MpTableScreen({ table, mySeat, profile, onLeft }) {
  const [pub, setPub] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [myCards, setMyCards] = useState(null);
  const cardsHandRef = useRef(-1);
  const [raiseTo, setRaiseTo] = useState(0);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const aliveRef = useRef(true);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const afkStreakRef = useRef({});

  useEffect(() => { const t = setInterval(() => setNowTs(Date.now()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    aliveRef.current = true;
    let timer;
    const tick = async () => {
      const { data } = await tableCall("state", table.id);
      if (!aliveRef.current) return;
      if (data.pub) {
        setPub(data.pub); setLobby(null);
        if (data.pub.handNo !== cardsHandRef.current) {
          cardsHandRef.current = data.pub.handNo;
          const mc = await tableCall("my_cards", table.id);
          if (aliveRef.current && mc.data) setMyCards(mc.data.cards);
        }
      } else if (data.lobby) setLobby(data.lobby);
      timer = setTimeout(tick, data.pub && data.pub.toAct === mySeat ? 600 : 1100);
    };
    tick();
    return () => { aliveRef.current = false; clearTimeout(timer); };
  }, [table.id]); // eslint-disable-line

  const me = pub && pub.players[mySeat];
  const toCall = pub && me ? Math.max(0, pub.currentBet - me.bet) : 0;
  const myTurn = pub && pub.toAct === mySeat && pub.street !== "result";
  const minRaiseTo = pub && me ? Math.min(pub.currentBet + pub.minRaise, me.bet + me.stack) : 0;
  const maxRaiseTo = me ? me.bet + me.stack : 0;
  useEffect(() => { if (pub) setRaiseTo(Math.min(Math.max(minRaiseTo, pub.currentBet * 2 || BB * 3), maxRaiseTo)); }, [pub && pub.handNo, pub && pub.street, pub && pub.currentBet]); // eslint-disable-line
  const aliveOpp = pub ? pub.players.filter((p) => p.seat !== mySeat && !p.folded && !p.left).length : 0;
  const equity = useMemo(() => (myCards && pub && me && !me.folded ? equityMC(myCards, pub.board, Math.max(1, aliveOpp), 140) : 0),
    [myCards, pub && pub.street, pub && pub.board.length, aliveOpp]); // eslint-disable-line

  const afkRemaining = pub && pub.toAct >= 0 && pub.toAct !== mySeat && pub.turnStarted
    ? Math.max(0, MP_AFK_SECONDS - Math.floor((nowTs - pub.turnStarted) / 1000))
    : MP_AFK_SECONDS;

  useEffect(() => {
    if (!pub || afkRemaining !== 0 || pub.toAct < 0 || pub.toAct === mySeat || pub.street === "result") return;
    const afkSeat = pub.toAct;
    const streak = (afkStreakRef.current[afkSeat] || 0) + 1;
    afkStreakRef.current[afkSeat] = streak;
    if (table.host === profile.id) tableCall("kick_check", table.id);
  }, [afkRemaining]); // eslint-disable-line

  useEffect(() => { if (pub) afkStreakRef.current = {}; }, [pub && pub.handNo]); // eslint-disable-line

  async function act(action) {
    if (busy) return;
    setBusy(true);
    haptic(action.type === "raise" ? "medium" : "light");
    await tableCall("act", table.id, { action });
    const { data } = await tableCall("state", table.id);
    if (data.pub) setPub(data.pub);
    setBusy(false);
  }
  async function leave() {
    const handsPlayed = pub ? pub.handNo + 1 : 0;
    await tableCall("leave", table.id);
    let analysis = null;
    if (handsPlayed > 0) {
      try {
        const r = await sbFetch("/functions/v1/score-mp-session", {
          method: "POST",
          body: JSON.stringify({ table_id: table.id }),
        });
        if (r.ok) analysis = await r.json();
      } catch {}
    }
    onLeft(handsPlayed, analysis);
  }
  const stalled = pub && pub.toAct >= 0 && pub.toAct !== mySeat && Date.now() - pub.turnStarted > 62000;

  if (!pub) {
    return (
      <div style={{ padding: "calc(22px + env(safe-area-inset-top)) 18px 80px", height: "100%", overflowY: "auto", textAlign: "center" }}>
        <div className="serif" style={{ fontSize: 24, color: T.card, marginTop: 30 }}>Waiting room</div>
        <div className="mono" style={{ fontSize: 36, color: T.brass, letterSpacing: ".25em", margin: "16px 0 4px" }}>{table.table_code}</div>
        <div style={{ fontSize: 12.5, color: T.mist, marginBottom: 14 }}>Share this code. {table.min_hands > 0 ? `Players need ${table.min_hands}+ lifetime hands.` : "Anyone can join."}</div>
        <button onClick={() => {
          const link = window.location.origin + "/?join=" + table.table_code;
          const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1800); };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done).catch(done);
          else done();
        }} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "1px solid " + T.brass, background: "rgba(201,165,70,.1)", color: T.brass, fontSize: 13, fontWeight: 600, marginBottom: 18 }}>
          {copied ? "Link copied" : "Copy invite link"}
        </button>
        <div style={{ fontSize: 11, color: T.faint, marginBottom: 14, lineHeight: 1.5 }}>Friends who open the link make a quick account, then land right at this table.</div>
        <div style={{ background: T.baize2, border: "1px solid " + T.line, borderRadius: 14, padding: 14, textAlign: "left" }}>
          {(lobby || []).map((s) => (
            <div key={s.seat} style={{ fontSize: 14, color: T.card, padding: "6px 0" }}>♠ {s.name}{table.host === profile.id && s.seat === mySeat ? " (you, host)" : s.seat === mySeat ? " (you)" : ""}</div>
          ))}
          {(lobby || []).length < 2 && <div style={{ fontSize: 12, color: T.faint, padding: "6px 0" }}>Waiting for at least one more player…</div>}
        </div>
        {table.host === profile.id && (
          <Btn kind="primary" disabled={(lobby || []).length < 2 || busy} onClick={async () => { setBusy(true); await tableCall("start", table.id); setBusy(false); }} style={{ width: "100%", marginTop: 16 }}>Deal the first hand</Btn>
        )}
        <Btn kind="danger" onClick={leave} style={{ width: "100%", marginTop: 10 }}>Leave table</Btn>
      </div>
    );
  }
  const result = pub.street === "result";
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "calc(12px + env(safe-area-inset-top)) 12px 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", marginBottom: 6 }}>
        <button onClick={leave} style={{ background: "none", border: "1px solid " + T.line, color: T.mist, borderRadius: 8, padding: "5px 10px", fontSize: 12, justifySelf: "start" }}>Leave</button>
        <span className="mono" style={{ fontSize: 12, color: T.brass, letterSpacing: ".15em" }}>{table.table_code}</span>
        <span className="mono" style={{ fontSize: 12, color: T.faint, justifySelf: "end" }}>#{pub.handNo + 1}</span>
      </div>
      <div style={{ position: "relative", flex: 1, minHeight: 330, margin: "4px 0" }}>
        <div style={{ position: "absolute", inset: "7% 4%", borderRadius: "50%", background: `radial-gradient(ellipse at 50% 38%, ${T.baize2}, ${T.baize} 75%)`, border: `7px solid #2A2017`, boxShadow: `inset 0 0 40px rgba(0,0,0,.55), 0 0 0 2px ${T.brassDim}` }} />
        <div style={{ position: "absolute", left: "50%", top: "44%", transform: "translate(-50%,-50%)", textAlign: "center", zIndex: 4 }}>
          <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
            {[0, 1, 2, 3, 4].map((i) => pub.board[i] ? <PlayingCard key={i} card={pub.board[i]} w={40} deal /> : <div key={i} style={{ width: 40, height: 57, borderRadius: 6, border: "1.5px dashed rgba(201,165,70,.25)" }} />)}
          </div>
          <div className="mono" style={{ marginTop: 8, fontSize: 14, color: T.brass, fontWeight: 600 }}>
            <span style={{ fontSize: 10, color: T.faint, letterSpacing: ".1em" }}>POT </span>{pub.pot.toLocaleString()}
          </div>
        </div>
        {pub.players.map((p) => {
          const slot = ((p.seat - mySeat) % 6 + 6) % 6;
          const withMyCards = p.seat === mySeat ? { ...p, cards: myCards } : p;
          return <MpSeatBox key={p.seat} p={withMyCards} slot={slot} isMe={p.seat === mySeat} toAct={pub.toAct} button={pub.button} winners={pub.winners} showdown={result && !!p.cards} />;
        })}
        {result && (
          <div className="fadeup" style={{ position: "absolute", left: "50%", top: "44%", transform: "translate(-50%,-50%)", background: "rgba(7,16,11,.95)", border: "1.5px solid " + T.brass, borderRadius: 16, padding: "16px 22px", textAlign: "center", zIndex: 20, minWidth: 230 }}>
            {(pub.winners || []).map((w) => (
              <div key={w.idx} style={{ marginBottom: 6 }}>
                <span className="serif" style={{ fontSize: 19, color: T.brass }}>{pub.players[w.idx].name}</span>
                <span className="mono" style={{ color: T.good, marginLeft: 8, fontSize: 15 }}>+{w.amt.toLocaleString()}</span>
                {w.cat && <div style={{ fontSize: 12, color: T.mist, marginTop: 2 }}>{w.cat}</div>}
              </div>
            ))}
            <Btn kind="primary" disabled={busy} onClick={async () => { haptic("light"); setBusy(true); await tableCall("next_hand", table.id); setBusy(false); }} style={{ marginTop: 10, width: "100%" }}>Next hand</Btn>
          </div>
        )}
      </div>
      {myCards && me && !me.folded && <StrengthStrip hero={myCards} board={pub.board} equity={equity} />}
      <div style={{ padding: "10px 0 14px", minHeight: 118 }}>
        {myTurn ? (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
              <Btn kind="ghost" disabled={busy} onClick={() => act({ type: "fold" })} style={{ flex: "0 0 auto", padding: "12px 16px", color: T.faint, fontWeight: 500, fontSize: 14 }}>Fold</Btn>
              <Btn kind="felt" disabled={busy} onClick={() => act(toCall > 0 ? { type: "call" } : { type: "check" })} style={{ flex: 1 }}>
                {toCall > 0 ? <>Call <span className="mono">{Math.min(toCall, me.stack).toLocaleString()}</span></> : "Check"}
              </Btn>
              <Btn kind="primary" disabled={busy || me.stack + me.bet <= pub.currentBet} onClick={() => act({ type: "raise", amount: raiseTo })} style={{ flex: 1.7, fontSize: 16 }}>
                {raiseTo >= maxRaiseTo ? "All-in" : pub.currentBet > 0 ? "Raise to" : "Bet"} <span className="mono">{raiseTo.toLocaleString()}</span>
              </Btn>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
              <input type="range" min={minRaiseTo} max={maxRaiseTo} step={SB} value={raiseTo} onChange={(e) => setRaiseTo(+e.target.value)} aria-label="Raise size" />
              {[{ l: "½", f: 0.5 }, { l: "¾", f: 0.75 }, { l: "Pot", f: 1 }].map((b) => (
                <button key={b.l} onClick={() => setRaiseTo(Math.min(maxRaiseTo, Math.max(minRaiseTo, Math.round((pub.pot * b.f + toCall + me.bet) / SB) * SB)))} className="mono" style={{ background: "none", border: "1px solid " + T.line, color: T.mist, borderRadius: 7, padding: "3px 7px", fontSize: 11 }}>{b.l}</button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", color: T.faint, fontSize: 13, paddingTop: 18 }}>
            {result ? "Hand complete" : pub.toAct >= 0 ? `${pub.players[pub.toAct].name} is thinking…` : "Dealing…"}
            {afkRemaining <= 15 && pub.toAct >= 0 && pub.toAct !== mySeat && pub.street !== "result" && (
              <div style={{ fontSize: 12, color: afkRemaining <= 5 ? T.bad : T.brass, marginTop: 8 }}>
                Auto-fold in {afkRemaining}s{afkStreakRef.current[pub.toAct] >= 1 ? " · 2nd miss = kick" : ""}
              </div>
            )}
            {stalled && (
              <div style={{ marginTop: 10 }}>
                <Btn kind="felt" onClick={() => tableCall("kick_check", table.id)} style={{ fontSize: 12, padding: "8px 14px" }}>Skip stalled player</Btn>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
function MpReviewScreen({ tableId, session, rating, band, go, openModule, openReplay }) {
  // If the score-mp-session pipeline produced a full analysis, render it exactly
  // like the solo ReviewScreen (identical layout, leaks, plan, replay buttons).
  if (session) {
    return <ReviewScreen session={session} rating={rating} band={band} go={go} openModule={openModule} openReplay={openReplay} />;
  }

  // Fallback: table-review legacy display (older sessions or function unavailable)
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  useEffect(() => {
    (async () => {
      try {
        const r = await sbFetch("/functions/v1/table-review", { method: "POST", body: JSON.stringify({ table_id: tableId }) });
        if (r.ok) { setData(await r.json()); setState("done"); } else setState("error");
      } catch { setState("error"); }
    })();
  }, [tableId]); // eslint-disable-line
  return (
    <div style={{ padding: "calc(24px + env(safe-area-inset-top)) 18px 80px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="serif" style={{ fontSize: 27, color: T.card }}>The hand back</div>
        <button onClick={() => go("home")} style={{ background: "none", border: "none", color: T.brass, fontSize: 13 }}>Done</button>
      </div>
      <div style={{ fontSize: 12.5, color: T.mist, marginTop: 6, lineHeight: 1.5 }}>
        Your bets and bluffs, scored against how these specific players actually play. Their stats stay private, only the verdicts reach you.
      </div>
      {state === "loading" && <div style={{ color: T.faint, fontSize: 13, marginTop: 24, textAlign: "center" }}>Scoring your decisions…</div>}
      {state === "error" && <div style={{ color: T.bad, fontSize: 13, marginTop: 24 }}>Couldn't load the review.</div>}
      {data && data.summary && (
        <div style={{ background: T.baize2, border: "1px solid " + T.line, borderRadius: 14, padding: 18, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "stretch" }}>
            <StatChip label="BB earned" value={(data.summary.netAdjBB >= 0 ? "+" : "") + data.summary.netAdjBB} accent={data.summary.netAdjBB >= 0 ? T.good : T.bad} />
            <div style={{ width: 1, background: T.line, margin: "4px 0" }} />
            <StatChip label="Decisions" value={data.summary.scored} accent={T.brass} />
            <div style={{ width: 1, background: T.line, margin: "4px 0" }} />
            <StatChip label="Hands" value={data.summary.hands} accent={T.mist} />
          </div>
        </div>
      )}
      {data && data.decisions && data.decisions.length === 0 && state === "done" && (
        <div style={{ color: T.faint, fontSize: 13, marginTop: 24, background: T.baize2, borderRadius: 14, padding: 16, border: "1px dashed " + T.line }}>
          No bets or raises to score this time, play a few more hands and take some stabs.
        </div>
      )}
      {data && (data.decisions || []).map((d, i) => (
        <div key={i} style={{ background: T.baize2, border: "1px solid " + T.line, borderLeft: `4px solid ${d.verdict === "good" ? T.good : d.verdict === "fine" ? T.brass : T.bad}`, borderRadius: 14, padding: 14, marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13.5, color: T.card, fontWeight: 600 }}>Hand #{d.hand_no + 1} · {d.kind} on the {d.street}</span>
            <span className="mono" style={{ fontSize: 12.5, color: d.evBB >= 0 ? T.good : T.bad }}>{d.evBB >= 0 ? "+" : ""}{d.evBB} bb</span>
          </div>
          <div style={{ fontSize: 12.5, color: T.mist, marginTop: 6, lineHeight: 1.5 }}>{d.line}</div>
          <div style={{ fontSize: 10.5, color: T.faint, marginTop: 6 }}>{d.confidence}</div>
        </div>
      ))}
    </div>
  );
}

/* ============================ FEEDBACK (always reachable) ============================ */
/* ---------- Hand rankings reference sheet (slide-up) ---------- */
const HAND_RANKS = [
  { name: "Royal Flush", cards: [[14,0],[13,0],[12,0],[11,0],[10,0]], note: "A to 10, all one suit. The best hand there is." },
  { name: "Straight Flush", cards: [[9,1],[8,1],[7,1],[6,1],[5,1]], note: "Five in a row, all one suit." },
  { name: "Four of a Kind", cards: [[8,0],[8,1],[8,2],[8,3],[2,0]], note: "All four of the same rank." },
  { name: "Full House", cards: [[11,0],[11,1],[11,2],[4,0],[4,1]], note: "Three of one rank, two of another." },
  { name: "Flush", cards: [[14,2],[10,2],[8,2],[5,2],[3,2]], note: "Five of the same suit, any order." },
  { name: "Straight", cards: [[9,0],[8,1],[7,2],[6,3],[5,0]], note: "Five in a row, mixed suits." },
  { name: "Three of a Kind", cards: [[12,0],[12,1],[12,2],[7,3],[2,0]], note: "Three of the same rank." },
  { name: "Two Pair", cards: [[13,0],[13,1],[6,2],[6,3],[9,0]], note: "Two pairs in one hand." },
  { name: "One Pair", cards: [[10,0],[10,1],[14,2],[7,3],[3,0]], note: "Two cards of the same rank." },
  { name: "High Card", cards: [[14,0],[11,1],[8,2],[6,3],[2,0]], note: "Nothing else. Your highest card plays." },
];
function MiniCard({ r, s }) {
  const red = SUIT_RED[s];
  return (
    <div className="mono" style={{ width: 22, height: 30, borderRadius: 4, background: T.card, color: red ? T.cordovan : T.ink, border: "1px solid rgba(0,0,0,.25)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1, fontSize: 10, fontWeight: 600 }}>
      <span>{rankLabel(r)}</span><span style={{ fontSize: 9 }}>{SUIT_GLYPH[s]}</span>
    </div>
  );
}
function HandRankSheet({ onClose }) {
  return (
    <div onClick={onClose} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: "58px", zIndex: 28, background: "rgba(4,8,6,.6)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} className="fadeup gp" style={{ background: "rgba(8,22,14,0.88)", borderTop: `1px solid ${T.brass}`, borderRadius: "18px 18px 0 0", maxHeight: "100%", overflowY: "auto", padding: "20px 18px 24px", maxWidth: 440, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <div className="serif" style={{ fontSize: 23, color: T.card }}>Hand rankings</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.brass, fontSize: 13 }}>Close</button>
        </div>
        <div style={{ fontSize: 12, color: T.faint, marginBottom: 14 }}>Strongest at the top. Whoever makes the highest hand wins the pot.</div>
        {HAND_RANKS.map((hr, i) => (
          <div key={hr.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < HAND_RANKS.length - 1 ? `1px solid ${T.line}` : "none" }}>
            <span className="mono" style={{ fontSize: 12, color: T.brass, width: 18, flex: "0 0 auto", textAlign: "right" }}>{i + 1}</span>
            <div style={{ display: "flex", gap: 3, flex: "0 0 auto" }}>{hr.cards.map(([r, s], k) => <MiniCard key={k} r={r} s={s} />)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: T.card, fontWeight: 600 }}>{hr.name}</div>
              <div style={{ fontSize: 10.5, color: T.mist, marginTop: 1, lineHeight: 1.35 }}>{hr.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
// Small top-right trigger that opens the hand-rankings sheet.
function HandRankButton({ onOpen }) {
  return (
    <button onClick={onOpen} aria-label="Poker hand rankings" style={{ position: "absolute", top: "calc(14px + env(safe-area-inset-top))", right: 16, zIndex: 25, width: 34, height: 34, borderRadius: 9, background: "rgba(18,49,39,.9)", border: `1px solid ${T.line}`, color: T.brass, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}>♠</button>
  );
}
// Grid icon trigger for the opening-ranges sheet, sits to the left of the hand-rankings icon.
function RangeButton({ onOpen }) {
  return (
    <button onClick={onOpen} aria-label="Opening ranges" style={{ position: "absolute", top: "calc(14px + env(safe-area-inset-top))", right: 58, zIndex: 25, width: 34, height: 34, borderRadius: 9, background: "rgba(18,49,39,.9)", border: `1px solid ${T.line}`, color: T.brass, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}>
      <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true"><g fill="currentColor">{[0,1,2].map((r)=>[0,1,2].map((c)=>(<rect key={r+"-"+c} x={c*5.5} y={r*5.5} width="4" height="4" rx="1" opacity={r===c?1:0.55} />)))}</g></svg>
    </button>
  );
}
// What each position means, in plain language, shown when a seat is selected.
const POS_EXPLAIN = {
  UTG: { full: "Under the gun", text: "First to act before the flop. Everyone gets to respond to you, so you open only your strongest hands." },
  HJ: { full: "Hijack", text: "Two seats from the button. A few players still act after you, so you can open a bit wider than early seats." },
  CO: { full: "Cutoff", text: "One seat right of the button. Only two players left to act, so you steal more pots and open wider." },
  BTN: { full: "Button", text: "The best seat. You act last on every street after the flop, so you open the widest range of all." },
  SB: { full: "Small blind", text: "You already have chips in, but you act first on every street after the flop. Out of position, so play tighter than the button." },
};
function RangeSheet({ onClose }) {
  const [pos, setPos] = useState("BTN");
  const ex = POS_EXPLAIN[pos];
  return (
    <div onClick={onClose} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: "58px", zIndex: 28, background: "rgba(4,8,6,.6)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} className="fadeup gp" style={{ background: "rgba(8,22,14,0.88)", borderTop: `1px solid ${T.brass}`, borderRadius: "18px 18px 0 0", maxHeight: "100%", overflowY: "auto", padding: "20px 18px 24px", maxWidth: 440, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <div className="serif" style={{ fontSize: 23, color: T.card }}>Opening ranges</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.brass, fontSize: 13 }}>Close</button>
        </div>
        <div style={{ fontSize: 12, color: T.faint, marginBottom: 14 }}>Which hands to raise with first, by seat. Tap a seat to see why.</div>
        <RangeGrid pos={pos} />
        <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
          {["UTG", "HJ", "CO", "BTN", "SB"].map((p) => (
            <button key={p} onClick={() => setPos(p)} className="mono" style={{ flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 11, border: "1px solid " + (p === pos ? T.brass : T.line), background: p === pos ? "rgba(201,165,70,.12)" : "transparent", color: p === pos ? T.brass : T.mist }}>{p}</button>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: "13px 15px", borderRadius: 12, background: T.baize2, border: `1px solid ${T.line}` }}>
          <div className="serif" style={{ fontSize: 16, color: T.card }}>{ex.full} <span className="mono" style={{ fontSize: 11, color: T.brass, marginLeft: 4 }}>{pos}</span></div>
          <div style={{ fontSize: 12.5, color: T.mist, marginTop: 5, lineHeight: 1.5 }}>{ex.text}</div>
        </div>
        <div style={{ fontSize: 11, color: T.faint, marginTop: 12, lineHeight: 1.5 }}>The later you act, the more hands you can profitably open. This is one of the biggest edges in poker.</div>
      </div>
    </div>
  );
}

/* ---------- New-player intro: tap-through basics + Edge explainer ---------- */
const INTRO_SLIDES = [
  {
    title: "Welcome to the table",
    glyph: "♠",
    body: "Poker is a game of decisions, not luck. You will not learn every rule today, just enough to sit down and start. The rest you pick up by playing.",
  },
  {
    title: "The goal of a hand",
    glyph: "♥",
    body: "Each hand, you are trying to win the pot, the pile of chips in the middle. You win it either by having the best five-card hand at the end, or by betting in a way that makes everyone else fold.",
  },
  {
    title: "How betting works",
    glyph: "♦",
    body: "On your turn you can check (pass), call (match the bet), raise (put in more), or fold (give up the hand). Strong hands and smart pressure win chips. Weak hands you let go cheaply.",
    cards: true,
  },
  {
    title: "What beats what",
    glyph: "♣",
    body: "A pair beats a high card, three of a kind beats a pair, and so on up to the rare flushes and straights. You can open the full ranking any time from the spade icon in the top corner.",
    ranks: true,
  },
  {
    title: "Position matters",
    glyph: "♠",
    body: "Acting later in a hand is an advantage, you get to see what everyone does before you decide. Hands played from the button (last to act) are worth more than the same hand played first.",
  },
  {
    title: "Meet Edge, your rating",
    glyph: "◆",
    body: "Edge measures the quality of your decisions, not whether you won or lost a given hand. Make good choices and it climbs, even on unlucky nights. Think of it like a chess rating for poker. A beginner starts around 1000 and a strong player sits past 1500.",
    edge: true,
  },
];
function IntroSlides({ onDone }) {
  const [i, setI] = useState(0);
  const s = INTRO_SLIDES[i];
  const last = i === INTRO_SLIDES.length - 1;
  const red = s.glyph === "♥" || s.glyph === "♦";
  return (
    <div className="fadeup" key={i} style={{ height: "100%", display: "flex", flexDirection: "column", padding: "28px 26px calc(28px + env(safe-area-inset-bottom))", boxSizing: "border-box" }}>
      {/* progress dots */}
      <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
        {INTRO_SLIDES.map((_, k) => (
          <div key={k} style={{ flex: 1, height: 3, borderRadius: 2, background: k <= i ? T.brass : T.line, transition: "background .3s" }} />
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div className="serif" style={{ fontSize: 64, color: red ? T.cordovan : T.brass, lineHeight: 1 }}>{s.glyph}</div>
        <div className="serif" style={{ fontSize: 30, color: T.card, margin: "18px 0 14px", lineHeight: 1.1 }}>{s.title}</div>
        <div style={{ fontSize: 15.5, color: "#D8E2DA", lineHeight: 1.6 }}>{s.body}</div>

        {/* slide-specific visuals */}
        {s.cards && (
          <div style={{ display: "flex", gap: 8, marginTop: 22, flexWrap: "wrap" }}>
            {[["check", T.mist], ["call", T.card], ["raise", T.brass], ["fold", T.faint]].map(([w, c]) => (
              <span key={w} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 9, border: `1px solid ${T.line}`, color: c, textTransform: "capitalize" }}>{w}</span>
            ))}
          </div>
        )}
        {s.ranks && (
          <div style={{ display: "flex", gap: 4, marginTop: 22 }}>
            <MiniCard r={14} s={0} /><MiniCard r={14} s={1} />
            <span style={{ alignSelf: "center", color: T.faint, fontSize: 12, margin: "0 6px" }}>beats</span>
            <MiniCard r={13} s={0} /><MiniCard r={12} s={1} />
          </div>
        )}
        {s.edge && (
          <div style={{ marginTop: 22, padding: "14px 16px", borderRadius: 12, background: "rgba(201,165,70,.08)", border: `1px solid ${T.line}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 11, color: T.faint, textTransform: "uppercase", letterSpacing: ".1em" }}>Your Edge</span>
              <span className="mono" style={{ fontSize: 12, color: T.good }}>▲ climbing</span>
            </div>
            <div className="serif" style={{ fontSize: 32, color: T.brass, marginTop: 2 }}>1000</div>
          </div>
        )}
      </div>

      <Btn kind="primary" onClick={() => (last ? onDone() : setI(i + 1))} style={{ width: "100%", padding: "16px", fontSize: 16, marginTop: 24 }}>
        {last ? "Take my seat" : "Next"}
      </Btn>
      {!last && <button onClick={onDone} style={{ background: "none", border: "none", color: T.faint, fontSize: 12.5, marginTop: 12 }}>Skip intro</button>}
    </div>
  );
}
function FeedbackWidget({ screen, profile, rating }) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState("Bug");
  const [msg, setMsg] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  async function send() {
    if (!msg.trim() || state === "sending") return;
    setState("sending");
    const payload = { screen, category: cat, message: msg.trim(), app_context: { rating: Math.round(rating || 0), at: new Date().toISOString() } };
    if (profile && profile.id) payload.user_id = profile.id;
    const rows = await dbInsert("feedback", payload);
    if (rows) {
      setState("sent"); setMsg("");
      setTimeout(() => { setOpen(false); setState("idle"); }, 1400);
    } else setState("error");
  }
  if (!profile) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Send feedback" style={{ position: "absolute", right: -1, top: "38%", zIndex: 60, background: "rgba(18,49,39,.92)", border: "1px solid " + T.line, borderRight: "none", borderRadius: "10px 0 0 10px", color: T.brass, padding: "10px 6px", fontSize: 12, writingMode: "vertical-rl", letterSpacing: ".12em", opacity: 0.85 }}>
        FEEDBACK
      </button>
      {open && (
        <div style={{ position: "absolute", inset: 0, zIndex: 70, background: "rgba(4,10,7,.7)", display: "flex", alignItems: "flex-end" }} onClick={() => state !== "sending" && setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="fadeup" style={{ width: "100%", background: "#0E2018", borderTop: "1px solid " + T.line, borderRadius: "18px 18px 0 0", padding: "18px 18px 26px" }}>
            {state === "sent" ? (
              <div style={{ textAlign: "center", padding: "18px 0" }}>
                <div className="serif" style={{ fontSize: 20, color: T.good }}>Got it, thank you.</div>
                <div style={{ fontSize: 12.5, color: T.mist, marginTop: 4 }}>Every note makes the table better.</div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div className="serif" style={{ fontSize: 19, color: T.card }}>What's on your mind?</div>
                  <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: T.faint, fontSize: 13 }}>Close</button>
                </div>
                <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
                  {["Bug", "Idea", "Confusing"].map((c) => (
                    <button key={c} onClick={() => setCat(c)} style={{ flex: 1, padding: "8px", borderRadius: 10, border: "1px solid " + (cat === c ? T.brass : T.line), background: cat === c ? "rgba(201,165,70,.12)" : "transparent", color: cat === c ? T.brass : T.mist, fontSize: 13, fontWeight: 600 }}>{c}</button>
                  ))}
                </div>
                <div style={{ fontSize: 10.5, color: T.faint, marginBottom: 7, lineHeight: 1.5 }}>Please do not include personal information (like your full name or email) in your message.</div>
                <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} placeholder={cat === "Bug" ? "What broke, and what were you doing?" : cat === "Idea" ? "What would make this better?" : "What didn't make sense?"} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid " + T.line, background: T.baize2, color: T.card, fontSize: 14, fontFamily: "inherit", resize: "none" }} />
                <div style={{ fontSize: 10.5, color: T.faint, margin: "6px 0 10px" }}>Sent with your username and current screen ({screen}) so it's easy to act on.</div>
                {state === "error" && <div style={{ color: T.bad, fontSize: 12.5, marginBottom: 8 }}>Couldn't send, run upgrade6.sql in Supabase if this keeps happening.</div>}
                <Btn kind="primary" disabled={!msg.trim() || state === "sending"} onClick={send} style={{ width: "100%" }}>{state === "sending" ? "Sending…" : "Send feedback"}</Btn>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ============================ LOG SCREEN ============================ */
const ACTION_EXPLAIN = {
  fold: {
    preflop: { msg: "You folded a hand that was profitable to continue with.", fix: "When the pot is offering a good price and you have live cards, folding is costing you money.", module: "range-1" },
    flop:   { msg: "You folded on the flop when the pot was offering a profitable price to continue.", fix: "When the bet is small relative to the pot, a weak but live hand is often worth a call.", module: "range-1" },
    turn:   { msg: "You folded on the turn when continuing was the better play.", fix: "Check the pot odds: if what you need to call is less than your equity × the pot, call.", module: "range-1" },
    river:  { msg: "You folded on the river and gave up a winning call.", fix: "On the river, if the bet is small and you can beat some bluffs, lean toward calling.", module: "range-1" },
  },
  call: {
    preflop: { msg: "You called before the flop with a hand that didn't justify the price.", fix: "Against raises, stick to hands you'd happily re-raise — pairs, big aces, strong connectors.", module: "pre-1" },
    flop:    { msg: "You called on the flop without enough equity to justify it.", fix: "Quick math: if you need to call more than your win% × pot, it's a fold.", module: "size-1" },
    turn:    { msg: "You paid too much to chase on the turn.", fix: "Each street gets more expensive — make sure your hand has real outs or solid equity.", module: "size-1" },
    river:   { msg: "You called on the river without the odds to support it.", fix: "On the river there are no more cards; the decision is purely about pot odds vs. your hand strength.", module: "size-1" },
  },
  check: {
    flop:  { msg: "You checked a strong hand on the flop and gave a free card.", fix: "When you have the best hand, bet it — roughly half the pot builds value.", module: "post-1" },
    turn:  { msg: "You checked a strong hand on the turn, costing yourself value.", fix: "On the turn the pot is bigger; a bet here is almost always right with a strong hand.", module: "post-1" },
    river: { msg: "You checked the river with a hand strong enough to bet for value.", fix: "The river is your last chance to get paid — a bet of 40–60% pot is right.", module: "post-1" },
  },
  raise: {
    preflop: { msg: "You raised before the flop with a hand not strong enough to justify it.", fix: "Re-raises should be reserved for your best hands — fold the borderline ones.", module: "pre-2" },
    flop:    { msg: "You raised on the flop as a bluff without enough equity to back it up.", fix: "Bluffs need a plan: a real draw, or a board you're credibly representing.", module: "bluff-1" },
    turn:    { msg: "You raised on the turn as a bluff with very little equity.", fix: "Turn bluffs are expensive — only push when you have a draw or real fold equity.", module: "bluff-1" },
    river:   { msg: "You raised on the river as a bluff without enough fold equity.", fix: "River bluffs only work against specific opponents. Against callers, give it up.", module: "bluff-1" },
  },
};

/* Multiple plain-language variants per mistake type, indexed by hand number so
   the same mistake in different hands shows a different sentence. */
const MISTAKE_VARIANTS = {
  fold_preflop: [
    "Folded before the flop when the hand was strong enough to play.",
    "That fold cost chips — the cards deserved a raise, not a muck.",
    "Tossed a playable hand. From that seat, this one gets raised.",
    "Let go too early. Strong hands before the flop open the pot, they don't fold to it.",
  ],
  fold_flop: [
    "Gave up on the flop when the price to continue was still reasonable.",
    "Folded too cheaply on the flop — the bet wasn't big enough to justify it.",
    "Let them take the pot without a fight. Worth a call here.",
    "Flop fold when sticking around was the right call. Check what they bet vs the pot.",
  ],
  fold_turn: [
    "Folded the turn with enough hand left to keep going.",
    "Gave up mid-hand when a call was still correct.",
    "Turn fold when continuing was the better move. The pot was offering a decent price.",
    "Let go on the turn — the bet wasn't large enough to make folding right.",
  ],
  fold_river: [
    "Folded the river when the price was small enough to call.",
    "Let go at the end — small river bets are often bluffs worth paying off.",
    "River fold that likely gave away a pot. When the bet is tiny, calling is usually right.",
    "Gave up the river too cheap. That's the exact spot to hang in there.",
  ],
  call_preflop: [
    "Called before the flop with a hand that wasn't worth the price.",
    "Came in with a weak holding — raise the strong ones, fold the rest.",
    "Preflop call that went in with too little to back it up.",
    "That call was with a hand better suited to folding here.",
  ],
  call_flop: [
    "Called on the flop when the math said fold.",
    "Paid to chase on the flop — the hand wasn't worth the price of the bet.",
    "Flop call without enough equity. The bet was asking for more than the hand was worth.",
    "Called the flop with a hand that didn't justify continuing.",
  ],
  call_turn: [
    "Chased on the turn — the price was higher than the hand's chances of winning.",
    "Kept going when folding saves more chips. Fewer cards left, higher cost.",
    "Called the turn without enough equity. Getting expensive to chase at this point.",
    "Turn call that cost more than it should. The hand needed to be stronger to justify it.",
  ],
  call_river: [
    "Called the river without the hand to beat a real bet.",
    "Paid off at the end — worth asking what they'd bet here that you actually beat.",
    "River call without the right odds. Last street calls need a strong hand or a great price.",
    "Called the end when folding was cheaper. River bets usually mean business.",
  ],
  check_flop: [
    "Checked the flop with a strong hand and gave a free card.",
    "Missed a bet — big hands build pots, they don't give free looks.",
    "Let them see the turn for free when you had the best of it.",
    "Strong flop hand, no bet. That's chips left on the table.",
  ],
  check_turn: [
    "Checked the turn with a hand worth betting. Free cards cost money.",
    "Missed the turn bet — strong hands charge, they don't invite free cards.",
    "Checked when a bet protects the hand and builds the pot at the same time.",
    "Turn check with a strong holding. The time to bet is when you have it.",
  ],
  check_river: [
    "Checked the river and left money behind. Last chance to get paid.",
    "Missed the river bet — strong hands deserve a price tag at the end.",
    "Let them off free at the end. A bet here gets called by worse hands.",
    "Checked the river when a bet wins more. That's a missed opportunity.",
  ],
  raise_preflop: [
    "Re-raised before the flop with a hand that didn't quite earn it.",
    "Built a big pot with a medium hand. Re-raises should come with strong holdings.",
    "That preflop re-raise put a lot in the middle with not enough to back it up.",
    "Raised over a raise when calling or folding was the better play.",
  ],
  raise_flop: [
    "Raised as a bluff on the flop without anything to fall back on.",
    "Flop raise without a real hand or a draw. Bluffs need something behind them.",
    "Pushed on the flop without the cards or the draw to support it.",
    "Bluffed the flop — a good move sometimes, but not with this hand.",
  ],
  raise_turn: [
    "Bluffed the turn with a hand unlikely to get folds.",
    "Pushed on the turn without enough equity. Turn bluffs are expensive.",
    "Raised the turn without the hand to back it up.",
    "Turn aggression without the goods. Hard to get folds this deep in the hand.",
  ],
  raise_river: [
    "Bluffed the river when giving up was the better play.",
    "River bluff without a real reason to think they'd fold.",
    "Raised at the end without the hand for it — usually better to check.",
    "Pushed the river as a bluff. River bluffs are the hardest to pull off.",
  ],
};

const CLEAN_VARIANTS = {
  fold_preflop: [
    "Good laydown — saved the chips for a better spot.",
    "Right call to fold. Not every hand is worth playing.",
    "Clean fold before the flop. Discipline here is underrated.",
    "Folded the hands worth folding. That's how you stay ahead over time.",
  ],
  won_aggressive: [
    "Raised in the right spot and took the pot. Well done.",
    "Good aggression — put them in a tough spot and it paid off.",
    "Bet when it mattered and got rewarded. That's the right instinct.",
    "Well-timed pressure. That's exactly how pots get won.",
  ],
  won_call: [
    "Made the right call and it paid off.",
    "Held your ground in the right spot.",
    "Good read — called correctly and got the result.",
    "Stuck around for the right price and it worked out.",
  ],
  won_passive: [
    "Let the hand play out the right way and took the chips.",
    "Solid play — patient and correct.",
    "Let them make the mistake. Good discipline.",
    "Played it patient and came out ahead.",
  ],
  lost_correctly: [
    "Played it right but the cards didn't cooperate. That happens.",
    "Correct decision, rough result. Right plays don't always win the hand.",
    "Good poker, bad luck. Keep making those calls.",
    "Made the right move and ran into a better hand. Nothing wrong here.",
  ],
  minor_mistake: [
    "Nearly clean — one small thing, but the main decisions were right.",
    "Close to textbook. A minor detail, the instincts were solid.",
    "Mostly right. One small tweak but the big calls were correct.",
    "Good hand overall. One small thing to keep in mind.",
  ],
};

function handFeedback(hand) {
  const actions = hand.actions || [];
  const mistakes = actions.filter((a) => a.is_optimal === false);
  const net = hand.result_chips || 0;
  const n = hand.hand_number || 0;
  const pick = (arr) => arr[n % arr.length];

  if (mistakes.length === 0) {
    const hasRaise = actions.some((a) => a.action_type === "raise");
    const hasCall = actions.some((a) => a.action_type === "call");
    const onlyPreflop = actions.length > 0 && actions.every((a) => a.street === "preflop");
    const foldedPreflop = onlyPreflop && actions.some((a) => a.action_type === "fold");
    if (foldedPreflop) return { msg: pick(CLEAN_VARIANTS.fold_preflop), color: T.good, module: null };
    if (net > 0 && hasRaise) return { msg: pick(CLEAN_VARIANTS.won_aggressive), color: T.good, module: null };
    if (net > 0 && hasCall) return { msg: pick(CLEAN_VARIANTS.won_call), color: T.good, module: null };
    if (net > 0) return { msg: pick(CLEAN_VARIANTS.won_passive), color: T.good, module: null };
    if (net < 0) return { msg: pick(CLEAN_VARIANTS.lost_correctly), color: T.mist, module: null };
    return { msg: "Played it clean.", color: T.good, module: null };
  }

  const worst = [...mistakes].sort((a, b) => (b.ev_loss || 0) - (a.ev_loss || 0))[0];
  const totalEvLoss = mistakes.reduce((s, m) => s + (m.ev_loss || 0), 0);

  // Very minor mistake — treat as near-clean
  if (totalEvLoss < 0.35) return { msg: pick(CLEAN_VARIANTS.minor_mistake), color: T.mist, module: null };

  const key = `${worst.action_type}_${worst.street}`;
  const variants = MISTAKE_VARIANTS[key];
  const ex = (ACTION_EXPLAIN[worst.action_type] || {})[worst.street];
  const module = ex ? ex.module : null;
  const msg = variants ? pick(variants) : `${worst.action_type} on the ${worst.street} was the wrong move here.`;
  return { msg, color: T.bad, module };
}

function HandDetailSheet({ hand, openModule, onClose }) {
  const mistakes = (hand.actions || []).filter((a) => a.is_optimal === false).sort((a, b) => (b.ev_loss || 0) - (a.ev_loss || 0));
  const topModule = (() => {
    const ex = mistakes[0] ? (ACTION_EXPLAIN[mistakes[0].action_type] || {})[mistakes[0].street] : null;
    return ex ? ex.module : null;
  })();
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div className="serif" style={{ fontSize: 20, color: T.card }}>Hand #{(hand.hand_number || 0) + 1}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.brass, fontSize: 13 }}>Close</button>
      </div>
      <div style={{ display: "flex", gap: 5, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {(hand.hero_cards || []).map((c, i) => <PlayingCard key={i} card={c} w={38} />)}
        {(hand.board_cards || []).length > 0 && <span style={{ color: T.faint, margin: "0 6px", fontSize: 12 }}>vs board</span>}
        {(hand.board_cards || []).map((c, i) => <PlayingCard key={i} card={c} w={28} />)}
      </div>
      {mistakes.map((m, i) => {
        const ex = (ACTION_EXPLAIN[m.action_type] || {})[m.street];
        return (
          <div key={i} style={{ marginBottom: 10, padding: "12px 14px", borderRadius: 11, background: "rgba(224,113,107,.07)", border: "1px solid rgba(224,113,107,.25)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 5 }}>
              <span className="mono" style={{ fontSize: 10, color: T.bad, textTransform: "uppercase", letterSpacing: ".1em" }}>{m.action_type} on {m.street}</span>
              {m.ev_loss > 0 && <span className="mono" style={{ fontSize: 10, color: T.bad }}>−{Number(m.ev_loss).toFixed(1)} bb</span>}
            </div>
            {ex ? (
              <>
                <div style={{ fontSize: 13, color: "#D8E2DA", lineHeight: 1.55 }}>{ex.msg}</div>
                <div style={{ fontSize: 12.5, color: T.mist, lineHeight: 1.5, marginTop: 6, paddingLeft: 10, borderLeft: `2px solid ${T.brass}` }}>
                  <b style={{ color: T.brass }}>Fix:</b> {ex.fix}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: T.mist, lineHeight: 1.55 }}>This decision cost an estimated {Number(m.ev_loss || 0).toFixed(1)} bb in expected value.</div>
            )}
          </div>
        );
      })}
      {topModule && MODULE_INDEX[topModule] && (
        <Btn kind="felt" onClick={() => { openModule(topModule); onClose(); }} style={{ width: "100%", marginTop: 4 }}>
          Drill this → {MODULE_INDEX[topModule].title}
        </Btn>
      )}
    </>
  );
}

/* Chip trajectory SVG — no axes, just the story of the session */
function ChipTrajectory({ hands }) {
  if (!hands || hands.length < 2) return null;
  const cumulative = [];
  let running = 0;
  hands.forEach((h) => { running += h.result_chips || 0; cumulative.push(running); });

  const W = 300, H = 60;
  const minV = Math.min(0, ...cumulative), maxV = Math.max(0, ...cumulative);
  const range = maxV - minV || 1;
  const xOf = (i) => (i / (cumulative.length - 1)) * W;
  const yOf = (v) => H - ((v - minV) / range) * (H - 4) - 2;
  const zeroY = yOf(0);
  const pts = cumulative.map((v, i) => `${xOf(i)},${yOf(v)}`).join(" ");

  const peakIdx = cumulative.indexOf(Math.max(...cumulative));
  const valleyIdx = cumulative.indexOf(Math.min(...cumulative));
  const peakVal = cumulative[peakIdx];
  const valleyVal = cumulative[valleyIdx];
  const finalNet = cumulative[cumulative.length - 1];
  const lineColor = finalNet >= 0 ? T.good : T.bad;

  // One-sentence story based on trajectory shape
  const midpoint = Math.floor(cumulative.length / 2);
  const firstHalfPeak = peakIdx < midpoint;
  const firstHalfValley = valleyIdx < midpoint;
  let story = null;
  if (peakVal > 100 && firstHalfPeak && finalNet < peakVal * 0.5)
    story = `You built a lead early but gave most of it back — the flagged hands show where it slipped away.`;
  else if (valleyVal < -100 && firstHalfValley && finalNet > valleyVal * 0.5)
    story = `Rough start, but you clawed back — the hands you recovered on are worth studying too.`;
  else if (finalNet > 200)
    story = `A solid session. Keep the same approach and the chips keep coming.`;
  else if (finalNet < -200)
    story = `A losing session — the flagged hands below show the specific moments that cost the most.`;
  else
    story = `A tight session, close to even. Small adjustments on the flagged hands could flip it.`;

  return (
    <div style={{ marginBottom: 14 }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block", height: 64, borderRadius: 6 }}>
        <defs>
          <linearGradient id="chipGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {/* Zero baseline */}
        <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="rgba(201,165,70,.25)" strokeWidth="1" strokeDasharray="4,4" vectorEffect="non-scaling-stroke" />
        {/* Fill under curve */}
        <polygon points={`${xOf(0)},${zeroY} ${pts} ${xOf(cumulative.length - 1)},${zeroY}`} fill="url(#chipGrad)" />
        {/* Main line */}
        <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {/* Peak dot */}
        {peakVal > 80 && <circle cx={xOf(peakIdx)} cy={yOf(peakVal)} r="3.5" fill={T.good} vectorEffect="non-scaling-stroke" />}
        {/* Valley dot */}
        {valleyVal < -80 && <circle cx={xOf(valleyIdx)} cy={yOf(valleyVal)} r="3.5" fill={T.bad} vectorEffect="non-scaling-stroke" />}
      </svg>
      {/* Peak / valley callouts */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
        {peakVal > 80 && <span style={{ fontSize: 10, color: T.good }}>▲ +{peakVal} hand {peakIdx + 1}</span>}
        {valleyVal < -80 && <span style={{ fontSize: 10, color: T.bad, marginLeft: "auto" }}>▼ {valleyVal} hand {valleyIdx + 1}</span>}
      </div>
      {/* Coaching sentence */}
      <div style={{ fontSize: 12.5, color: T.mist, lineHeight: 1.55, marginTop: 8, fontStyle: "italic" }}>{story}</div>
    </div>
  );
}

function LogScreen({ profile, go, openModule }) {
  const [sessions, setSessions] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [handsMap, setHandsMap] = useState({});
  const [selectedHand, setSelectedHand] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // "all" | "win" | "loss"

  useEffect(() => {
    const jump = localStorage.getItem("riq_log_jump");
    if (jump) {
      localStorage.removeItem("riq_log_jump");
      const d = new Date(jump + "T12:00:00");
      setQuery(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const rows = await dbSelect("sessions", `user_id=eq.${profile.id}&hands_played=gt.0&select=id,started_at,ended_at,hands_played,net_chips,name,analysis_json&order=started_at.desc&limit=60`);
      setSessions(rows || []);
    })();
  }, [profile && profile.id]); // eslint-disable-line

  async function expandSession(sess) {
    if (expandedId === sess.id) { setExpandedId(null); return; }
    setExpandedId(sess.id);
    if (handsMap[sess.id] !== undefined && handsMap[sess.id] !== null) return;
    const q = `session_id=eq.${sess.id}&select=id,hand_number,hero_cards,board_cards,result_chips,street_reached,actions(street,action_type,is_optimal,ev_loss)&order=hand_number.asc`;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
      const rows = await dbSelect("hands", q);
      if (rows && rows.length > 0) { setHandsMap((m) => ({ ...m, [sess.id]: rows })); return; }
    }
    setHandsMap((m) => ({ ...m, [sess.id]: null }));
  }

  async function saveSessionName(id, name) {
    const trimmed = name.trim();
    await dbUpdate("sessions", `id=eq.${id}`, { name: trimmed || null });
    setSessions((ss) => ss.map((s) => s.id === id ? { ...s, name: trimmed || null } : s));
    setRenamingId(null);
  }

  const fmtDate = (iso) => { const d = new Date(iso); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
  const total = (sessions || []).length;

  const filtered = (sessions || []).filter((sess, idx) => {
    const net = sess.net_chips || 0;
    if (filter === "win" && net <= 0) return false;
    if (filter === "loss" && net >= 0) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const name = (sess.name || `session #${total - idx} · ${fmtDate(sess.started_at)}`).toLowerCase();
    const leak = sess.analysis_json && sess.analysis_json.leaks && sess.analysis_json.leaks[0] ? sess.analysis_json.leaks[0].title.toLowerCase() : "";
    return name.includes(q) || leak.includes(q);
  });

  return (
    <div style={{ padding: "calc(22px + env(safe-area-inset-top)) 18px 80px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <div className="serif" style={{ fontSize: 25, color: T.card }}>Session log</div>
        <button onClick={() => go("home")} style={{ background: "none", border: "none", color: T.brass, fontSize: 13 }}>Done</button>
      </div>

      {/* Search bar */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, date, or leak…"
          style={{ width: "100%", padding: "10px 36px 10px 14px", borderRadius: 10, border: "1px solid " + T.line, background: T.baize2, color: T.card, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
        />
        {query && (
          <button onClick={() => setQuery("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.faint, fontSize: 16, lineHeight: 1, padding: 0 }}>✕</button>
        )}
      </div>

      {/* Win / Loss filter chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["all", "All"], ["win", "Wins"], ["loss", "Losses"]].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{ padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: filter === id ? 700 : 500, border: `1px solid ${filter === id ? T.brass : T.line}`, background: filter === id ? "rgba(201,165,70,.14)" : "transparent", color: filter === id ? T.brass : T.mist }}>
            {label}
          </button>
        ))}
      </div>

      {sessions === null && (
        [0, 1, 2].map((i) => (
          <div key={i} style={{ height: 72, borderRadius: 14, background: T.baize2, border: "1px solid " + T.line, marginBottom: 10, animation: `riqShimmer 1.2s ease ${i * 0.15}s infinite` }} />
        ))
      )}
      {sessions !== null && filtered.length === 0 && (
        <div style={{ color: T.mist, fontSize: 14, marginTop: 40, textAlign: "center", lineHeight: 1.6 }}>
          {sessions.length === 0 ? "No sessions yet — play a hand and come back." : "No sessions match that search."}
        </div>
      )}

      {filtered.map((sess, idx) => {
        const sessionNum = total - (sessions || []).indexOf(sess);
        const defaultName = `Session #${sessionNum} · ${fmtDate(sess.started_at)}`;
        const displayName = sess.name || defaultName;
        const net = sess.net_chips || 0;
        const analysis = sess.analysis_json;
        const accuracy = analysis ? analysis.accuracy : null;
        const topLeak = analysis && analysis.leaks && analysis.leaks[0] ? analysis.leaks[0].title.toUpperCase() : null;
        const isExpanded = expandedId === sess.id;
        const hands = handsMap[sess.id];

        return (
          <div key={sess.id} style={{ marginBottom: 8 }}>
            {/* Collapsed row */}
            <button onClick={() => expandSession(sess)} style={{ width: "100%", textAlign: "left", background: T.baize2, border: `1px solid ${isExpanded ? T.brass : T.line}`, borderRadius: isExpanded ? "12px 12px 0 0" : 12, padding: "14px 16px", color: T.card }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {renamingId === sess.id ? (
                    <input
                      autoFocus
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onBlur={() => saveSessionName(sess.id, nameInput)}
                      onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") saveSessionName(sess.id, nameInput); if (e.key === "Escape") setRenamingId(null); }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ background: "transparent", border: "none", borderBottom: `1px solid ${T.brass}`, color: T.card, fontSize: 14, fontWeight: 600, width: "100%", outline: "none", padding: "2px 0", fontFamily: "inherit" }}
                    />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{displayName}</span>
                      <button onClick={(e) => { e.stopPropagation(); setRenamingId(sess.id); setNameInput(sess.name || ""); }} style={{ background: "none", border: "none", color: T.faint, fontSize: 11, padding: "0 3px", lineHeight: 1 }} title="Rename">✎</button>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                    {accuracy != null && (
                      <span className="mono" style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: accuracy >= 85 ? "rgba(127,201,127,.15)" : accuracy >= 65 ? "rgba(201,165,70,.15)" : "rgba(224,113,107,.15)", color: accuracy >= 85 ? T.good : accuracy >= 65 ? T.brass : T.bad, border: `1px solid ${accuracy >= 85 ? "rgba(127,201,127,.4)" : accuracy >= 65 ? T.line : "rgba(224,113,107,.4)"}` }}>
                        {accuracy}% accuracy
                      </span>
                    )}
                    {topLeak && (
                      <span className="mono" style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: "rgba(224,113,107,.1)", color: T.bad, border: "1px solid rgba(224,113,107,.3)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {topLeak}
                      </span>
                    )}
                    {sess.hands_played > 0 && <span style={{ fontSize: 11, color: T.faint }}>{sess.hands_played} hands</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right", marginLeft: 12, flexShrink: 0 }}>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: net >= 0 ? T.good : T.bad }}>{net >= 0 ? "+" : ""}{net.toLocaleString()}</div>
                  <div style={{ fontSize: 9, color: T.faint, marginTop: 2 }}>{isExpanded ? "▲" : "▼"}</div>
                </div>
              </div>
            </button>

            {/* Expanded panel */}
            {isExpanded && (
              <div className="fadeup" style={{ background: T.baize2, border: `1px solid ${T.brass}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: "14px 16px" }}>
                {hands === undefined ? (
                  <div style={{ color: T.faint, fontSize: 12, textAlign: "center", padding: "12px 0" }}>Loading…</div>
                ) : hands === null ? (
                  <div style={{ color: T.faint, fontSize: 12, textAlign: "center", padding: "12px 0" }}>No hand data found for this session.</div>
                ) : (
                  <>
                    {/* Chip trajectory — only when we have hand data */}
                    {hands.length >= 2 && <ChipTrajectory hands={hands} />}

                    {/* Coach note from analysis */}
                    {analysis && analysis.plan && (
                      <div style={{ fontSize: 13, color: "#D8E2DA", lineHeight: 1.6, marginBottom: 14, padding: "10px 12px", background: "rgba(201,165,70,.06)", borderRadius: 9, border: "1px solid " + T.line, borderLeft: `3px solid ${T.brass}` }}>
                        {Array.isArray(analysis.plan) ? analysis.plan[0]?.goal : analysis.plan.split(".")[0] + "."}
                      </div>
                    )}

                    {/* Per-hand list */}
                    {hands.length === 0 ? (
                      <div style={{ color: T.faint, fontSize: 12, textAlign: "center", padding: "12px 0" }}>No hand data for this session.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {hands.map((hand) => {
                          const mistakes = (hand.actions || []).filter((a) => a.is_optimal === false);
                          const hasMistake = mistakes.length > 0;
                          const worst = mistakes.sort((a, b) => (b.ev_loss || 0) - (a.ev_loss || 0))[0];
                          const hnet = hand.result_chips || 0;
                          return (
                            <button key={hand.id} onClick={() => hasMistake && setSelectedHand(hand)} style={{ width: "100%", textAlign: "left", background: hasMistake ? "rgba(224,113,107,.05)" : "rgba(127,201,127,.04)", border: `1px solid ${hasMistake ? "rgba(224,113,107,.22)" : "rgba(127,201,127,.18)"}`, borderRadius: 9, padding: "8px 12px", color: T.card, cursor: hasMistake ? "pointer" : "auto" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <span style={{ fontSize: 12, color: hasMistake ? T.bad : T.good, flexShrink: 0 }}>{hasMistake ? "⚑" : "✓"}</span>
                                <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                                  {(hand.hero_cards || []).map((c, i) => (
                                    <span key={i} className="mono" style={{ fontSize: 12, color: SUIT_RED[c.s] ? T.cordovan : T.card }}>{rankLabel(c.r)}{SUIT_GLYPH[c.s]}</span>
                                  ))}
                                </div>
                                {(hand.board_cards || []).length > 0 && (
                                  <>
                                    <span style={{ color: T.faint, fontSize: 10 }}>·</span>
                                    <div style={{ display: "flex", gap: 2 }}>
                                      {(hand.board_cards || []).map((c, i) => (
                                        <span key={i} className="mono" style={{ fontSize: 10, color: SUIT_RED[c.s] ? T.cordovan : T.mist }}>{rankLabel(c.r)}{SUIT_GLYPH[c.s]}</span>
                                      ))}
                                    </div>
                                  </>
                                )}
                                <span className="mono" style={{ marginLeft: "auto", fontSize: 12, color: hnet >= 0 ? T.good : T.bad, flexShrink: 0 }}>{hnet >= 0 ? "+" : ""}{hnet}</span>
                              </div>
                                  {(() => {
                                const fb = handFeedback(hand);
                                return (
                                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginTop: 4, marginLeft: 19 }}>
                                    <span style={{ fontSize: 11, color: fb.color, lineHeight: 1.45, flex: 1 }}>{fb.msg}</span>
                                    {fb.module && MODULE_INDEX[fb.module] && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); openModule(fb.module); }}
                                        style={{ flexShrink: 0, background: "none", border: `1px solid ${T.line}`, borderRadius: 6, color: T.brass, fontSize: 10, padding: "2px 7px", whiteSpace: "nowrap" }}
                                      >
                                        Drill →
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {selectedHand && (
        <div onClick={() => setSelectedHand(null)} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(4,10,7,.78)", display: "flex", alignItems: "flex-end" }}>
          <div onClick={(e) => e.stopPropagation()} className="fadeup" style={{ width: "100%", maxWidth: 480, margin: "0 auto", background: "rgba(8,22,14,0.96)", borderTop: `3px solid ${T.bad}`, borderRadius: "18px 18px 0 0", padding: "18px 18px calc(28px + env(safe-area-inset-bottom))" }}>
            <HandDetailSheet hand={selectedHand} openModule={openModule} onClose={() => setSelectedHand(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function ShopScreen({ chips, cosmetics, onBuy, back }) {
  const unlocked = ["classic", ...(cosmetics?.unlocked || [])];
  const GLASS = {
    background: "rgba(10,26,18,0.68)",
    backdropFilter: "blur(20px) saturate(150%)",
    WebkitBackdropFilter: "blur(20px) saturate(150%)",
    border: "1px solid rgba(201,165,70,0.16)",
    boxShadow: "0 6px 28px rgba(0,0,0,0.38), inset 0 1px 0 rgba(201,165,70,0.08)",
    borderRadius: 16,
  };
  const backGradients = {
    "back-crimson": "repeating-linear-gradient(135deg, #5A1F1C 0 3px, #3A1210 3px 6px)",
    "back-gold":    "repeating-linear-gradient(45deg, #4A3A14 0 3px, #2E240C 3px 6px)",
    "back-jade":    "repeating-linear-gradient(135deg, #1A3D28 0 3px, #0E2618 3px 6px)",
    "back-royal":   "repeating-radial-gradient(circle at 50% 50%, #2A2050 0 4px, #1A1432 4px 8px)",
    "back-ocean":   "repeating-linear-gradient(135deg, #0F3040 0 3px, #071E2A 3px 6px)",
  };
  const feltColors = {
    "felt-forest":   "#0F2015",
    "felt-midnight": "#14233B",
    "felt-burgundy": "#2A1018",
    "felt-slate":    "#1A2030",
  };
  return (
    <div style={{ padding: "calc(24px + env(safe-area-inset-top)) 18px 80px", height: "100%", overflowY: "auto", background: T.baize }}>
      <button onClick={back} style={{ background: "none", border: "none", color: T.brass, fontSize: 13, padding: 0 }}>← Profile</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
        <div className="serif" style={{ fontSize: 27, color: T.card }}>Shop</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(201,165,70,0.12)", border: "1px solid rgba(201,165,70,0.25)", borderRadius: 20, padding: "6px 14px" }}>
          <span style={{ fontSize: 15 }}>🪙</span>
          <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: T.brass }}>{(chips || 0).toLocaleString()}</span>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: T.mist, marginTop: 6, marginBottom: 22 }}>
        Earn chips by completing lessons. Spend them on cosmetics below.
      </div>
      {SHOP_ITEMS.map((item) => {
        const owned = unlocked.includes(item.id);
        const canAfford = (chips || 0) >= item.price;
        return (
          <div key={item.id} style={{ ...GLASS, border: `1px solid ${owned ? "rgba(127,201,127,0.3)" : "rgba(201,165,70,0.16)"}`, padding: "16px 18px", marginBottom: 10, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 40, height: 57, borderRadius: 6, flexShrink: 0,
              background: item.type === "back" ? (backGradients[item.id] || T.baize) : (feltColors[item.id] || T.baize),
              border: `1.5px solid ${owned ? T.good : T.brassDim}`,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: owned ? T.good : T.card }}>{item.name}</div>
              <div style={{ fontSize: 12, color: T.mist, marginTop: 2 }}>{item.desc}</div>
            </div>
            {owned ? (
              <span className="mono" style={{ fontSize: 11, color: T.good, fontWeight: 700 }}>OWNED</span>
            ) : (
              <button onClick={() => canAfford && onBuy(item)} style={{
                background: canAfford ? T.brass : "rgba(201,165,70,0.10)",
                color: canAfford ? "#1B1505" : T.faint,
                border: "none", borderRadius: 10, padding: "8px 14px",
                fontSize: 13, fontWeight: 700,
                cursor: canAfford ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", gap: 5,
                flexShrink: 0,
              }}>
                🪙 {item.price}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================ TOUR OVERLAY ============================ */
const TOUR_STEPS = [
  { target: "stat-strip",   screen: "home",  title: "Your Edge rating",  desc: "This shows how sharply you're playing. It rises every time you make the right call under pressure." },
  { target: "take-seat",    screen: "home",  title: "Take a seat",       desc: "Deals you into a hand against AI opponents. Every decision you make gets graded — this is your main arena." },
  { target: "spot-trainer", screen: "learn", title: "Spot trainer",      desc: "One decision at a time, infinite reps. Pick a difficulty and drill until the right play feels obvious." },
  { target: "streak-card",  screen: "home",  title: "Daily streak",      desc: "Chain active days to earn bonus chips and keep your rating protected. One session + one drill = a streak day." },
];

function TourOverlay({ step, onNext, onSkip }) {
  const [rect, setRect] = React.useState(null);
  const current = TOUR_STEPS[step] || TOUR_STEPS[0];
  const isLast = step >= TOUR_STEPS.length - 1;

  React.useEffect(() => {
    setRect(null);
    const find = () => {
      const el = document.querySelector(`[data-tour="${current.target}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
    };
    const t = setTimeout(find, 180);
    return () => clearTimeout(t);
  }, [step, current.target]);

  const pad = 10;
  const cutout = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  const vh = typeof window !== "undefined" ? window.innerHeight : 812;
  const tooltipBelow = cutout ? (cutout.top + cutout.height / 2) < vh * 0.55 : false;

  const tooltipStyle = {
    position: "fixed",
    left: "50%",
    transform: "translateX(-50%)",
    width: "min(320px, calc(100vw - 36px))",
    background: "rgba(10,22,14,0.97)",
    border: "1px solid rgba(201,165,70,0.45)",
    borderRadius: 16,
    padding: "18px 20px",
    zIndex: 9993,
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
    ...(cutout
      ? (tooltipBelow ? { top: cutout.top + cutout.height + 20 } : { bottom: vh - cutout.top + 20 })
      : { top: "50%", transform: "translate(-50%, -50%)" }),
  };

  return (
    <div onClick={isLast ? onSkip : onNext} style={{ position: "fixed", inset: 0, zIndex: 9990, cursor: "pointer" }}>
      {cutout ? (
        <div style={{ position: "fixed", top: cutout.top, left: cutout.left, width: cutout.width, height: cutout.height, borderRadius: 14, border: "2px solid rgba(201,165,70,0.65)", boxShadow: "0 0 0 9999px rgba(4,10,7,0.86)", pointerEvents: "none", zIndex: 9991 }} />
      ) : (
        <div style={{ position: "fixed", inset: 0, background: "rgba(4,10,7,0.86)", zIndex: 9991, pointerEvents: "none" }} />
      )}
      <div onClick={(e) => e.stopPropagation()} style={tooltipStyle}>
        <div style={{ fontSize: 10.5, color: T.faint, letterSpacing: ".13em", textTransform: "uppercase", marginBottom: 6 }}>
          {step + 1} of {TOUR_STEPS.length}
        </div>
        <div className="serif" style={{ fontSize: 18, color: T.brass, marginBottom: 8 }}>{current.title}</div>
        <div style={{ fontSize: 13.5, color: T.card, lineHeight: 1.55, marginBottom: 16 }}>{current.desc}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={(e) => { e.stopPropagation(); onSkip(); }} style={{ background: "none", border: "none", color: T.faint, fontSize: 13, cursor: "pointer", padding: 0 }}>
            Skip tour
          </button>
          <button onClick={(e) => { e.stopPropagation(); isLast ? onSkip() : onNext(); }} style={{ background: T.brass, border: "none", color: "#0C1810", fontSize: 13, fontWeight: 700, borderRadius: 8, padding: "8px 18px", cursor: "pointer" }}>
            {isLast ? "Let's play →" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================ APP ROOT ============================ */
export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [answers, setAnswers] = useState({});
  const [pendingJoin, setPendingJoin] = useState(() => {
    // Capture a private-table invite code from the URL once, on first load.
    try {
      const m = window.location.search.match(/[?&]join=([A-Za-z0-9]+)/);
      if (m) {
        // strip the param so a refresh after joining doesn't re-trigger
        const clean = window.location.pathname + window.location.hash;
        window.history.replaceState(null, "", clean);
        return m[1].toUpperCase();
      }
    } catch (e) {}
    return null;
  });
  const [screen, setScreen] = useState("home");
  const [game, setGame] = useState(null);
  const [hands, setHands] = useState([]); // current session hand records
  const [sessions, setSessions] = useState([]);
  const [lifetime, setLifetime] = useState({ hands: 0, won: 0, total: 0, net: 0 });
  const [rating, setRating] = useState(50);
  const [ratingHistory, setRatingHistory] = useState([50]);
  const [progress, setProgress] = useState({});
  const [moduleId, setModuleId] = useState(null);
  const [replayHand, setReplayHand] = useState(null);
  const [streak, setStreak] = useState(0);
  const [dbSessionId, setDbSessionId] = useState(null);
  const [lastPlan, setLastPlan] = useState(null);
  const [lifetimeRows, setLifetimeRows] = useState([]);
  const [currentTier, setCurrentTier] = useState(BOT_TIERS[1]);
  const [puzzleRun, setPuzzleRun] = useState(null);
  const [puzzleReview, setPuzzleReview] = useState(null);
  const [daily, setDaily] = useState({ drill: false, session: false });
  const [mpTable, setMpTable] = useState(null);
  const [mpSeat, setMpSeat] = useState(null);
  const [mpReviewId, setMpReviewId] = useState(null);
  const [mpSessionAnalysis, setMpSessionAnalysis] = useState(null);
  const [replayBackScreen, setReplayBackScreen] = useState("review");
  const [showHands, setShowHands] = useState(false);
  const [showRanges, setShowRanges] = useState(false);
  const [tendencies, setTendencies] = useState(null);
  const [tourStep, setTourStep] = useState(null);
  const [trainerState, setTrainerState] = useState({});
  const trainerRef = useRef({});
  const saveTrainer = useCallback((next) => {
    trainerRef.current = next;
    setTrainerState(next);
    if (profile) dbUpdate("users", `id=eq.${profile.id}`, { trainer_state: next });
  }, [profile]);
  const [celebration, setCelebration] = useState(null);
  const [badgeQueue, setBadgeQueue] = useState([]);
  // Central reward pipeline: every trainer-state commit sweeps the badge catalog and
  // detects level-ups. deferSave skips the DB write for high-frequency events (per hand);
  // the next saveTrainer call persists the accumulated state.
  const commitTrainer = useCallback((next, opts = {}) => {
    const prevLevel = levelInfo(xpTotalOf(trainerRef.current)).level;
    const ctx = { ...badgeCtx(next, opts.lifetime || lifetime, opts.progress || progress, opts.streak != null ? opts.streak : streak, opts.rating != null ? opts.rating : rating), active: true };
    const [withBadges, fresh] = checkBadges(next, ctx);
    if (opts.deferSave) { trainerRef.current = withBadges; setTrainerState(withBadges); }
    else saveTrainer(withBadges);
    if (fresh.length) setBadgeQueue((q) => [...q, ...fresh]);
    const newLevel = levelInfo(xpTotalOf(withBadges)).level;
    if (newLevel > prevLevel) setCelebration((c) => c || { type: "level", level: newLevel });
  }, [saveTrainer, lifetime, progress, streak, rating]);
  const onClaimQuest = useCallback((id) => {
    const [ts, reward] = claimQuest(trainerRef.current, id);
    if (!reward) return;
    haptic("medium");
    commitTrainer(ts);
  }, [commitTrainer]);
  const dbSessionRef = useRef(null);
  useEffect(() => { dbSessionRef.current = dbSessionId; }, [dbSessionId]);

  // Tour screen navigation: each step targets a different screen
  useEffect(() => {
    if (tourStep === null) return;
    const s = TOUR_STEPS[tourStep];
    if (s) setScreen(s.screen);
  }, [tourStep]);
  const recordedRef = useRef(new Set());
  const equityRef = useRef(0.5);

  // Native deep-link handler: receives OAuth tokens and invite codes on Android/iOS.
  // On web the hash / search params are parsed directly in AuthScreen's useEffect.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handleUrl = async ({ url }) => {
      try {
        // OAuth callback: com.riveriq.app://login-callback#access_token=...
        const hashIdx = url.indexOf("#");
        if (hashIdx !== -1 && url.includes("access_token")) {
          const params = new URLSearchParams(url.slice(hashIdx + 1));
          const at = params.get("access_token"), rt = params.get("refresh_token");
          if (at) {
            const ur = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + at } });
            if (ur.ok) {
              const u = await ur.json();
              saveSession({ access_token: at, refresh_token: rt, user: u });
              const uname = (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || (u.email || "player").split("@")[0];
              const prof = await ensureProfile(uname.replace(/\s+/g, ""));
              handleAuthed(prof, {});
            }
          }
          return;
        }
        // Invite-link: com.riveriq.app://join?join=ABCD
        const searchIdx = url.indexOf("?");
        if (searchIdx !== -1) {
          const params = new URLSearchParams(url.slice(searchIdx + 1));
          const code = params.get("join");
          if (code) { setPendingJoin(code.toUpperCase()); }
        }
      } catch (e) { console.error("[appUrlOpen]", e); }
    };
    CapApp.addListener("appUrlOpen", handleUrl);
    return () => { CapApp.removeAllListeners(); };
  }, []); // eslint-disable-line

  const handleAuthed = useCallback(async (prof, ans) => {
    setProfile(prof);
    setAnswers(ans || {});
    setUser({ name: prof.username });
    const stored = Number(prof.skill_rating) || 0;
    const r0 = stored >= 400 ? stored : 1000; // migrate old 0-100 scale / new players -> provisional 1000
    setRating(r0);
    setRatingHistory([r0]);
    // shield auto-apply: 1-2 missed days covered by banked shields keep the streak alive
    {
      const yst = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (prof.streak_day && prof.streak_day < yst) {
        const missed = Math.round((new Date(yst) - new Date(prof.streak_day)) / 86400000);
        const ts0 = prof.trainer_state || {};
        if (missed >= 1 && missed <= 2 && (ts0.shields || 0) >= missed) {
          ts0.shields -= missed;
          prof.streak_day = yst;
          prof.trainer_state = ts0;
          dbUpdate("users", `id=eq.${prof.id}`, { streak_day: yst, trainer_state: ts0 });
        }
      }
    }
    setStreak(prof.streak || 0);
    trainerRef.current = prof.trainer_state || {};
    setTrainerState(prof.trainer_state || {});
    COSMETICS.back = (prof.cosmetics && prof.cosmetics.back) || "classic";
    COSMETICS.felt = (prof.cosmetics && prof.cosmetics.felt) || null;
    const _today = new Date().toISOString().slice(0, 10);
    const _drillDoneToday = (() => { try { return localStorage.getItem("riq_daily_drill_" + _today) === "true"; } catch { return false; } })();
    if (prof.streak_day === _today) {
      // Full streak day already banked — both drill and session are complete.
      setDaily({ drill: true, session: true });
    } else if (_drillDoneToday) {
      // Drill done today but session not yet — restore drill credit only.
      setDaily((d) => ({ ...d, drill: true }));
    }
    // Restore an in-progress review if the user refreshed mid-review.
    const savedReview = (() => { try { const s = localStorage.getItem("riq_active_review"); return s ? JSON.parse(s) : null; } catch { return null; } })();
    if (savedReview) { setSessions([savedReview]); setScreen("review"); } else { setScreen("home"); }
    // Boot-time recovery: if a previous session's DB write failed mid-network, retry it silently.
    (() => {
      try {
        const pending = localStorage.getItem("riq_pending_rating_sync");
        if (!pending) return;
        const payload = JSON.parse(pending);
        const { rating: r, sessionId: sid, timestamp: ts, sessionClose } = payload;
        if (!r || !prof.id) return;
        if (Date.now() - ts > 86400000) { localStorage.removeItem("riq_pending_rating_sync"); return; }
        (async () => {
          try {
            if (sid && sessionClose) await dbUpdate("sessions", `id=eq.${sid}`, sessionClose);
            await dbUpdate("users", `id=eq.${prof.id}`, { skill_rating: r });
            localStorage.removeItem("riq_pending_rating_sync");
            console.log("[boot recovery] pending rating sync succeeded");
          } catch (e) {
            console.warn("[boot recovery] retry failed, will try again next boot", e);
          }
        })();
      } catch {}
    })();
    const past = await dbSelect("sessions", `user_id=eq.${prof.id}&select=hands_played,net_chips&order=started_at.desc&limit=200`);
    // Edge rating migration: initialise Glicko parameters once, from existing session history
    {
      const ts0 = { ...(prof.trainer_state || {}) };
      if (ts0.rating_n == null) {
        const n0 = (past || []).length;
        ts0.rating_n = n0;
        ts0.phi = Math.max(50, 350 - Math.min(n0, 100) * 3);
        ts0.sigma = 0.6;
        ts0.rolling_var = 90000;
        trainerRef.current = ts0;
        setTrainerState(ts0);
        dbUpdate("users", `id=eq.${prof.id}`, { trainer_state: ts0 });
      }
    }
    setLifetime({
      hands: past.reduce((s, x) => s + (x.hands_played || 0), 0),
      won: past.filter((x) => (x.net_chips || 0) > 0).length,
      total: past.length,
      net: past.reduce((s, x) => s + (x.net_chips || 0), 0),
    });
    dbSelect("player_profiles", `user_id=eq.${prof.id}&select=*`).then((r) => r[0] && setTendencies(r[0]));
    // day-one ritual: brand-new accounts get the app spotlight tour
    if (ans && Object.keys(ans).length && !prof.streak_day) {
      setScreen("home");
      setTourStep(0);
    }
    const prog = await dbSelect("learn_progress", `user_id=eq.${prof.id}&select=module_id`);
    setProgress(Object.fromEntries(prog.map((p) => [p.module_id, true])));
    // lifetime hands -> profit buckets (position column comes from upgrade.sql; falls back gracefully)
    let rows = await dbSelect("hands", `select=position,result_chips,street_reached,actions(street,action_type,amount,is_optimal,ev_loss),sessions!inner(user_id)&sessions.user_id=eq.${prof.id}&order=created_at.desc&limit=400`);
    if (!rows.length) rows = await dbSelect("hands", `select=result_chips,street_reached,actions(street,action_type,amount,is_optimal,ev_loss),sessions!inner(user_id)&sessions.user_id=eq.${prof.id}&order=created_at.desc&limit=400`);
    setLifetimeRows(rows.map((r) => {
      const heroActs = r.actions || [];
      const first = heroActs.find((a) => a.street === "preflop");
      return {
        pos: r.position || null,
        verb: first ? verbFromType(first.action_type, false) : "folded",
        netBB: (r.result_chips || 0) / BB,
        mistakes: heroActs.filter((a) => a.is_optimal === false).length,
        evLost: heroActs.reduce((s, a) => s + (Number(a.ev_loss) || 0), 0),
        showdown: r.street_reached === "showdown",
      };
    }));
    // If they arrived via an invite link, jump straight to that table now that they have an account.
    if (pendingJoin) {
      const code = pendingJoin;
      setPendingJoin(null);
      try {
        const r = await sbFetch("/functions/v1/join-table", { method: "POST", body: JSON.stringify({ table_code: code }) });
        const data = await r.json().catch(() => ({}));
        if (r.ok && data.table) {
          setMpTable(data.table);
          setMpSeat(data.seat);
          setScreen("mptable");
          return;
        }
      } catch (e) { /* fall through to home if the table is gone or full */ }
    }
  }, [pendingJoin]);

  const startSession = useCallback(async (tier) => {
    const t = tier || BOT_TIERS[1];
    setCurrentTier(t);
    recordedRef.current = new Set();
    setHands([]);
    setDbSessionId(null);
    dbSessionRef.current = null;
    const players = [
      { name: user?.name || "You", stack: START_STACK, isHero: true },
      ...buildOpponents(t.id, Math.random),
    ];
    // Await the session INSERT before dealing so that dbSessionRef.current is
    // populated before the first hand-result effect fires. Without this, the
    // async .then() resolved too late and the first hand was never persisted.
    if (profile) {
      const rows = await dbInsert("sessions", { user_id: profile.id });
      if (rows && rows[0]) {
        dbSessionRef.current = rows[0].id; // write ref immediately for the hand-recording effect
        setDbSessionId(rows[0].id);        // keep state in sync for endSession
      }
    }
    setGame(dealHand(players, Math.floor(Math.random() * 6), 0));
    setScreen("play");
  }, [user, profile]);

  const nextHand = useCallback(() => {
    setGame((g) => dealHand(g.players, (g.button + 1) % 6, g.handNo + 1));
  }, []);

  // Hero equity (recompute on board / fold changes)
  const aliveOpp = game ? game.players.filter((p, i) => i !== 0 && !p.folded).length : 0;
  const equity = useMemo(() => {
    if (!game || game.players[0].folded) return 0;
    const iters = game.board.length === 0 ? 120 : 160;
    return equityMC(game.players[0].cards, game.board, Math.max(1, aliveOpp), iters);
  }, [game && game.handNo, game && game.street, game && game.board.length, aliveOpp]); // eslint-disable-line
  useEffect(() => { equityRef.current = equity; }, [equity]);

  // AI turns
  useEffect(() => {
    if (!game || game.street === "result" || game.toAct <= 0) return;
    const idx = game.toAct, hn = game.handNo;
    const t = setTimeout(() => {
      setGame((g) => {
        if (!g || g.toAct !== idx || g.handNo !== hn || g.street === "result") return g;
        return applyAction(g, idx, decideAI(g, idx), { name: g.players[idx].name });
      });
    }, 800 + Math.random() * 1200);
    return () => clearTimeout(t);
  }, [game && game.toAct, game && game.street, game && game.handNo, game && game.log.length]); // eslint-disable-line

  const onHeroAct = useCallback((act) => {
    haptic(act.type === "raise" ? "medium" : act.type === "fold" ? "light" : "light");
    setGame((g) => {
      if (!g || g.toAct !== 0) return g;
      const eq = equityRef.current;
      const meta = assessHero(g, act, eq);
      // Edge rating context: who is the aggressor, what are their tendencies, how many are live
      meta.live = g.players.filter((q) => !q.folded).length - 1;
      const aggIdx = g.currentBet > g.players[0].bet
        ? g.players.findIndex((q, qi) => qi !== 0 && !q.folded && q.bet === g.currentBet)
        : -1;
      meta.oppTendency = botTendency(aggIdx >= 0 ? g.players[aggIdx].style : null);
      if (act.type === "raise" && g.street !== "preflop") {
        const s = scoreAggression(g, act, eq); // samples each bot's actual decision code
        if (s) {
          meta.foldChance = s.pAllFold;
          if (meta.tag === "bluff") {
            meta.evLoss = Math.max(0, +(-s.evBB).toFixed(2));
            meta.estimate = false;
            meta.measured = true;
            if (meta.evLoss < 0.2) meta.evLoss = 0; // profitable bluff against this lineup
          }
        }
      }
      return applyAction(g, 0, act, { ...meta, name: g.players[0].name });
    });
  }, []);

  // Record completed hands (memory + database)
  useEffect(() => {
    if (!game || game.street !== "result" || recordedRef.current.has(game.handNo)) return;
    recordedRef.current.add(game.handNo);
    const net = game.players[0].stack - game.heroStart;
    const heroMistakes = game.log.filter((a) => a.idx === 0 && a.evLoss > 0);
    const worstA = heroMistakes.sort((a, b) => b.evLoss - a.evLoss)[0];
    const headline = worstA && RULESET[worstA.ruleId]
      ? RULESET[worstA.ruleId].title
      : net > 0 ? "Well played pot" : net < 0 ? "Tough spot, see the line" : "Quiet hand";
    setHands((h) => [...h, {
      handNo: game.handNo,
      heroCards: game.players[0].cards,
      board: game.board,
      actions: game.log,
      net,
      pos: game.heroPos,
      mistakes: heroMistakes.length,
      headline,
      wentToShowdown: game.wentToShowdown,
    }]);
    // quest progress per hand (deferred DB write; endSession persists)
    {
      let ts = bumpQuest(trainerRef.current, "hands", 1);
      if (net > 0) ts = bumpQuest(ts, "wins", 1);
      commitTrainer(ts, { deferSave: true, lifetime: { hands: lifetime.hands + 1 } });
    }
    const sid = dbSessionRef.current;
    if (sid) {
      const streets = { 0: "preflop", 3: "flop", 4: "turn", 5: "river" };
      const row = {
        session_id: sid,
        hand_number: game.handNo,
        hero_cards: game.players[0].cards,
        board_cards: game.board,
        pot_size: game.players.reduce((s, p) => s + p.committed, 0),
        result_chips: net,
        street_reached: game.wentToShowdown ? "showdown" : streets[game.board.length] || "preflop",
      };
      const saveActions = (rows) => {
        if (!rows || !rows[0]) return;
        const acts = game.log.filter((a) => a.idx === 0).map((a) => ({
          hand_id: rows[0].id, street: a.street, action_type: a.type,
          amount: a.amount ?? null, is_optimal: !(a.evLoss > 0),
          ev_loss: a.evLoss ? +a.evLoss.toFixed(2) : null,
        }));
        if (acts.length) dbInsert("actions", acts);
      };
      // try with position column (run upgrade.sql to add it); fall back without
      dbInsert("hands", { ...row, position: game.heroPos }).then((rows) => {
        if (rows) saveActions(rows);
        else dbInsert("hands", row).then(saveActions);
      });
    }
  }, [game && game.street]); // eslint-disable-line

  const endSession = useCallback(() => {
    if (hands.length === 0) {
      if (dbSessionId) dbDelete("sessions", `id=eq.${dbSessionId}`);
      setScreen("home"); setGame(null); return;
    }
    const analysis = analyzeSession(hands, { rating, sessionNumber: lifetime.total + 1, lastPlan });
    analysis.allHands = hands;
    // ---- Edge rating: equity-margin, pot-weighted, opponent-adjusted ----
    const edge = edgeSession(hands);
    analysis.edge = { A: edge.A, Apre: edge.Apre, Apost: edge.Apost, Asize: edge.Asize, count: edge.count, biggestWin: edge.biggestWin, biggestErr: edge.biggestErr };
    let newRating = rating;
    let edgeState = null;
    if (edge.count >= 8) {
      const upd = edgeUpdate(trainerRef.current, edge.A, rating);
      newRating = upd.mu;
      analysis.ratingDelta = upd.delta; // same field the UI already reads
      edgeState = upd;
    } else {
      analysis.ratingDelta = 0; // too few contested decisions to move the rating
    }
    analysis.moment = sessionMoment(analysis, analysis.edge, analysis.ratingDelta);
    // Persist the completed analysis so the review survives a page refresh.
    // Cleared on ReviewScreen unmount (Done button, NavBar tap, or any exit).
    try { localStorage.setItem("riq_active_review", JSON.stringify(analysis)); } catch {}
    try {
      const _today = new Date().toISOString().slice(0, 10);
      const _prev = parseInt(localStorage.getItem("riq_session_hands_" + _today) || "0", 10);
      localStorage.setItem("riq_session_hands_" + _today, String(Math.min(_prev + analysis.stats.hands, 10)));
    } catch {}
    setRating(newRating);
    setRatingHistory((h) => [...h, newRating]);
    setSessions((s) => [...s, analysis]);
    setLastPlan(analysis.plan);
    setLifetime((t) => ({ hands: t.hands + analysis.stats.hands, won: t.won + (analysis.stats.net > 0 ? 1 : 0), total: t.total + 1, net: t.net + analysis.stats.net }));
    setLifetimeRows((rows) => [
      ...rows,
      ...hands.map((h) => {
        const first = h.actions.find((a) => a.idx === 0 && a.street === "preflop");
        return {
          pos: h.pos, verb: first ? verbFromType(first.type, first.toCall > BB) : "folded",
          netBB: h.net / BB, mistakes: h.mistakes,
          evLost: h.actions.filter((a) => a.idx === 0).reduce((s, a) => s + (a.evLoss || 0), 0),
          showdown: !!h.wentToShowdown,
        };
      }),
    ]);
    setGame(null);
    setScreen("review");
    // tier ladder: beating a lineup over 15+ hands unlocks the next
    if (currentTier && analysis.stats.net > 0 && analysis.stats.hands >= 15 && currentTier.id < 3) {
      const key = "tier-unlock-" + (currentTier.id + 1);
      setProgress((p) => ({ ...p, [key]: true }));
      if (profile) dbUpsert("learn_progress", { user_id: profile.id, module_id: key, completed_at: new Date().toISOString(), drill_score: 100 }, "user_id,module_id");
    }
    if (analysis.stats.hands >= 10) setDaily((d) => ({ ...d, session: true }));
    commitTrainer(scheduleLeakReviews({
      ...trainerRef.current,
      decisions: (trainerRef.current.decisions || 0) + analysis.stats.decisions,
      ...(edgeState ? { phi: edgeState.phi, sigma: edgeState.sigma, rolling_var: edgeState.rollingVar, rating_n: edgeState.n } : {}),
    }, analysis.leaks.map((l) => familyOf(l.ruleId))), {
      lifetime: { hands: lifetime.hands + analysis.stats.hands },
      rating: newRating,
    });
    // ---- Persist session stats + rating to Supabase; cache locally on any network failure ----
    (async () => {
      try {
        if (dbSessionId) {
          const analysisForDb = { accuracy: analysis.accuracy, leaks: analysis.leaks, plan: analysis.plan, stats: analysis.stats, ratingDelta: analysis.ratingDelta };
          await dbUpdate("sessions", `id=eq.${dbSessionId}`, { ended_at: new Date().toISOString(), hands_played: analysis.stats.hands, net_chips: analysis.stats.net, analysis_json: analysisForDb });
          sbFetch("/functions/v1/profile-sync", { method: "POST", body: JSON.stringify({ session_id: dbSessionId }) }).catch(() => {});
          dbSelect("player_profiles", `user_id=eq.${profile?.id}&select=*`).then((r) => r[0] && setTendencies(r[0]));
        }
        if (profile) {
          await dbUpdate("users", `id=eq.${profile.id}`, { skill_rating: newRating });
          // data collection: every scored decision, with context + verdict + outcome, for future validation/training
          if (edge.decisions.length) {
            const rows = edge.decisions.map((d) => ({
              user_id: profile.id,
              session_id: dbSessionId || null,
              hand_no: d.handNo,
              street: d.street,
              decision_type: d.type,
              hero_action: d.action,
              hero_cards: hands.find((h) => h.handNo === d.handNo) ? hands.find((h) => h.handNo === d.handNo).heroCards.map(cardStr).join("") : null,
              board: (() => { const h = hands.find((x) => x.handNo === d.handNo); return h ? h.board.map(cardStr).join("") : null; })(),
              position: (() => { const h = hands.find((x) => x.handNo === d.handNo); return h ? h.pos : null; })(),
              pot: Math.round(d.pot),
              bet_facing: Math.round(d.toCall),
              bet_made: d.amount != null ? Math.round(d.amount) : null,
              hero_equity: d.eq != null ? +d.eq.toFixed(3) : null,
              threshold: d.threshold != null ? +d.threshold.toFixed(3) : null,
              margin: +d.margin.toFixed(4),
              pot_weight: +d.wPot.toFixed(4),
              weighted_score: +d.score.toFixed(5),
              opp_profile: d.opp,
              players_in_hand: d.live + 1,
              hand_net: d.handNet,
              showdown: d.showdown,
            }));
            for (let i = 0; i < rows.length; i += 50) dbInsert("decision_log", rows.slice(i, i + 50));
          }
          dbSelect("leaks", `user_id=eq.${profile.id}&select=leak_type,sessions_tracked`).then((existing) => {
            const prior = Object.fromEntries((existing || []).map((e) => [e.leak_type, e.sessions_tracked || 1]));
            analysis.leaks.forEach((l) => {
              l.history = (prior[l.title] || 0) + 1;
              dbUpsert("leaks", { user_id: profile.id, leak_type: l.title, deviation_pct: l.costBB, sessions_tracked: l.history, updated_at: new Date().toISOString() }, "user_id,leak_type");
            });
          });
        }
      } catch (err) {
        console.error("[endSession] DB write failed — caching locally:", err);
        try {
          localStorage.setItem("riq_pending_rating_sync", JSON.stringify({
            rating: newRating,
            sessionId: dbSessionId,
            timestamp: Date.now(),
            sessionClose: dbSessionId ? { ended_at: new Date().toISOString(), hands_played: analysis.stats.hands, net_chips: analysis.stats.net } : null,
          }));
        } catch {}
      }
    })();
  }, [hands, rating, dbSessionId, profile, lifetime.total, lastPlan, currentTier, commitTrainer]);

  const openModule = (id) => { setModuleId(id); setScreen("module"); };
  const completeModule = (id, chipsEarned = 0, isReplay = false, peakCombo = 0) => {
    setProgress((p) => ({ ...p, [id]: true }));
    let ts = awardChips(trainerRef.current, chipsEarned);
    ts = bumpQuest(ts, "lesson", 1);
    ts.mastery = { ...(ts.mastery || {}), [id]: Math.min(5, ((ts.mastery || {})[id] || 0) + 1) };
    ts.bestCombo = Math.max(ts.bestCombo || 0, peakCombo);
    commitTrainer(ts, { progress: { ...progress, [id]: true } });
    if (!isReplay && profile) {
      dbUpsert("learn_progress", { user_id: profile.id, module_id: id, completed_at: new Date().toISOString(), drill_score: 100 }, "user_id,module_id");
    }
  };
  // Streak: daily drill + a 10-hand session = a streak day. Milestones unlock cosmetics.
  const todayStr = () => new Date().toISOString().slice(0, 10);
  useEffect(() => {
    if (!daily.drill || !daily.session || !profile) return;
    if (profile.streak_day === todayStr()) return;
    const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const twoAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const repaired = profile.streak_day === twoAgo && daily.repair; // a perfect drill earned the repair
    const newStreak = (profile.streak_day === yest || repaired) ? (profile.streak || 0) + 1 : 1;
    const cos = { ...(profile.cosmetics || {}) };
    cos.unlocked = cos.unlocked || [];
    [[3, "back-crimson"], [7, "back-gold"], [14, "felt-midnight"], [30, "back-royal"]].forEach(([d, id]) => {
      if (newStreak >= d && !cos.unlocked.includes(id)) cos.unlocked.push(id);
    });
    // every 7th streak day banks a shield (max 2)
    let ts2 = { ...trainerRef.current };
    if (newStreak > 0 && newStreak % 7 === 0) ts2.shields = Math.min(2, (ts2.shields || 0) + 1);
    ts2.bestStreak = Math.max(ts2.bestStreak || 0, newStreak);
    // Award streak chips: 20 base + up to 30 bonus scaling with streak length
    const streakBonus = 20 + Math.min(Math.floor(newStreak * 2), 30);
    ts2 = awardChips(ts2, streakBonus);
    commitTrainer(ts2, { streak: newStreak });
    setCelebration({ type: "streak", streak: newStreak, chips: streakBonus });
    haptic("heavy");
    const upd = { streak: newStreak, streak_day: todayStr(), cosmetics: cos };
    setProfile((p) => ({ ...p, ...upd }));
    setStreak(newStreak);
    dbUpdate("users", `id=eq.${profile.id}`, upd);
  }, [daily, profile]); // eslint-disable-line

  const signOut = () => {
    saveSession(null);
    setUser(null); setProfile(null); setSessions([]); setHands([]); setGame(null);
    setLifetime({ hands: 0, won: 0, total: 0, net: 0 });
    setScreen("home");
  };
  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Delete your account permanently?\n\nThis will erase your rating, all sessions, decisions, and progress. This cannot be undone."
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-user-account`, {
        method: "POST",
        headers: { Authorization: `Bearer ${Auth.session?.access_token}`, apikey: SUPABASE_KEY },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
      signOut();
      try {
        Object.keys(localStorage).filter(k => k.startsWith("riq_")).forEach(k => localStorage.removeItem(k));
        Auth.session = null;
      } catch {}
    } catch (err) {
      console.error("[deleteAccount]", err);
      window.alert("Account deletion failed. Please email support@riveriq.com and we will delete your data within 30 days.");
    }
  };
  const lastSession = sessions[sessions.length - 1];

  const go = (id) => {
    if (id === "play") { game ? setScreen("play") : setScreen("lobby"); return; }
    setScreen(id);
  };

  // Guard: if a data-dependent screen loses its required state (e.g. token drop,
  // stale navigation, or refresh mid-flow), redirect to the nearest safe screen
  // rather than silently rendering the generic HomeScreen fallback.
  useEffect(() => {
    if (!user) return;
    if (screen === "play" && !game) setScreen("lobby");
    else if (screen === "review" && !lastSession) setScreen("home");
    else if (screen === "replay" && !replayHand) setScreen("review");
    else if (screen === "puzzle" && !puzzleRun) setScreen("home");
    else if (screen === "puzzlereview" && !puzzleReview) setScreen("home");
    else if (screen === "module" && !moduleId) setScreen("learn");
    else if (screen === "mptable" && !mpTable) setScreen("lobby");
    else if (screen === "mpreview" && !mpReviewId) setScreen("lobby");
  }, [screen, user, game, lastSession, replayHand, puzzleRun, puzzleReview, moduleId, mpTable, mpReviewId]);

  let body;
  if (!user) body = <AuthScreen onAuthed={handleAuthed} pendingJoin={pendingJoin} />;
  else if (screen === "home") body = <HomeScreen user={user} sessions={sessions} lifetime={lifetime} rating={rating} onOpenHands={() => setShowHands(true)} go={(s) => (s === "lobby" ? setScreen("lobby") : go(s))} streak={streak} streakDay={profile?.streak_day} daily={daily} trainerState={trainerState} ratingHistory={ratingHistory} sessionHandCount={daily.session ? 10 : Math.min((lastSession ? lastSession.stats.hands : 0), 10)} profile={profile} onClaimQuest={onClaimQuest} onDailyDrill={(family) => {
    const _drillToday = new Date().toISOString().slice(0, 10);
    const _dateSeed = (() => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); })();
    const list = family ? Array.from({ length: 10 }, (_, i) => genPuzzle(mulberry32(_dateSeed + i + 1337), family, 0.6)) : dailyPuzzles();
    const due = dueReviews(trainerRef.current);
    if (due.length) list[0] = genPuzzle(mulberry32(Date.now()), due[0], levelFor(trainerRef.current, due[0]));
    // Resume from where the user left off if they exited mid-drill today.
    const savedCount = (() => { try { const n = parseInt(localStorage.getItem("riq_drill_count_" + _drillToday), 10); return Number.isFinite(n) && n > 0 && n < list.length ? n : 0; } catch { return 0; } })();
    // Pre-fill skipped slots with null so the results.length completion check
    // (Object.keys(results).length >= list.length) still fires correctly after
    // the user finishes the remaining puzzles in this resumed session.
    const prefilledResults = {};
    for (let i = 0; i < savedCount; i++) prefilledResults[i] = null;
    setPuzzleRun({ mode: "daily", list, idx: savedCount, results: prefilledResults });
    setScreen("puzzle");
  }} />;
  else if (screen === "log") body = <LogScreen profile={profile} go={go} openModule={openModule} />;
  else if (screen === "lobby") body = <Lobby onStart={startSession} onPrivate={() => setScreen("mpsetup")} go={go} rating={rating} progress={progress} />;
  else if (screen === "play" && game) body = <PlayScreen game={game} setGame={setGame} equity={equity} onHeroAct={onHeroAct} onNextHand={nextHand} onEndSession={endSession} sessionHandCount={game.handNo} />;
  else if (screen === "review" && lastSession) body = <ReviewScreen session={lastSession} rating={rating} band={ratingBand(lifetime.hands)} go={go} lifetimeBuckets={bucketize(lifetimeRows)} openModule={openModule} openReplay={(h) => { setReplayHand(h); setReplayBackScreen("review"); setScreen("replay"); }} />;
  else if (screen === "replay" && replayHand) body = <ReplayScreen hand={replayHand} back={() => setScreen(replayBackScreen)} />;
  else if (screen === "learn") body = <LearnScreen progress={progress} openModule={openModule} ratingHistory={ratingHistory} sessions={sessions} trainerState={trainerState} focusLeaks={lastSession ? lastSession.leaks : []} onTrainer={(levelName) => {
    const due = dueReviews(trainerRef.current);
    const fams = [...due, ...(lastSession ? lastSession.leaks.map((l) => familyOf(l.ruleId)) : [])];
    const rng = mulberry32(Date.now());
    const f0 = fams[0] || null;
    setPuzzleRun({ mode: "leak", levelName, families: fams, list: [trainerPuzzle(levelName, f0, rng, trainerRef.current)], idx: 0, results: {} });
    setScreen("puzzle");
  }} />;
  else if (screen === "module") body = <ModuleScreen moduleId={moduleId} back={() => setScreen("learn")} progress={progress} openModule={openModule} trainerState={trainerState} onComplete={(id, chips, isReplay, peakCombo) => completeModule(id, chips, isReplay, peakCombo)} onExercises={(id) => {
    const rng = mulberry32(Date.now());
    setPuzzleRun({ mode: "module", modId: id, list: [moduleExercise(id, rng, levelFor(trainerRef.current, "mod:" + id))], idx: 0, results: {}, justCompleted: false });
    setScreen("puzzle");
  }} />;
  else if (screen === "puzzle" && puzzleRun) body = <PuzzleScreen
    run={puzzleRun} justCompleted={puzzleRun.justCompleted}
    onResult={(idx, ok) => {
      setPuzzleRun((r) => {
        let justCompleted = r.justCompleted;
        if (r.mode === "module") {
          const key = "mod:" + r.modId;
          let ts = recordPuzzleAnswer(trainerRef.current, key, ok);
          if (ok) { ts = awardChips(ts, 3); ts = bumpQuest(ts, "puzzles", 1); }
          commitTrainer(ts);
          if (ts.famStats[key].c >= 5 && !progress[r.modId]) { completeModule(r.modId, 0, false); justCompleted = true; }
        } else {
          const fam = r.list[idx] ? r.list[idx].family : null;
          let ts = recordPuzzleAnswer(trainerRef.current, fam, ok);
          if (ok) { ts = awardChips(ts, 3); ts = bumpQuest(ts, "puzzles", 1); }
          commitTrainer(ts);
        }
        return { ...r, results: { ...r.results, [idx]: ok }, justCompleted };
      });
      // Persist partial daily drill progress after every answer so Exit and
      // refresh don't reset the user back to puzzle 1.
      if (puzzleRun && puzzleRun.mode === "daily") {
        try { localStorage.setItem("riq_drill_count_" + new Date().toISOString().slice(0, 10), String(idx + 1)); } catch {}
      }
    }}
    onNext={() => setPuzzleRun((r) => {
      if (r.mode === "daily") {
        if (r.idx >= r.list.length - 1) return r;
        return { ...r, idx: r.idx + 1 };
      }
      if (r.mode === "module") {
        const rng = mulberry32(Date.now() + r.idx);
        return { ...r, idx: r.idx + 1, justCompleted: false, list: [...r.list, moduleExercise(r.modId, rng, levelFor(trainerRef.current, "mod:" + r.modId))] };
      }
      const due = dueReviews(trainerRef.current);
      const fams = [...due, ...(r.families || [])];
      const fam = fams.length ? fams[(r.idx + 1) % fams.length] : null;
      return { ...r, idx: r.idx + 1, list: [...r.list, trainerPuzzle(r.levelName || "easy", fam, mulberry32(Date.now() + r.idx), trainerRef.current)] };
    })}
    onExit={() => {
      const r = puzzleRun;
      const finishedDrill = r.mode === "daily" && Object.keys(r.results).length >= r.list.length;
      if (r.mode === "daily" && Object.keys(r.results).length >= r.list.length) {
        const perfect = r.list.every((_, i) => r.results[i]);
        // Stamp today's date so drill credit survives a refresh even before the
        // 10-hand session is done (streak_day is only written once both are complete).
        const _completedToday = new Date().toISOString().slice(0, 10);
        try { localStorage.setItem("riq_daily_drill_" + _completedToday, "true"); } catch {}
        // Drill is fully done — remove the partial-progress counter.
        try { localStorage.removeItem("riq_drill_count_" + _completedToday); } catch {}
        setDaily((d) => ({ ...d, drill: true, repair: d.repair || perfect }));
        // drill quest + counters; a perfect 10/10 pays a chip bonus
        let ts = bumpQuest(trainerRef.current, "drill", 1);
        ts.drillsDone = (ts.drillsDone || 0) + 1;
        if (perfect) { ts.perfectDrills = (ts.perfectDrills || 0) + 1; ts = awardChips(ts, 15); }
        commitTrainer(ts);
      }
      if (finishedDrill) {
        // show the drill review (solo-review format) before leaving
        setPuzzleReview(r);
        setPuzzleRun(null);
        setScreen("puzzlereview");
        return;
      }
      const dest = puzzleRun.mode === "module" ? "module" : puzzleRun.mode === "leak" ? "learn" : "home";
      setPuzzleRun(null);
      setScreen(dest);
    }} />;
  else if (screen === "puzzlereview" && puzzleReview) body = <PuzzleReviewScreen run={puzzleReview} onDone={() => { setPuzzleReview(null); setScreen("home"); }} />;
  else if (screen === "mpsetup") body = <MpSetup back={() => setScreen("lobby")} onSeated={(t, seat) => { setMpTable(t); setMpSeat(seat); setScreen("mptable"); }} />;
  else if (screen === "mptable" && mpTable) body = <MpTableScreen table={mpTable} mySeat={mpSeat} profile={profile || { id: null }} onLeft={(handsPlayed, serverAnalysis) => {
    if (handsPlayed > 0) {
      let sess = null;
      if (serverAnalysis?.hands?.length) {
        try {
          sess = analyzeSession(serverAnalysis.hands, { rating, sessionNumber: (sessions.length || 0) + 1 });
          sess.ratingDelta = serverAnalysis.rating_delta ?? 0;
          sess.allHands = serverAnalysis.hands;
        } catch {}
      }
      setMpSessionAnalysis(sess);
      setMpReviewId(mpTable.id);
      setScreen("mpreview");
      if (serverAnalysis?.new_rating) setRating(serverAnalysis.new_rating);
    } else setScreen("lobby");
    setMpTable(null);
  }} />;
  else if (screen === "mpreview" && mpReviewId) body = <MpReviewScreen tableId={mpReviewId} session={mpSessionAnalysis} rating={rating} band={ratingBand(lifetime.hands)} go={go} openModule={openModule} openReplay={(h) => { setReplayHand(h); setReplayBackScreen("mpreview"); setScreen("replay"); }} />;
  else if (screen === "shop") body = <ShopScreen chips={(trainerState && trainerState.xp_chips) || 0} cosmetics={profile ? profile.cosmetics : {}} back={() => setScreen("profile")} onBuy={(item) => {
    const cos = { ...((profile && profile.cosmetics) || {}), unlocked: [...new Set([...((profile && profile.cosmetics && profile.cosmetics.unlocked) || []), item.id])] };
    const ts = { ...trainerRef.current, xp_chips: Math.max(0, ((trainerRef.current && trainerRef.current.xp_chips) || 0) - item.price) };
    setProfile((p) => ({ ...p, cosmetics: cos }));
    saveTrainer(ts);
    if (profile) dbUpdate("users", `id=eq.${profile.id}`, { cosmetics: cos });
  }} />;
  else if (screen === "profile") body = <ProfileScreen user={user} rating={rating} ratingHistory={ratingHistory} sessions={sessions} progress={progress} answers={answers} lifetime={lifetime} onSignOut={signOut} onDeleteAccount={handleDeleteAccount} tendencies={tendencies} cosmetics={profile ? profile.cosmetics : {}} trainer={trainerState} go={go} onCosmetic={(k, v) => {
    const cos = { ...((profile && profile.cosmetics) || {}), [k]: v };
    COSMETICS[k === "back" ? "back" : "felt"] = v || (k === "back" ? "classic" : null);
    setProfile((p) => ({ ...p, cosmetics: cos }));
    if (profile) dbUpdate("users", `id=eq.${profile.id}`, { cosmetics: cos });
  }} />;
  else body = <HomeScreen user={user} sessions={sessions} lifetime={lifetime} rating={rating} onOpenHands={() => setShowHands(true)} go={go} streak={streak} streakDay={profile?.streak_day} daily={daily} trainerState={trainerState} ratingHistory={ratingHistory} sessionHandCount={daily.session ? 10 : Math.min((lastSession ? lastSession.stats.hands : 0), 10)} profile={profile} onClaimQuest={onClaimQuest} onDailyDrill={(family) => {
    const _drillToday = new Date().toISOString().slice(0, 10);
    const _dateSeed = (() => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); })();
    const list = family ? Array.from({ length: 10 }, (_, i) => genPuzzle(mulberry32(_dateSeed + i + 1337), family, 0.6)) : dailyPuzzles();
    const due = dueReviews(trainerRef.current);
    if (due.length) list[0] = genPuzzle(mulberry32(Date.now()), due[0], levelFor(trainerRef.current, due[0]));
    // Resume from where the user left off if they exited mid-drill today.
    const savedCount = (() => { try { const n = parseInt(localStorage.getItem("riq_drill_count_" + _drillToday), 10); return Number.isFinite(n) && n > 0 && n < list.length ? n : 0; } catch { return 0; } })();
    const prefilledResults = {};
    for (let i = 0; i < savedCount; i++) prefilledResults[i] = null;
    setPuzzleRun({ mode: "daily", list, idx: savedCount, results: prefilledResults });
    setScreen("puzzle");
  }} />;

  const showHandBtn = user && ["home", "lobby", "learn", "profile"].includes(screen);
  return (
    <div className="riq app-root" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(140% 100% at 50% 0%, #0A1A12 0%, #060D09 60%)", display: "flex", justifyContent: "center", alignItems: "stretch" }}>
      <style>{CSS}</style>
      <div className="felt-grain app-shell" style={{ position: "relative", width: "100%", maxWidth: 440, height: "100dvh", background: "radial-gradient(120% 80% at 50% -5%, #122A1F 0%, #0A1A12 55%, #060D09 100%)", overflow: "hidden" }}>
        <div className="orb" style={{ width: 480, height: 480, top: "-12%", left: "-18%", background: "rgba(18,70,45,0.32)", animation: "riqBgDrift0 38s ease-in-out infinite" }} />
        <div className="orb" style={{ width: 400, height: 400, bottom: "2%", right: "-16%", background: "rgba(10,50,30,0.28)", animation: "riqBgDrift1 44s ease-in-out infinite 6s" }} />
        <div className="orb" style={{ width: 320, height: 320, top: "36%", left: "42%", background: "rgba(201,165,70,0.09)", animation: "riqBgDrift2 32s ease-in-out infinite 14s" }} />
        <div key={screen} className="screen-in" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden", zIndex: 1 }}>{body}</div>
        {showHandBtn && <HandRankButton onOpen={() => setShowHands(true)} />}
        {showHandBtn && <RangeButton onOpen={() => setShowRanges(true)} />}
        {showHands && <HandRankSheet onClose={() => setShowHands(false)} />}
        {showRanges && <RangeSheet onClose={() => setShowRanges(false)} />}
        <FeedbackWidget screen={screen} profile={profile} rating={rating} />
        {user && !["module", "mptable", "puzzle"].includes(screen) && (
          <NavBar screen={screen} go={go} alerts={{ learn: dueReviews(trainerState).length > 0, home: questClaimable(trainerState) }} />
        )}
        {user && badgeQueue.length > 0 && !celebration && <BadgeToast badge={badgeQueue[0]} onDone={() => setBadgeQueue((q) => q.slice(1))} />}
        {user && <CelebrationOverlay celeb={celebration} onClose={() => setCelebration(null)} />}
        {tourStep !== null && (
          <TourOverlay
            step={tourStep}
            onNext={() => setTourStep((s) => Math.min(s + 1, TOUR_STEPS.length - 1))}
            onSkip={() => setTourStep(null)}
          />
        )}
      </div>
    </div>
  );
}
