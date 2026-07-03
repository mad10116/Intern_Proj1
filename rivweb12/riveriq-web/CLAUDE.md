# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install      # first-time setup
npm run dev      # dev server at http://localhost:5173
npm run build    # production build → dist/
npm run preview  # serve the dist/ build locally
```

No linter or test suite is configured.

## Architecture

**Everything lives in one file: `src/RiverIQ.jsx`** (~3 600 lines). The entry point `src/main.jsx` mounts the default export `App`. There is no routing library, no CSS files, and no component split across files — all styles are a single CSS template literal injected via a `<style>` tag inside `App`.

### Section layout of RiverIQ.jsx (top → bottom)

| Lines (approx) | What's there |
|---|---|
| 1–75 | Theme object `T`, CSS string, constants (`SB`, `BB`, `START_STACK`, `UNLOCK_ALL_FOR_TESTING`) |
| 76–188 | Pure card engine: `newDeck`, `shuffle`, `evaluate5`, `bestScore`, `handName`, `equityMC` (Monte Carlo), `chenScore` |
| 190–310 | AI opponent: `PERSONALITIES`, `TIER_POOLS`, `buildOpponents`, `decideAI` |
| 312–394 | Supabase backend: `sbFetch`, `sbRefresh`, `sbSignUp`, `sbSignIn`, `dbSelect/Insert/Upsert/Update`, `ensureProfile` |
| 396–521 | Pure game engine: `dealHand`, `applyAction`, `endStreet`, `showdown` |
| 523–1163 | Hand/session analysis: `assessHero`, `analyzeSession`, Glicko rating helpers (`edgeUpdate`), leak detection, `makePlan` |
| 1164–1383 | Shared UI primitives: `PlayingCard`, `Btn`, `StatChip`, `NavBar`, `Seat`, `StrengthStrip` |
| 1384–1472 | `PlayScreen` — the live poker table UI |
| 1473–1926 | Puzzle engine: seeded RNG (`mulberry32`), puzzle generators (`puzzleOpen`, `puzzleOdds`, `puzzleValue`, `genMultiway`, `genMultiStreet`, `genSizing`, `genBBDefend`, `genShove`), spaced-repetition scheduler |
| 1927–2125 | `PuzzleScreen`, `PuzzleReviewScreen` |
| 2126–3549 | Screen components: `LeaderboardScreen`, `AuthScreen`, `HomeScreen`, `Lobby`, `ReviewScreen`, `ReplayScreen`, `LearnScreen`, `ModuleScreen`, `ProfileScreen`, `MpSetup`, `MpTableScreen`, `MpReviewScreen`, overlay sheets |
| 3551–end | `App()` root — all global state, screen routing switch, effect hooks |

### Screen routing

`App` holds a `screen` string state. Valid values: `home`, `lobby`, `play`, `review`, `learn`, `module`, `profile`, `leaderboard`, `auth`, `replay`, `puzzle`, `puzzle-review`, `mp-setup`, `mp-table`, `mp-review`.

`NavBar` renders tabs for `play`, `learn`, `profile`. The `go` callback passed down everywhere is just `setScreen`.

### Backend (Supabase — no SDK, raw REST)

- URL and publishable key are hardcoded at the top of `RiverIQ.jsx` (safe — protected by Supabase RLS).
- `sbFetch` wraps every call with the auth header and auto-refreshes on 401.
- Auth session is stored in `localStorage` under `riq_session`.
- OAuth: only Google is active; Apple provider is wired but not configured in Supabase yet.
- Tables: see **Database Structure** section below.
- Multiplayer uses Supabase Realtime (channel `mp_table:{id}`) polled in `MpTableScreen`.

### Engagement systems (all state in `users.trainer_state` jsonb — no schema changes)

- **Chips**: `xp_chips` = spendable balance, `xp_total` = lifetime earned (never decreases). `awardChips()` is the single entry point; it also feeds the daily-chips goal and the "chips" quest.
- **Levels**: derived from `xp_total` via `levelInfo()`; `LevelRing` renders on Home/Profile; crossing a level fires a `CelebrationOverlay`.
- **Quests**: 3/day, date-seeded from `QUEST_POOL` (`dailyQuestSet`). Progress in `trainer_state.quests {date, progress, claimed}`; bump via `bumpQuest(ts, type, n)`, claim via `claimQuest`. Wired into: hand recording (`hands`/`wins`), puzzle answers (`puzzles`), drill completion (`drill`), `completeModule` (`lesson`), `awardChips` (`chips`).
- **Badges**: `BADGES` catalog + `checkBadges(ts, badgeCtx(...))`; earned ids stored in `trainer_state.badges {id: dateISO}`. New badges queue a `BadgeToast`. All reward mutations flow through `commitTrainer()` in `App` (badge sweep + level detection; `deferSave` skips the per-event DB write).
- **Learn tab**: `LearnScreen` is a Duolingo-style serpentine node path (chapter banners, START bubble on the frontier module from `getFrontier`, mastery stars from `trainer_state.mastery`, trophies per chapter). A spaced-repetition "Review due" banner shows when `dueReviews()` is non-empty.
- **Celebrations**: streak banking and level-ups render `CelebrationOverlay` (confetti); streak-at-risk banner appears on Home after 17:00 when the day isn't banked.

### Rating system

- `skill_rating` (integer) stored in `users` table; displayed as RiverIQ rating.
- Glicko parameters (`phi`, `sigma`, `rolling_var`, `shields`, `rating_n`) stored as JSON in `users.trainer_state`.
- `edgeUpdate` in `RiverIQ.jsx` is the Glicko update function called at session end.
- Streak shields auto-consume on login if the user missed 1–2 days.

### PWA

- `public/sw.js` caches the app shell for offline use; live API calls always bypass the cache.
- `public/manifest.json` + iOS meta tags in `index.html` enable Add to Home Screen on both platforms.
- Cache version string is `"riveriq-v1"` in `sw.js` — bump it when deploying breaking changes.

## Database Structure

Supabase project: `oulxmmijmtmbdubyjuvx` (region: ap-northeast-2). RLS is enabled on every table. All `id` primary keys are `uuid` unless noted otherwise.

### `users`
References `auth.users(id)`. One row per authenticated user.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | mirrors `auth.users.id` |
| `username` | text UNIQUE | |
| `email` | text | nullable |
| `skill_rating` | numeric | Glicko rating displayed as RiverIQ score; default 50 (migrated to 1000 on first login) |
| `subscription_tier` | text | `'free'` \| `'premium'` \| `'premium_plus'`; default `'free'` |
| `streak` | int | consecutive daily-activity days |
| `streak_day` | text | ISO date string of last streak day (nullable) |
| `cosmetics` | jsonb | `{ back: string, felt: string\|null }`; default `{}` |
| `trainer_state` | jsonb | Glicko params + feature state: `{ phi, sigma, rolling_var, shields, rating_n, … }`; default `{}` |
| `week_rating` | numeric | nullable; cached weekly leaderboard rating |
| `week_start` | text | nullable; ISO date of the week `week_rating` belongs to |
| `created_at` | timestamptz | default `now()` |

### `sessions`
One row per solo-play session.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | default `gen_random_uuid()` |
| `user_id` | uuid FK → `users.id` | |
| `started_at` | timestamptz | default `now()` |
| `ended_at` | timestamptz | nullable; null while session is live |
| `hands_played` | int | default 0 |
| `net_chips` | int | default 0 |
| `stake_level` | text | default `'play_money'` |
| `profile_synced` | bool | whether this session's stats have been rolled into `player_profiles`; default false |

### `hands`
One row per hand within a solo session.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK → `sessions.id` | |
| `hand_number` | int | sequential within session |
| `hero_cards` | jsonb | array of card objects `[{r, s}, {r, s}]` |
| `board_cards` | jsonb | array of 0–5 card objects |
| `pot_size` | int | final pot |
| `result_chips` | int | hero's chip delta for the hand |
| `street_reached` | text | `'preflop'` \| `'flop'` \| `'turn'` \| `'river'` \| `'result'` |
| `created_at` | timestamptz | default `now()` |

### `actions`
One row per hero action within a hand.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `hand_id` | uuid FK → `hands.id` | |
| `street` | text | `'preflop'` \| `'flop'` \| `'turn'` \| `'river'` |
| `action_type` | text | constrained: `'fold'` \| `'check'` \| `'call'` \| `'raise'` |
| `amount` | int | nullable; chip amount for call/raise |
| `is_optimal` | bool | nullable; whether `assessHero` graded this action correct |
| `ev_loss` | numeric | nullable; estimated EV lost on a mistake |

### `leaks`
Aggregated leak tracking per user, updated each session.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `users.id` | |
| `leak_type` | text | leak family ID (e.g. `'overfold'`, `'bluff_too_much'`) |
| `deviation_pct` | numeric | how far the stat deviates from baseline |
| `sessions_tracked` | int | number of sessions this leak has been observed; default 1 |
| `updated_at` | timestamptz | default `now()` |

### `learn_progress`
One row per user × module completion.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `users.id` | |
| `module_id` | text | matches module IDs in the `LEARN_MODULES` constant in `RiverIQ.jsx` |
| `completed_at` | timestamptz | nullable |
| `drill_score` | int | nullable; score on the module's drill |

### `player_profiles`
Aggregated stats per user (PK is `user_id`, not a surrogate).

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid PK FK → `users.id` | |
| `hands` | int | lifetime hands played; default 0 |
| `metrics` | jsonb | arbitrary stat object (VPIP, PFR, aggression freq, etc.); default `{}` |
| `updated_at` | timestamptz | default `now()` |

### `tables`
Multiplayer table lobby entries.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `table_code` | text UNIQUE | short join code shown to players |
| `created_by` | uuid FK → `users.id` | nullable |
| `host` | uuid FK → `users.id` | nullable |
| `stake_level` | text | default `'play_money'` |
| `max_players` | int | default 6 |
| `min_hands` | int | minimum hands before a player can leave; default 0 |
| `status` | text | `'open'` \| `'running'` \| `'closed'`; default `'open'` |
| `game_state` | jsonb | nullable; full live game state blob pushed by the host |
| `created_at` | timestamptz | default `now()` |

### `table_players`
Seat assignments for a multiplayer table.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `table_id` | uuid FK → `tables.id` | |
| `user_id` | uuid FK → `users.id` | |
| `seat_position` | int | 0–5 |
| `stack` | int | current chip count; default 2000 |
| `joined_at` | timestamptz | default `now()` |

### `table_private`
Server-authoritative game state hidden from non-host clients (PK is `table_id`).

| Column | Type | Notes |
|---|---|---|
| `table_id` | uuid PK FK → `tables.id` | |
| `state` | jsonb | full private game state (hole cards, deck, etc.) |
| `updated_at` | timestamptz | default `now()` |

### `table_hands`
Hand history log for multiplayer tables.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `table_id` | uuid FK → `tables.id` | |
| `hand_no` | int | sequential within table |
| `detail` | jsonb | complete hand record blob |
| `created_at` | timestamptz | default `now()` |

### `feedback`
In-app feedback submissions.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `users.id` | nullable (allows anonymous) |
| `screen` | text | nullable; which screen the user was on |
| `category` | text | nullable |
| `message` | text | |
| `app_context` | jsonb | nullable; `{ rating, at }` snapshot at submission time |
| `created_at` | timestamptz | default `now()` |

### `decision_log`
Granular per-decision audit log (currently empty — reserved for future analytics).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `users.id` | nullable |
| `session_id` | uuid FK → `sessions.id` | nullable |
| `hand_no` | int | nullable |
| `street` | text | nullable |
| `decision_type` | text | nullable |
| `hero_action` | text | nullable |
| `hero_cards` | text | nullable |
| `board` | text | nullable |
| `position` | text | nullable |
| `pot` | int | nullable |
| `bet_facing` | int | nullable |
| `bet_made` | int | nullable |
| `hero_equity` | numeric | nullable |
| `threshold` | numeric | nullable |
| `margin` | numeric | nullable |
| `pot_weight` | numeric | nullable |
| `weighted_score` | numeric | nullable |
| `opp_profile` | jsonb | nullable |
| `players_in_hand` | int | nullable |
| `hand_net` | int | nullable |
| `showdown` | bool | nullable |
| `created_at` | timestamptz | default `now()` |

### Foreign key map (summary)

```
auth.users
  └─ users.id

users
  ├─ sessions.user_id
  │    ├─ hands.session_id
  │    │    └─ actions.hand_id
  │    └─ decision_log.session_id
  ├─ leaks.user_id
  ├─ learn_progress.user_id
  ├─ player_profiles.user_id
  ├─ feedback.user_id
  ├─ decision_log.user_id
  ├─ tables.created_by
  ├─ tables.host
  └─ table_players.user_id

tables
  ├─ table_players.table_id
  ├─ table_private.table_id (1-to-1)
  └─ table_hands.table_id
```

## Key flag before production launch

```js
// src/RiverIQ.jsx line ~25
const UNLOCK_ALL_FOR_TESTING = true;  // ← set to false before real launch
```

This bypasses all progression gates (solo tiers, learn modules) so every feature can be exercised during development.
