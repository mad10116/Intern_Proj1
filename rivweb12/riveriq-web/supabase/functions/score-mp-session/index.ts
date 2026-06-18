// supabase/functions/score-mp-session/index.ts
// Retroactively scores every hero decision in a multiplayer session:
//   1. Reads table_hands (server-stored cards/board) — equity is trust-safe.
//   2. Pulls real opponent tendencies from player_profiles.
//   3. Tags each action (ruleId/tag/evLoss) and runs Glicko edge-rating update.
//   4. Writes new skill_rating to users if ≥ 12 scored decisions.
//   5. Returns annotated hands[] in analyzeSession-compatible format.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const BB = 100;
const START_STACK = 2000;

function resolveKey(
  jsonEnvVar: string,
  property: "anon" | "service_role",
  legacyEnvVar: string,
): string {
  const raw = Deno.env.get(jsonEnvVar);
  if (raw) {
    try {
      const p = JSON.parse(raw);
      if (p[property]) return p[property] as string;
    } catch { /* fall through */ }
  }
  const legacy = Deno.env.get(legacyEnvVar);
  if (legacy) return legacy;
  throw new Error(`Cannot resolve key: ${jsonEnvVar}[${property}] / ${legacyEnvVar}`);
}
const ANON_KEY = resolveKey("SUPABASE_PUBLISHABLE_KEYS", "anon", "SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = resolveKey("SUPABASE_SECRET_KEYS", "service_role", "SUPABASE_SERVICE_ROLE_KEY");

// ── Card engine (exact port from client) ──────────────────────────────────────
type Card = { r: number; s: number };
const cardKey = (c: Card) => `${c.r}-${c.s}`;

function newDeck(): Card[] {
  const d: Card[] = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s });
  return d;
}
function shuffle<T>(a: T[]): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function evaluate5(cs: Card[]): number {
  const rs = cs.map((c) => c.r).sort((a, b) => b - a);
  const flush = cs.every((c) => c.s === cs[0].s);
  const uniq = [...new Set(rs)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) straightHigh = 5;
  }
  const counts: Record<number, number> = {};
  rs.forEach((r) => (counts[r] = (counts[r] || 0) + 1));
  const groups = Object.entries(counts)
    .map(([r, c]) => ({ r: +r, c }))
    .sort((a, b) => b.c - a.c || b.r - a.r);
  let cat: number, tie: number[];
  if (straightHigh && flush)           { cat = 8; tie = [straightHigh]; }
  else if (groups[0].c === 4)          { cat = 7; tie = [groups[0].r, groups[1].r]; }
  else if (groups[0].c === 3 && groups[1].c === 2) { cat = 6; tie = [groups[0].r, groups[1].r]; }
  else if (flush)                      { cat = 5; tie = rs; }
  else if (straightHigh)               { cat = 4; tie = [straightHigh]; }
  else if (groups[0].c === 3)          { cat = 3; tie = [groups[0].r, groups[1].r, groups[2].r]; }
  else if (groups[0].c === 2 && groups[1].c === 2) { cat = 2; tie = [groups[0].r, groups[1].r, groups[2].r]; }
  else if (groups[0].c === 2)          { cat = 1; tie = [groups[0].r, groups[1].r, groups[2].r, groups[3].r]; }
  else                                 { cat = 0; tie = rs; }
  let score = cat;
  for (let i = 0; i < 5; i++) score = score * 15 + (tie[i] || 0);
  return score;
}
function bestScore(cards: Card[]): number {
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
function equityMC(hero: Card[], board: Card[], nOpp: number, iters = 400): number {
  if (nOpp <= 0) return 1;
  const used = new Set([...hero, ...board].map(cardKey));
  const rest = newDeck().filter((c) => !used.has(cardKey(c)));
  let pts = 0;
  for (let t = 0; t < iters; t++) {
    const d = shuffle(rest);
    let k = 0;
    const opps: Card[][] = [];
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

// ── Hand-code helpers & HAND_PCT ─────────────────────────────────────────────
const RANK_LABEL: Record<number, string> = {
  2:"2",3:"3",4:"4",5:"5",6:"6",7:"7",8:"8",9:"9",10:"T",11:"J",12:"Q",13:"K",14:"A",
};
function codeLabel(r: number): string { return RANK_LABEL[r] || String(r); }
function handCode(c1: Card, c2: Card): string {
  const hi = c1.r >= c2.r ? c1 : c2, lo = c1.r >= c2.r ? c2 : c1;
  if (hi.r === lo.r) return codeLabel(hi.r) + codeLabel(lo.r);
  return codeLabel(hi.r) + codeLabel(lo.r) + (hi.s === lo.s ? "s" : "o");
}
function chenScore(c1: Card, c2: Card): number {
  const hi = Math.max(c1.r, c2.r), lo = Math.min(c1.r, c2.r);
  const val = (r: number) =>
    r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2;
  let s = val(hi);
  if (c1.r === c2.r) return Math.max(5, s * 2) + (hi >= 11 ? 2 : 0);
  if (c1.s === c2.s) s += 2;
  const gap = hi - lo - 1;
  if (gap === 1) s -= 1;
  else if (gap === 2) s -= 2;
  else if (gap === 3) s -= 4;
  else if (gap >= 4) s -= 5;
  if (gap < 2 && hi < 12) s += 1;
  return Math.round(s * 2) / 2;
}
const HAND_PCT: Record<string, number> = (() => {
  const order = "23456789TJQKA";
  const rOf = (ch: string) => order.indexOf(ch) + 2;
  const items: { code: string; combos: number; chen: number }[] = [];
  for (let i = 12; i >= 0; i--)
    for (let j = i; j >= 0; j--) {
      const hiR = rOf(order[i]), loR = rOf(order[j]);
      if (i === j) {
        items.push({ code: order[i]+order[j], combos: 6, chen: chenScore({ r:hiR,s:0 }, { r:loR,s:1 }) });
      } else {
        items.push({ code: order[i]+order[j]+"s", combos: 4, chen: chenScore({ r:hiR,s:0 }, { r:loR,s:0 }) });
        items.push({ code: order[i]+order[j]+"o", combos:12, chen: chenScore({ r:hiR,s:0 }, { r:loR,s:1 }) });
      }
    }
  items.sort((a, b) => b.chen - a.chen);
  const total = items.reduce((s, x) => s + x.combos, 0);
  let cum = 0;
  const map: Record<string, number> = {};
  items.forEach((x) => { map[x.code] = cum / total; cum += x.combos; });
  return map;
})();

// ── Opening ranges ────────────────────────────────────────────────────────────
function expandRange(str: string): Set<string> {
  const order = "23456789TJQKA";
  const set = new Set<string>();
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
const OPEN_RANGE: Record<string, Set<string>> = {
  UTG: expandRange("77+ ATs+ KTs+ QTs+ JTs T9s 98s AJo+ KQo"),
  HJ:  expandRange("66+ A9s+ KTs+ QTs+ J9s+ T9s 98s 87s ATo+ KJo+ QJo"),
  CO:  expandRange("44+ A2s+ K9s+ Q9s+ J9s+ T8s+ 97s+ 87s 76s 65s A9o+ KTo+ QTo+ JTo"),
  BTN: expandRange("22+ A2s+ K2s+ Q5s+ J7s+ T7s+ 96s+ 86s+ 75s+ 65s 54s A2o+ K9o+ Q9o+ J9o+ T9o 98o"),
  SB:  expandRange("22+ A2s+ K5s+ Q7s+ J8s+ T8s+ 97s+ 87s 76s 65s A7o+ K9o+ Q9o+ JTo"),
};
const OPEN_PCT: Record<string, number> = { UTG:0.15, HJ:0.19, CO:0.27, BTN:0.43, SB:0.36 };

// ── Position ──────────────────────────────────────────────────────────────────
const POS_FROM_BTN = ["BTN", "SB", "BB", "UTG", "HJ", "CO"];
function seatPos(heroSeat: number, buttonSeat: number): string {
  return POS_FROM_BTN[((heroSeat - buttonSeat) % 6 + 6) % 6];
}

// ── Edge scoring constants & helpers ─────────────────────────────────────────
const EDGE_POP = { aggF: 0.45, aggT: 0.40, aggR: 0.35, pfr: 0.22 };
type OppTendency = typeof EDGE_POP;

function edgeBoardWet(board: Card[]): boolean {
  if (!board || board.length < 3) return false;
  const suits: Record<number, number> = {};
  board.forEach((c) => (suits[c.s] = (suits[c.s] || 0) + 1));
  if (Object.values(suits).some((n) => n >= 3)) return true;
  const rs = board.map((c) => c.r).sort((a, b) => a - b);
  for (let i = 0; i + 2 < rs.length; i++) if (rs[i + 2] - rs[i] <= 4) return true;
  return false;
}

// ── Action & hand types ───────────────────────────────────────────────────────
type HeroAction = {
  idx: 0;
  street: string;
  type: string;
  potBefore: number;
  toCall: number;
  amount: number | null;
  board: number;          // board-card count at action time (for edgeScoreAction)
  eq: number;
  oppTendency: OppTendency;
  evLoss: number;
  tag: string | null;
  ruleId: string | null;
  better: string | null;
  potOdds: number;
  estimate: boolean;
};
type HeroHand = {
  handNo: number;
  pos: string;
  heroCards: Card[];
  board: Card[];
  net: number;
  wentToShowdown: boolean;
  actions: HeroAction[];
};

// ── Edge scoring (exact port from client edgeScoreAction) ─────────────────────
// deno-lint-ignore no-explicit-any
function edgeScoreAction(a: HeroAction, hand: HeroHand): Record<string, any> | null {
  const { street, potBefore: pot, toCall, eq: e, board: boardLen, amount, oppTendency: opp } = a;
  const wPot = pot / START_STACK;
  const code = handCode(hand.heroCards[0], hand.heroCards[1]);
  const h = HAND_PCT[code] ?? 0.8;
  const base = { handNo: hand.handNo, street, action: a.type, pot, toCall, eq: e, wPot, opp, code };

  // Type A: postflop call/fold vs pot-odds (tendency-adjusted)
  if (street !== "preflop" && toCall > 0 && e != null && (a.type === "call" || a.type === "fold")) {
    const Tbase = toCall / (pot + toCall + toCall);
    const aggKey = street === "flop" ? "aggF" : street === "turn" ? "aggT" : "aggR";
    const aggDelta = (opp[aggKey as keyof OppTendency] ?? EDGE_POP[aggKey as keyof OppTendency])
                   - EDGE_POP[aggKey as keyof OppTendency];
    let T = Tbase - aggDelta * 0.18;
    T = Math.max(Tbase - 0.08, Math.min(Tbase + 0.08, T));
    const margin = a.type === "call" ? e - T : T - e;
    return { ...base, type: "A", threshold: T, margin, score: margin * wPot };
  }

  // Type D: postflop bet sizing vs board-texture band
  if (street !== "preflop" && a.type === "raise" && toCall === 0 && e != null && (e >= 0.65 || e <= 0.35)) {
    const boardSlice = hand.board.slice(0, boardLen);
    const wet = edgeBoardWet(boardSlice);
    const band = e >= 0.65
      ? (wet ? [0.60, 0.95] : (street === "river" ? [0.55, 0.85] : [0.45, 0.75]))
      : (wet ? [0.55, 0.85] : [0.40, 0.70]);
    const frac = pot > 0 ? (amount || 0) / pot : 0;
    let margin: number;
    if (frac >= band[0] && frac <= band[1]) margin = 0.06;
    else if (frac < band[0])               margin = -(band[0] - frac);
    else                                   margin = -(frac - band[1]) * 0.65;
    return { ...base, type: "D", threshold: band[0], margin, score: margin * wPot };
  }

  // Type B: preflop open/fold in unraised pot
  if (street === "preflop" && toCall <= BB) {
    if (a.type !== "raise" && a.type !== "fold" && a.type !== "call") return null;
    const Tpos = OPEN_PCT[hand.pos] ?? 0.3;
    if (a.type === "fold" && h > 0.60) return null; // trivial junk fold: not scored
    let margin: number;
    if (a.type === "raise")      margin = Tpos - h;
    else if (a.type === "fold")  margin = h - Tpos;
    else                         margin = h <= Tpos ? -0.06 : -(h - Tpos) - 0.06;
    return { ...base, type: "B", threshold: Tpos, margin, score: margin * wPot };
  }

  // Type C: preflop facing a raise (PFR-adjusted defend range)
  if (street === "preflop" && toCall > BB) {
    const pfrDelta = (opp.pfr ?? EDGE_POP.pfr) - EDGE_POP.pfr;
    let Td = 0.42 - Math.max(-0.04, Math.min(0.04, pfrDelta * 0.20));
    if (hand.pos === "SB")      Td *= 0.82;
    else if (hand.pos !== "BB") Td *= 0.65;
    Td = Math.max(0.30, Math.min(0.55, Td));
    const margin = (a.type === "call" || a.type === "raise") ? Td - h : h - Td;
    return { ...base, type: "C", threshold: Td, margin, score: margin * wPot };
  }

  return null;
}

function edgeSession(hands: HeroHand[]): { decisions: Record<string, unknown>[]; count: number; A: number } {
  const decisions: Record<string, unknown>[] = [];
  hands.forEach((hand) => {
    hand.actions.forEach((a) => {
      const d = edgeScoreAction(a, hand);
      if (d) {
        d.handNet = hand.net;
        d.showdown = !!hand.wentToShowdown;
        decisions.push(d);
      }
    });
  });
  const sub = (list: Record<string, unknown>[]) => {
    const pos = list.filter((d) => (d.score as number) > 0).reduce((s, d) => s + (d.score as number), 0);
    const neg = list.filter((d) => (d.score as number) < 0).reduce((s, d) => s - (d.score as number), 0);
    return pos + neg > 0 ? pos / (pos + neg) : null;
  };
  const A = Math.max(0.05, Math.min(0.98, sub(decisions) ?? 0.5));
  return { decisions, count: decisions.length, A };
}

// ── Glicko-style update (exact port from client edgeUpdate) ────────────────────
function edgeUpdate(
  ts: Record<string, unknown>,
  A: number,
  mu: number,
): { mu: number; delta: number; phi: number; sigma: number; rollingVar: number; n: number } {
  const n = ((ts.rating_n as number) || 0) + 1;
  const Rs = 400 + 2400 * Math.pow(A, 2.2);
  const delta0 = Rs - mu;
  const rv0 = ts.rolling_var != null
    ? (ts.rolling_var as number)
    : (n === 1 ? Math.pow(Rs - 1000, 2) : 90000);
  const rollingVar = n === 1
    ? Math.pow(Rs - 1000, 2)
    : 0.85 * rv0 + 0.15 * delta0 * delta0;
  const sigma = Math.max(0.10, Math.min(0.90, Math.sqrt(rollingVar) / 500));
  const K = Math.max(0.08, Math.min(0.45, sigma / Math.sqrt(n)));
  const cap = n <= 10 ? 180 : 120;
  const delta = Math.round(Math.max(-cap, Math.min(cap, K * delta0)));
  const newMu = Math.max(400, Math.min(2800, Math.round(mu + delta)));
  const prevPhi = (ts.phi as number) ?? 350;
  const phi = Math.max(50, prevPhi * 0.88 + 12);
  return { mu: newMu, delta, phi: Math.round(phi), sigma: +sigma.toFixed(3), rollingVar: Math.round(rollingVar), n };
}

// ── Action tagging (server-side port of client assessHero) ────────────────────
function assessActionServer(
  a: HeroAction,
  heroCards: Card[],
  pos: string,
  eq: number,
): Pick<HeroAction, "tag" | "ruleId" | "evLoss" | "better" | "potOdds" | "estimate"> {
  const { type, potBefore: pot, toCall, street, amount } = a;
  const code = handCode(heroCards[0], heroCards[1]);
  const pct = HAND_PCT[code] ?? 0.8;
  const facingRaise = toCall > BB;
  let tag: string | null = null, ruleId: string | null = null, evLoss = 0, better: string | null = null;

  if (street === "preflop") {
    if (!facingRaise) {
      const range = OPEN_RANGE[pos];
      const inR = range ? range.has(code) : true;
      if (type === "raise" && range && !inR) {
        tag = "loose_open"; ruleId = "open_" + pos;
        evLoss = Math.min(3, Math.max(0.4, (pct - (OPEN_PCT[pos] || 0.3)) * 6));
        better = "fold and wait for a better spot";
      } else if (type === "call" && pos !== "BB" && pos !== "SB") {
        tag = "limp"; ruleId = "limp"; evLoss = 0.5;
        better = inR ? "raise, this hand is worth playing properly" : "fold";
      } else if (type === "call" && pos === "SB" && !(range && range.has(code))) {
        tag = "loose_call_pre"; ruleId = "sb_loose"; evLoss = 0.5; better = "fold";
      } else if (type === "fold" && pct <= 0.05 && toCall <= BB * 4) {
        tag = "fold_premium"; ruleId = "fold_premium"; evLoss = 2; better = "raise";
      }
    } else {
      if (type === "call" && pct > 0.22 && toCall > BB) {
        tag = "loose_call_pre"; ruleId = "vs_raise_loose";
        evLoss = Math.min(2.5, 0.4 + (pct - 0.22) * 5); better = "fold";
      } else if (type === "fold" && pct <= 0.035) {
        tag = "fold_premium"; ruleId = "fold_premium"; evLoss = 2.2; better = "re-raise";
      } else if (type === "raise" && pct > 0.25) {
        tag = "light_3bet"; ruleId = "light_3bet";
        evLoss = Math.min(4, 1 + (pct - 0.25) * 4); better = "fold";
      } else if (type === "raise" && pct > 0.12) {
        tag = "light_3bet"; ruleId = "light_3bet"; evLoss = 0.4; better = "just call";
      } else if (type === "fold" && pct <= 0.05 && toCall <= BB * 5) {
        tag = "fold_premium"; ruleId = "fold_premium"; evLoss = 1.2; better = "call or re-raise";
      }
    }
  } else {
    // Postflop: equity-based
    if (toCall > 0) {
      const evCall = eq * (pot + toCall) - toCall;
      if (type === "call" && evCall < -0.25 * BB) {
        tag = "loose_call"; ruleId = "call_noodds_" + street;
        evLoss = Math.min(6, -evCall / BB); better = "fold";
      } else if (type === "fold" && evCall > 0.5 * BB) {
        tag = "bad_fold"; ruleId = "overfold_" + street;
        evLoss = Math.min(6, evCall / BB); better = "call";
      } else if (type === "raise" && eq < 0.3) {
        tag = "bluff"; ruleId = "bluff_" + street;
        evLoss = Math.min(4, Math.max(0, 0.3 * ((amount || 0) / BB) * ((0.45 - eq) / 0.45)));
        better = "fold";
      }
    } else {
      if (type === "check" && eq > 0.72) {
        tag = "missed_value"; ruleId = "missed_value_" + street;
        evLoss = Math.min(2.5, Math.max(0.3, (0.3 * pot * (eq - 0.55)) / BB));
        better = "bet about half the pot";
      } else if (type === "raise" && eq < 0.3) {
        tag = "bluff"; ruleId = "bluff_" + street;
        evLoss = Math.min(3, Math.max(0, 0.2 * ((amount || 0) / BB) * ((0.45 - eq) / 0.45)));
        better = "check";
      }
    }
  }

  return {
    tag, ruleId, evLoss, better,
    potOdds: toCall > 0 ? toCall / (pot + toCall) : 0,
    estimate: !!(ruleId?.startsWith("missed_value")),
  };
}

// ── Opponent tendency from player_profiles ────────────────────────────────────
// Uncertainty-discounted: profile from 50+ hands gets full weight, fewer hands get less.
function buildOppTendency(profiles: Array<{ metrics: Record<string, number>; hands: number } | null>): OppTendency {
  let pfr = 0, aggF = 0, aggT = 0, aggR = 0, count = 0;
  for (const profile of profiles) {
    if (!profile) continue;
    const m = profile.metrics || {};
    const hands = Math.max(1, profile.hands || (m.hands as number) || 1);
    const discount = Math.min(1, hands / 50);
    const rawPfr = m.pfr_hands != null ? m.pfr_hands / hands : EDGE_POP.pfr;
    const bets = m.bets || 0, calls = m.calls || 0;
    const rawAgg = bets + calls > 0 ? bets / (bets + calls) : EDGE_POP.aggF;
    pfr  += EDGE_POP.pfr  + discount * (Math.max(0.06, Math.min(0.5,  rawPfr))       - EDGE_POP.pfr);
    aggF += EDGE_POP.aggF + discount * (Math.min(0.75, rawAgg * 0.90) - EDGE_POP.aggF);
    aggT += EDGE_POP.aggT + discount * (Math.min(0.70, rawAgg * 0.81) - EDGE_POP.aggT);
    aggR += EDGE_POP.aggR + discount * (Math.min(0.65, rawAgg * 0.72) - EDGE_POP.aggR);
    count++;
  }
  if (count === 0) return EDGE_POP;
  return { pfr: pfr/count, aggF: aggF/count, aggT: aggT/count, aggR: aggR/count };
}

// ── HTTP handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, apikey, content-type",
      },
    });
  }

  // 1. Authenticate caller
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Missing bearer token" }, 401);
  const userJwt = authHeader.replace("Bearer ", "");

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Invalid token" }, 401);
  const userId = user.id;

  // 2. Parse body
  const body = await req.json().catch(() => ({}));
  const { table_id } = body as { table_id?: string };
  if (!table_id) return json({ error: "table_id required" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3. Fetch table hands (ordered)
  const { data: tableHands } = await admin
    .from("table_hands")
    .select("hand_no,detail")
    .eq("table_id", table_id)
    .order("hand_no");

  if (!tableHands?.length) {
    return json({ hands: [], new_rating: null, rating_delta: 0, decisions_scored: 0 });
  }

  // 4. Fetch current user rating & trainer state
  const { data: userRows } = await admin
    .from("users")
    .select("skill_rating,trainer_state")
    .eq("id", userId)
    .limit(1);
  const userRow = userRows?.[0] ?? { skill_rating: 1000, trainer_state: {} };
  const currentRating = Math.max(400, Number(userRow.skill_rating) || 1000);
  const trainerState: Record<string, unknown> = (userRow.trainer_state as Record<string, unknown>) || {};

  // 5. Collect opponent user_ids across all hands
  const oppUserIds = new Set<string>();
  for (const th of tableHands) {
    // deno-lint-ignore no-explicit-any
    const detail = th.detail as any;
    if (!detail?.players) continue;
    for (const p of detail.players) {
      if (p.user_id && p.user_id !== userId) oppUserIds.add(p.user_id as string);
    }
  }

  // 6. Fetch opponent profiles (best-effort; missing profiles fall back to EDGE_POP)
  const profileMap = new Map<string, { metrics: Record<string, number>; hands: number }>();
  if (oppUserIds.size > 0) {
    const { data: profiles } = await admin
      .from("player_profiles")
      .select("user_id,metrics,hands")
      .in("user_id", [...oppUserIds]);
    for (const p of (profiles || [])) {
      profileMap.set(p.user_id as string, {
        metrics: (p.metrics as Record<string, number>) || {},
        hands: (p.hands as number) || 0,
      });
    }
  }

  // 7. Reconstruct hero hands from server-stored detail
  const heroHands: HeroHand[] = [];
  for (const th of tableHands) {
    // deno-lint-ignore no-explicit-any
    const detail = th.detail as any;
    if (!detail?.players || !Array.isArray(detail.log)) continue;

    // Find hero in this hand
    // deno-lint-ignore no-explicit-any
    const heroIdx: number = detail.players.findIndex((p: any) => p.user_id === userId);
    if (heroIdx === -1) continue; // hero sat out this hand

    // deno-lint-ignore no-explicit-any
    const heroPlayer = detail.players[heroIdx] as any;
    const heroCards: Card[] = heroPlayer.cards || [];
    if (heroCards.length !== 2) continue; // malformed — skip

    const heroSeat: number = heroPlayer.seat ?? heroIdx;
    const buttonSeat: number = detail.button ?? 0;
    const heroPos = seatPos(heroSeat, buttonSeat);
    const fullBoard: Card[] = detail.board || [];

    // Build single oppTendency for this hand (average of all opponents)
    // deno-lint-ignore no-explicit-any
    const oppProfiles = detail.players
      // deno-lint-ignore no-explicit-any
      .filter((_: any, i: number) => i !== heroIdx)
      // deno-lint-ignore no-explicit-any
      .map((p: any) => p.user_id ? (profileMap.get(p.user_id as string) ?? null) : null);
    const oppTendency = buildOppTendency(oppProfiles);

    // Walk log in order; track folded opponents to get accurate nOpp per action
    const foldedIdxs = new Set<number>();
    const heroActions: HeroAction[] = [];

    // deno-lint-ignore no-explicit-any
    for (const entry of detail.log as any[]) {
      // Track opponent folds before the hero acts
      if (entry.idx !== heroIdx && entry.type === "fold") {
        foldedIdxs.add(entry.idx as number);
      }
      if (entry.idx !== heroIdx) continue;

      // Count active (non-folded, non-hero) opponents at this moment
      const nOpp = detail.players.filter(
        // deno-lint-ignore no-explicit-any
        (_: any, i: number) => i !== heroIdx && !foldedIdxs.has(i),
      ).length;

      const boardLen: number = typeof entry.board === "number" ? entry.board : 0;
      const boardAtAction: Card[] = fullBoard.slice(0, boardLen);

      // Server-side equity: computed from server-stored cards — trust-safe
      const eq = equityMC(heroCards, boardAtAction, Math.max(1, nOpp), 400);

      const baseAction: HeroAction = {
        idx: 0,
        street: entry.street as string,
        type: entry.type as string,
        potBefore: (entry.potBefore as number) || 0,
        toCall: (entry.toCall as number) || 0,
        amount: entry.amount != null ? (entry.amount as number) : null,
        board: boardLen,
        eq,
        oppTendency,
        evLoss: 0, tag: null, ruleId: null, better: null, potOdds: 0, estimate: false,
      };

      // Tag the action (ruleId / tag / evLoss / better)
      const assess = assessActionServer(baseAction, heroCards, heroPos, eq);
      Object.assign(baseAction, assess);
      heroActions.push(baseAction);
    }

    heroHands.push({
      handNo: th.hand_no as number,
      pos: heroPos,
      heroCards,
      board: fullBoard,
      net: (heroPlayer.net as number) || 0,
      wentToShowdown: !heroPlayer.folded && !!detail.wentToShowdown,
      actions: heroActions,
    });
  }

  // 8. Aggregate edge session score
  const edge = edgeSession(heroHands);
  const decisionsScored = edge.count;

  // 9. Glicko update — only if enough decisions for a reliable sample
  let newRating: number | null = null;
  let ratingDelta = 0;
  if (decisionsScored >= 12) {
    const upd = edgeUpdate(trainerState, edge.A, currentRating);
    newRating = upd.mu;
    ratingDelta = upd.delta;
    const newTrainerState = {
      ...trainerState,
      phi: upd.phi,
      sigma: upd.sigma,
      rolling_var: upd.rollingVar,
      rating_n: upd.n,
    };
    await admin.from("users").update({
      skill_rating: newRating,
      trainer_state: newTrainerState,
    }).eq("id", userId);
  }

  return json({ hands: heroHands, new_rating: newRating, rating_delta: ratingDelta, decisions_scored: decisionsScored });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
