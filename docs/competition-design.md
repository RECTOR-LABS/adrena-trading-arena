# AI Trading Arena -- Competition Design Document

**Version**: 1.0
**Date**: March 2026
**Protocol**: [Adrena Protocol](https://adrena.xyz)
**Arena Program**: `PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6`

---

## Executive Summary

The AI Trading Arena is a competitive platform where autonomous trading agents battle each other on Adrena Protocol's perpetual exchange. Users deploy configurable strategies -- or write their own -- that execute real trades on Adrena's on-chain perps. Agents are scored on **risk-adjusted performance**, not raw P&L, rewarding disciplined risk management over reckless leverage chasing.

Adrena's existing competition infrastructure (Mutagen points, P&L leaderboards, streaks, quests, raffles) drove 50% of trading volume in 2025. The Arena extends this success into a new dimension: **24/7 autonomous volume generation**. Unlike human traders who sleep, AI agents trade around the clock -- generating continuous fees, TVL, and engagement for the protocol. This is the first AI agent trading competition on any Solana perpetual DEX.

The Arena creates a composable, extensible competition framework built on three layers: an on-chain Anchor program for trustless agent identity and prize escrow, an off-chain Rust orchestrator for position monitoring and scoring, and a Next.js dashboard for live spectating. Every component is production-grade, tested, and designed to integrate cleanly with Adrena's existing keeper infrastructure.

---

## 1. Competition Architecture

### 1.1 System Overview

The Arena is a three-layer system. The on-chain program owns the source of truth for agent identity, competition state, and prize funds. The orchestrator handles the computationally intensive work -- monitoring positions via gRPC, computing scores, managing lifecycle transitions. The frontend delivers the spectator experience.

```
+-----------------------------------------------------------+
|                     FRONTEND (Next.js 14)                  |
|  Arena Home | Competitions | Battle View | Agent Profiles  |
|  Strategy Builder | Rankings | Wallet Integration          |
+----------------------------+------------------------------+
                             |
                      REST + SSE (live)
                             |
+----------------------------+------------------------------+
|                  ORCHESTRATOR (Rust / Axum)                 |
|  Position Monitor (gRPC) | Scoring Engine | Lifecycle FSM  |
|  REST API + SSE | PostgreSQL | Config Management           |
+---------------+---------------------------+----------------+
                |                           |
           Solana RPC                  Yellowstone gRPC
                |                           |
+---------------+----------+  +-------------+----------------+
|    ARENA PROGRAM         |  |     ADRENA PROGRAM           |
|    (Anchor / Solana)     |  |     (existing, 101 ixs)      |
|                          |  |                              |
|  - Agent NFTs            |  |  - open...WithSwapLong/Short |
|    (Metaplex Core)       |  |  - closePositionLong/Short   |
|  - Competition accounts  |  |  - Position PDAs             |
|  - Prize vault (PDA)     |  |  - UserProfile + Mutagen     |
|  - Enrollment tracking   |  |  - Pool / Custody accounts   |
|  - Score attestation     |  |                              |
+--------------------------+  +------------------------------+
```

**Data flow for a competition:**

1. Authority creates a competition on-chain (format, fees, timing, scoring params)
2. Users mint Agent NFTs and enroll, paying entry fees to the PDA prize vault
3. Authority starts the competition; orchestrator begins monitoring positions via gRPC
4. Agents execute trades on Adrena via the SDK's AgentExecutor (tick-based loop)
5. Orchestrator snapshots positions, tracks equity curves, records trades in PostgreSQL
6. At competition end, orchestrator computes Arena Scores and submits them on-chain
7. Authority settles; winners claim prizes via PDA-signed token transfers

### 1.2 On-Chain Components

The Arena program (`PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6`) is an Anchor program with 11 instructions and 4 state account types.

**Arena Singleton** -- Protocol-level configuration, one per deployment.

| Field | Type | Description |
|-------|------|-------------|
| `authority` | `Pubkey` | Admin wallet that can create/manage competitions |
| `agent_count` | `u64` | Total agents ever created |
| `competition_count` | `u64` | Total competitions ever created (used as sequential ID) |
| `protocol_fee_bps` | `u16` | Protocol fee in basis points |
| `bump` | `u8` | PDA bump seed |

PDA seeds: `["arena"]`

**Agent Account** -- Per-agent state, linked to a Metaplex Core NFT.

| Field | Type | Description |
|-------|------|-------------|
| `owner` | `Pubkey` | Wallet that owns this agent |
| `mint` | `Pubkey` | Metaplex Core asset address (the NFT) |
| `strategy_hash` | `[u8; 32]` | SHA-256 hash of the strategy config |
| `elo_rating` | `u32` | Current ELO (starts at 1000) |
| `wins` | `u32` | Career wins |
| `losses` | `u32` | Career losses |
| `total_pnl` | `i64` | Lifetime P&L (in token micro-units) |
| `total_trades` | `u32` | Lifetime trade count |
| `competitions_entered` | `u32` | Total enrollments |
| `status` | `AgentStatus` | Active, Suspended, or Retired |
| `created_at` | `i64` | Unix timestamp |
| `bump` | `u8` | PDA bump seed |

PDA seeds: `["agent", asset_pubkey]`

Each Agent is backed by a Metaplex Core NFT (no collection, lightweight, no Token Metadata overhead). The NFT gives the agent a transferable on-chain identity -- agents can be traded, and their track record travels with them.

**Competition Account** -- Per-competition state, including escrow configuration.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `u64` | Sequential ID from `arena.competition_count` |
| `name` | `String` (max 32) | Human-readable competition name |
| `arena` | `Pubkey` | Parent Arena account |
| `authority` | `Pubkey` | Competition authority |
| `format` | `CompetitionFormat` | Season, FlashDuel, Bracket, or Sandbox |
| `status` | `CompetitionStatus` | Pending, Registration, Active, Scoring, or Settled |
| `entry_fee` | `u64` | Fee per agent (in prize token units) |
| `prize_pool` | `u64` | Total accumulated from entry fees |
| `max_agents` | `u32` | Capacity (max 256) |
| `registered_count` | `u32` | Current enrollment count |
| `start_time` | `i64` | Competition start (Unix timestamp) |
| `end_time` | `i64` | Competition end (Unix timestamp) |
| `scoring_params` | `ScoringParams` | min_trades, max_leverage, position_size_cap |
| `prize_mint` | `Pubkey` | SPL token mint for prizes |
| `prize_vault` | `Pubkey` | PDA-owned token account holding prize pool |
| `bump` | `u8` | PDA bump seed |

PDA seeds: `["competition", arena_pubkey, id_le_bytes]`

The prize vault is a PDA-owned token account: `["prize_vault", competition_pubkey]`. The competition PDA itself is the vault authority, enabling trustless prize distribution via CPI with signer seeds.

**Enrollment Account** -- Per-agent-per-competition state.

| Field | Type | Description |
|-------|------|-------------|
| `agent` | `Pubkey` | Agent PDA |
| `competition` | `Pubkey` | Competition PDA |
| `enrolled_at` | `i64` | Enrollment timestamp |
| `final_score` | `i64` | Arena Score (set during scoring) |
| `final_rank` | `u32` | Final placement (set during scoring) |
| `prize_amount` | `u64` | Tokens owed (set during scoring) |
| `status` | `EnrollmentStatus` | Enrolled, Disqualified, Scored, or Claimed |
| `bump` | `u8` | PDA bump seed |

PDA seeds: `["enrollment", competition_pubkey, agent_pubkey]`

**Instructions:**

| Instruction | Signer | Description |
|-------------|--------|-------------|
| `initialize_arena` | Authority | Creates the Arena singleton with protocol fee config |
| `create_agent` | Owner | Mints a Metaplex Core NFT + initializes Agent account |
| `update_agent_strategy` | Owner | Updates strategy hash (only when not in active competition) |
| `retire_agent` | Owner | Sets agent status to Retired (permanent) |
| `create_competition` | Authority | Creates competition + prize vault token account |
| `enroll_agent` | Owner | Transfers entry fee to vault, creates Enrollment |
| `start_competition` | Authority | Transitions Registration -> Active (requires 2+ agents) |
| `submit_scores` | Authority | Batched score submission (up to 32 per tx), transitions Active -> Scoring |
| `settle_competition` | Authority | Transitions Scoring -> Settled |
| `claim_prize` | Owner | Transfers prize from vault to owner (PDA-signed CPI) |
| `disqualify_agent` | Authority | Marks enrollment as Disqualified |

**Token compatibility**: Prize vaults use `token_interface` (`anchor_spl::token_interface`), supporting both Token Program and Token-2022 mints.

### 1.3 Off-Chain Components

**Arena Orchestrator** (Rust, Axum, PostgreSQL)

The orchestrator mirrors the on-chain competition state and adds the computational layer that would be impractical on-chain: position monitoring, equity curve tracking, score computation, and live data streaming.

- **gRPC Position Monitor**: Trait-based `PositionSubscriber` for subscribing to Adrena position account changes via Yellowstone gRPC. Position data includes owner, custody, side, size, collateral, entry/mark prices, unrealized P&L, and leverage.
- **Scoring Engine**: Pure functions that compute Net P&L, Max Drawdown, Sharpe Ratio, Win Rate, and the composite Arena Score. Decoupled from DB for testability.
- **Lifecycle State Machine**: Strict linear FSM (`Pending -> Registration -> Active -> Scoring -> Settled`) with no backward transitions and string-based persistence to PostgreSQL.
- **REST API**: Axum routes for competitions, agents, leaderboards, and health checks. SSE endpoint (`/api/competitions/{id}/live`) for real-time battle updates.
- **Database**: 6 PostgreSQL tables (agents, competitions, enrollments, position_snapshots, trades, equity_snapshots) with proper indexes for time-series queries.

**Agent SDK** (TypeScript)

The SDK provides everything needed to build, configure, and run trading agents:

- **ArenaStrategy Interface**: `{ name, evaluate(market) -> Signal, riskParams }` where Signal is `LONG | SHORT | CLOSE | HOLD`.
- **4 Preset Strategies**: Momentum (EMA crossover, configurable fast/slow periods), Mean Reversion (Bollinger Band bounce), Breakout (range detection + breakout entry), Scalper (RSI-based).
- **Technical Indicators**: SMA, EMA, Bollinger Bands, RSI -- all pure functions operating on price arrays.
- **ArenaClient**: SDK wrapper for all Arena program instructions (create agent, enroll, claim prize, etc.).
- **AdrenaWrapper**: Adapter for Adrena's trading instructions (open/close long/short positions, get position state).
- **PositionManager**: Risk enforcement layer -- validates leverage, position sizing, and stop-loss/take-profit before executing trades.
- **AgentExecutor**: Tick-based autonomous execution loop that combines strategy evaluation with trade execution on a configurable interval (default 30s-5min).
- **PriceFeed**: Pyth Hermes API integration for real-time price data, with mock provider for testing.

**Frontend Dashboard** (Next.js 14, Tailwind CSS, TradingView Lightweight Charts)

- **6 Pages**: Home (live competitions, featured agents), Competitions (browse/filter), Battle View (real-time P&L charts via SSE), Agent Creation (strategy wizard), Agent Profile (history + stats), Rankings (global ELO leaderboard).
- **Wallet Integration**: Solana wallet adapter with Phantom/Backpack/Solflare support.
- **Data Layer**: TanStack Query for server state, custom hooks (`useCompetitions`, `useAgent`, `useLeaderboard`, `useLiveUpdates`).
- **Design**: Dark arena-themed palette, responsive layout with arena-inspired visual language.

---

## 2. Competition Formats

### 2.1 Season Arena (Weekly/Monthly)

Long-running competitions for sustained strategy evaluation. Seasons mirror Adrena's existing season structure (e.g., "Awakening", "The Expanse") and provide the backbone for ongoing engagement.

| Parameter | Default | Range |
|-----------|---------|-------|
| Duration | 2 weeks | 1-4 weeks |
| Max Agents | 256 | 16-256 |
| Entry Fee | Configurable | 0+ (per prize mint) |
| Scoring Periods | Continuous | -- |

**Use case**: Primary competitive format. Agents run strategies continuously, accumulating trades and building equity curves. The longer duration rewards consistent strategies over lucky streaks.

**Division support**: Competitions can segment agents by ELO range, creating Bronze/Silver/Gold/Diamond divisions. Agents naturally graduate between divisions as their ELO shifts across seasons.

### 2.2 Flash Duel

Short, intense head-to-head or small-group competitions. Designed for quick engagement, social sharing, and high-frequency competition creation.

| Parameter | Default | Range |
|-----------|---------|-------|
| Duration | 4 hours | 1-24 hours |
| Max Agents | 8 | 2-32 |
| Entry Fee | Required | > 0 (stakes make it meaningful) |
| Format | Winner-takes-most | -- |

**Use case**: Quick engagements for marketing moments, community events, and protocol partnerships. Flash Duels can be created by any authority-approved wallet, enabling community-organized competitions.

**Prize structure**: Entry fees fund the pool. Default split: 60% first, 30% second, 10% third. For 1v1 duels: winner takes all.

### 2.3 Bracket Tournament

Elimination-style brackets where each round is a Flash Duel. Brackets create a narrative arc -- underdogs, upsets, and a climactic final match.

| Parameter | Default | Range |
|-----------|---------|-------|
| Bracket Size | 16 | 8/16/32/64 |
| Round Duration | 24 hours | 4-48 hours |
| Seeding | ELO-based | -- |
| Total Duration | ~4 days (16-bracket) | Varies |

**Use case**: Weekly/monthly championship events that drive peak engagement. Bracket tournaments can serve as season finales with elevated prize pools.

**Seeding**: Agents are seeded by ELO rating. Top seeds face bottom seeds in the first round. Bracket progression is automated by the orchestrator.

### 2.4 Sandbox

Free-play mode for strategy testing with no stakes. The onboarding funnel for new users who want to experiment before committing capital.

| Parameter | Default | Range |
|-----------|---------|-------|
| Duration | Unlimited | -- |
| Max Agents | 256 | -- |
| Entry Fee | 0 | 0 (always free) |
| Prizes | None | -- |

**Use case**: Strategy backtesting, learning the platform, iterating on parameters. Sandbox competitions still track scores and leaderboards, but with no financial risk. Agent stats from Sandbox mode are tracked separately from ranked competition stats.

---

## 3. Rules & Scoring

### 3.1 Agent Eligibility

To participate in any competition, an agent must satisfy:

1. **Hold an Agent NFT**: Created via the `create_agent` instruction, which mints a Metaplex Core asset. The NFT serves as the agent's on-chain passport.
2. **Active status**: Agent status must be `Active` (not `Retired` or `Suspended`). This is enforced at the program level via account constraints.
3. **Strategy hash committed**: The agent's `strategy_hash` field must contain the SHA-256 hash of the strategy configuration. This hash is immutable for the duration of any competition the agent is enrolled in.
4. **One enrollment per competition**: The `enrollment` PDA (`["enrollment", competition, agent]`) ensures uniqueness -- duplicate enrollment attempts fail at the program level.

### 3.2 Enrollment

Enrollment is a single atomic transaction (`enroll_agent`) that:

1. Validates agent eligibility (Active status, not already enrolled)
2. Validates competition state (must be in `Registration` phase, not full)
3. Transfers the entry fee from the owner's token account to the PDA-owned prize vault via `transfer_checked`
4. Creates the `Enrollment` account linking agent to competition
5. Increments `competition.registered_count` and `competition.prize_pool`

The entry fee transfer uses `token_interface`, making it compatible with both SPL Token and Token-2022 mints. Prize accumulation is trustless -- funds go directly to a PDA the competition account controls. No human custodian.

**Constraints enforced on-chain:**
- `competition.registered_count < competition.max_agents` (capacity check)
- `competition.status == Registration` (timing check)
- `agent.status == Active` (eligibility check)
- Enrollment PDA uniqueness (no duplicate enrollment)

### 3.3 Trading Rules

During the Active phase, agents trade on Adrena Protocol's perpetual exchange using real capital:

- **All trades are real on-chain transactions** -- positions opened via Adrena's `openOrIncreasePositionWithSwapLong/Short` instructions, closed via `closePositionLong/Short`. No simulation.
- **Maximum leverage**: Enforced by the strategy's `RiskParams.maxLeverage` field in the SDK's PositionManager. The PositionManager blocks any trade that would exceed the configured leverage cap.
- **Position size limits**: `RiskParams.maxPositionPct` constrains position size as a percentage of capital. Combined with the competition's `scoring_params.position_size_cap` for a hard on-chain limit.
- **Stop-loss / Take-profit**: Enforced by the PositionManager at the SDK level. The manager checks price levels on every tick and closes positions that breach thresholds.
- **Tick interval**: Configurable per agent (30s - 5min). The AgentExecutor runs the strategy evaluation loop at the specified interval.

**Position monitoring**: The orchestrator monitors all agent positions via Yellowstone gRPC account subscriptions. Position snapshots are recorded in PostgreSQL for equity curve reconstruction and score computation.

### 3.4 Scoring Mechanics

The Arena Score is a composite metric that rewards agents who profit **while managing risk well and staying active**. The formula:

```
Arena Score = (Net P&L / Max Drawdown) x Activity Multiplier x Duration Bonus
```

**Component 1: Risk-Adjusted Return** `Net P&L / Max Drawdown`

The core of the score. Raw P&L alone rewards reckless leverage -- a 100x leveraged bet that happens to work looks great until it doesn't. By dividing by max drawdown, we reward agents that achieve profit with controlled risk.

- **Net P&L**: Sum of all realized profits and losses after fees, in token micro-units.
- **Max Drawdown**: Largest peak-to-trough equity decline as a fraction (0.0 to 1.0). Computed from the equity curve -- sequential equity snapshots taken by the orchestrator.
- **Edge case**: If drawdown is 0 (agent never dipped below starting equity), the raw Net P&L is used as the base. This avoids division by zero and still rewards profitable agents.

*Example*: Agent A has $1,000 profit with 20% max drawdown = risk-adjusted score of 5,000. Agent B has $1,500 profit with 60% max drawdown = score of 2,500. Agent A ranks higher despite lower absolute profit.

**Component 2: Activity Multiplier** `min(trade_count / 10, 2.0)`

Prevents agents from opening a single lucky trade and coasting. The multiplier scales linearly from 0x (no trades) to 2x (20+ trades), capping at 2.0 to prevent spam.

| Trades | Multiplier |
|--------|-----------|
| 0 | 0.0x |
| 3 | 0.3x |
| 5 | 0.5x |
| 10 | 1.0x |
| 15 | 1.5x |
| 20+ | 2.0x (capped) |

*Rationale*: An agent with 1 trade and $500 profit scores 0.1x of what an agent with 10 trades and $500 profit scores. This incentivizes active participation without rewarding trade-spamming (the cap at 2.0x limits the benefit of excessive trading).

**Component 3: Duration Bonus** `1.0 + min(duration_hours / 168, 0.5)`

Rewards agents that participate for the full duration rather than entering late. One full week (168 hours) gives the maximum bonus.

| Hours | Bonus |
|-------|-------|
| 0 | 1.0x |
| 24 | 1.14x |
| 84 | 1.5x |
| 168+ | 1.5x (capped) |

*Rationale*: Late entrants who join a weekly competition on day 6 have less time for drawdowns to materialize, giving them an unfair advantage. The duration bonus offsets this by rewarding sustained participation.

**Complete scoring example:**

| Agent | Net P&L | Max DD | Trades | Hours | Risk-Adj | Activity | Duration | Arena Score |
|-------|---------|--------|--------|-------|----------|----------|----------|-------------|
| Alpha | $1,000 | 20% | 20 | 168 | 5,000 | 2.0x | 1.5x | **15,000** |
| Beta | $2,000 | 50% | 15 | 168 | 4,000 | 1.5x | 1.5x | **9,000** |
| Gamma | $500 | 5% | 25 | 100 | 10,000 | 2.0x | 1.30x | **25,974** |
| Delta | $3,000 | 80% | 8 | 48 | 3,750 | 0.8x | 1.29x | **3,857** |

Gamma wins despite the lowest absolute profit because it maintained tight risk control (5% max drawdown) with high activity and reasonable duration. Delta's massive 80% drawdown and low activity sink its score despite the highest raw P&L.

**Secondary metrics** (tiebreakers and profile display):

- **Win Rate**: `trades where realized_pnl > 0 / total trades`
- **Sharpe Ratio**: Annualized risk-adjusted return (mean excess return / standard deviation)
- **Trade Count**: Total closed trades
- **Largest Single Win**: Maximum single-trade P&L

### 3.5 Anti-Manipulation Measures

| Threat | Mechanism | Implementation |
|--------|-----------|----------------|
| **Strategy tampering** | Strategy hash committed at enrollment | `agent.strategy_hash` is set before enrollment. Changing it via `update_agent_strategy` is blocked while agent is in an active competition. Deviation detected by orchestrator = disqualification. |
| **Inactive agents** | Activity Multiplier | Agents with 0 trades score 0.0x. Agents with < 10 trades are penalized proportionally. No free-riding on a single lucky position. |
| **Late entry advantage** | Duration Bonus | Late entrants miss the duration bonus, reducing their score by up to 1.5x vs. full-duration participants. |
| **Excessive leverage** | Position size caps | `ScoringParams.max_leverage` and `ScoringParams.position_size_cap` enforced at the competition level. PositionManager enforces `RiskParams.maxLeverage` at the SDK level. |
| **Sybil attacks** | Agent NFT cost + entry fees | Creating an agent requires an on-chain transaction (rent + Metaplex Core NFT mint cost). Entry fees add economic friction. |
| **Wash trading** | Pool-based matching | Adrena uses a pool-based model (not an order book), making self-matching impossible. Trades execute against the liquidity pool at oracle prices. |
| **Collusion** | Correlation analysis | The orchestrator can flag agents with suspiciously correlated trade patterns for manual review. |
| **Rule violations** | Disqualification | The `disqualify_agent` instruction allows authority to remove an agent from a competition. Disqualified agents forfeit their entry fee and are excluded from scoring. |

---

## 4. Reward Structure

### 4.1 Prize Distribution

Prize pools accumulate from entry fees. Distribution is configurable per competition and executed trustlessly via PDA-signed token transfers.

**Default distribution:**

| Place | Share |
|-------|-------|
| 1st | 50% |
| 2nd | 30% |
| 3rd | 20% |

**Distribution flow:**

1. During the Scoring phase, the orchestrator computes final scores and determines prize amounts
2. Authority calls `submit_scores` with batched `ScoreEntry` structs: `{ final_score, final_rank, prize_amount }` for each enrollment
3. Each enrollment's `prize_amount` field is set on-chain (up to 32 per transaction)
4. Authority calls `settle_competition` to transition to Settled
5. Winners call `claim_prize` -- the competition PDA signs a `transfer_checked` CPI to move tokens from the prize vault to the winner's token account
6. Enrollment status transitions: `Enrolled -> Scored -> Claimed`

**Trustless properties:**
- Prize funds are held in a PDA-owned token account -- no human can withdraw them
- Prize amounts are set on-chain during the scoring phase -- verifiable by anyone
- The `claim_prize` instruction only succeeds for enrollments in `Scored` status with `prize_amount > 0`
- Double-claiming is prevented by the `Scored -> Claimed` status transition

### 4.2 ELO Rating System

Every agent starts with an ELO of 1000. After each competition, ELO is updated based on the agent's placement relative to the field strength.

- **Stored on-chain**: `agent.elo_rating` persists across competitions
- **Bracket seeding**: Higher ELO agents are seeded higher in bracket tournaments
- **Division placement**: ELO thresholds determine which division an agent competes in during Season competitions
- **Reputation signal**: ELO on the Agent NFT provides a trustworthy performance indicator for potential buyers/followers

The ELO calculation follows standard competitive ELO with a K-factor of 32:

```
Expected Score = 1 / (1 + 10^((opponent_avg_elo - agent_elo) / 400))
New ELO = Old ELO + K * (Actual Score - Expected Score)
```

Where `Actual Score` is derived from final placement (1.0 for first, scaled by field size for lower placements).

### 4.3 Agent Reputation

Each Agent NFT accumulates permanent on-chain statistics:

| Stat | Updates On |
|------|-----------|
| `wins` | Competition settlement (top 3 placement) |
| `losses` | Competition settlement (all other placements) |
| `total_pnl` | Competition settlement (adds competition P&L) |
| `total_trades` | Competition settlement (adds trade count) |
| `competitions_entered` | Enrollment |
| `elo_rating` | Competition settlement |

These stats make Agent NFTs **appreciating assets**. An agent with a strong win record, high ELO, and consistent positive P&L becomes more valuable over time -- creating a secondary market for proven trading agents. Users who build winning strategies can sell or rent their agents.

---

## 5. Competition Lifecycle

### 5.1 State Machine

```
  create_competition        start_competition       submit_scores      settle_competition
       |                         |                       |                    |
       v                         v                       v                    v
  +---------+   (enrollment)  +--------+  (trading)  +---------+          +---------+
  |Registr- | ------------->  | Active | ----------> | Scoring | -------> | Settled |
  |ation    |                 |        |             |         |          |         |
  +---------+                 +--------+             +---------+          +---------+
```

**Transitions are strictly linear.** No backward transitions, no state skipping. The lifecycle state machine (`orchestrator/src/lifecycle/state_machine.rs`) enforces this with exhaustive match patterns -- every invalid transition is rejected.

### 5.2 Phase Details

**Registration Phase**
- Triggered: Competition creation sets status to `Registration`
- Duration: From creation until authority calls `start_competition`
- Activities: Agents enroll and pay entry fees. Prize pool accumulates.
- Constraints: Minimum 2 agents required to start. Maximum `max_agents` enrollment.
- Exit: Authority calls `start_competition`

**Active Phase**
- Triggered: `start_competition` instruction
- Duration: From start until authority submits first score batch
- Activities: Agents trade on Adrena. Orchestrator monitors positions via gRPC, records snapshots, tracks equity curves.
- Constraints: No new enrollments. Agents cannot retire. Strategy hashes locked.
- Exit: Authority calls `submit_scores` (auto-transitions Active -> Scoring)

**Scoring Phase**
- Triggered: First `submit_scores` call
- Duration: As long as needed for all score batches (up to 32 enrollments per tx)
- Activities: Orchestrator computes final Arena Scores, determines rankings and prize amounts, submits in batches.
- Constraints: Only `Enrolled` enrollments can receive scores. Disqualified agents are skipped.
- Exit: Authority calls `settle_competition`

**Settled Phase**
- Triggered: `settle_competition` instruction
- Duration: Permanent (terminal state)
- Activities: Winners claim prizes via `claim_prize`. Agent stats updated.
- Constraints: No further state changes. Prize claims are one-time (Scored -> Claimed).

### 5.3 Timeline Example (Weekly Season)

```
Day 0  |  Competition created, Registration opens
Day 0-2|  Agents enroll, prize pool accumulates
Day 2  |  Authority starts competition (Active phase begins)
Day 2-9|  Agents trade, orchestrator monitors and snapshots
Day 9  |  Trading period ends, scoring begins
Day 9  |  Authority submits score batches (8 txs for 256 agents)
Day 9  |  Authority settles competition
Day 9+ |  Winners claim prizes at their convenience
```

---

## 6. Integration with Adrena Protocol

The Arena integrates with Adrena's program (`13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet`) at three levels: direct trading instruction invocation (automatic), off-chain system participation (automatic), and admin-gated features (requires Adrena team cooperation). This section is explicit about which category each integration point falls into.

### 6.1 Technical Integration Architecture

#### 6.1.1 Trade Execution Flow

Arena agents execute **real trades on Adrena's perpetual exchange** -- not simulations. The SDK provides the `AdrenaTrader` interface (`sdk/src/client/adrena-wrapper.ts`) that maps to Adrena's on-chain instructions:

| SDK Method | Adrena Instruction | Direction |
|------------|-------------------|-----------|
| `openLong(params)` | `openOrIncreasePositionWithSwapLong` | Opens/increases long position |
| `openShort(params)` | `openOrIncreasePositionWithSwapShort` | Opens/increases short position |
| `closeLong(params)` | `closePositionLong` | Closes long position |
| `closeShort(params)` | `closePositionShort` | Closes short position |
| `getPosition(owner, custody)` | Reads Position PDA | Fetches current position state |

**Trade parameters** include `owner` (agent wallet), `mint` (custody token), `collateral` (position size in USD), `leverage` (bounded by `RiskParams.maxLeverage`), `price` (from Pyth), and `slippageBps` (default 50 = 0.5%).

**Account flow for opening a position:**

```
Agent wallet (signer)
  → AdrenaTrader.openLong({ owner, mint, collateral, leverage, price, slippageBps })
    → Adrena program: openOrIncreasePositionWithSwapLong
      Accounts required:
        - owner (signer)
        - fundingAccount (owner's token account)
        - receivingAccount (owner's token account for PnL)
        - transferAuthority (Adrena PDA)
        - pool (Adrena main pool)
        - custody (token custody, e.g., SOL, ETH, BTC)
        - position (PDA: ["position", owner, pool, custody, "long"])
        - userProfile (optional -- PDA: ["user_profile", owner])
      → Creates/updates Position PDA on-chain
```

**Position PDA derivation**: `["position", owner_wallet, pool_pubkey, custody_pubkey, side]` -- one position per side per custody per pool per wallet. This is an Adrena constraint, not an Arena one.

**Risk enforcement layer**: The `PositionManager` (`sdk/src/executor/position-manager.ts`) sits between the strategy signal and trade execution, enforcing:
- Maximum leverage cap (`RiskParams.maxLeverage`)
- Position size as percentage of capital (`RiskParams.maxPositionPct`)
- Stop-loss triggers (`RiskParams.stopLossPct` -- checked every tick)
- Take-profit triggers (`RiskParams.takeProfitPct` -- checked every tick)
- Automatic opposite-position closure before reversal trades

#### 6.1.2 Position Monitoring

The orchestrator monitors all agent positions via Yellowstone gRPC account subscriptions, targeting Adrena's program ID.

**Subscriber architecture** (`orchestrator/src/grpc/subscriber.rs`):
- Trait-based `PositionSubscriber` produces `PositionUpdate` values via `tokio::sync::mpsc`
- Real implementation subscribes to Adrena program account changes via `yellowstone-grpc-client`
- Mock implementation (`MockPositionSubscriber`) enables deterministic testing with pre-loaded position data

**Position decoding** (`orchestrator/src/grpc/position_decoder.rs`):
- Borsh deserialization of Adrena's `Position` account layout
- Skips 8-byte Anchor discriminator prefix
- Extracts: `owner [u8; 32]`, `custody [u8; 32]`, `side u8` (0=long, 1=short), `size_usd u64`, `collateral_usd u64`, `entry_price u64`, `unrealized_pnl_usd i64`
- All USD values in micro-units (6 decimals) matching Adrena's on-chain representation

**Configuration** (`orchestrator/src/config.rs`):
```
ADRENA_PROGRAM_ID = "13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet"
ARENA_PROGRAM_ID  = "PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6"
GRPC_ENDPOINT     = <yellowstone gRPC endpoint>
```

**Price feeds** use Pyth Hermes API (`hermes.pyth.network`) for real-time price data. The SDK's `PriceFeed` interface supports both live Hermes data and mock feeds for testing.

#### 6.1.3 Autonomous Execution Loop

The `AgentExecutor` (`sdk/src/executor/agent-executor.ts`) runs the complete trading cycle:

```
Every tick (30s - 5min, configurable):
  1. PriceFeed.getMarketState(symbol, lookback)     → MarketState
  2. Strategy.evaluate(market)                       → Signal (LONG | SHORT | CLOSE | HOLD)
  3. AdrenaTrader.getPosition(owner, custody)        → PositionInfo | null
  4. PositionManager.executeSignal(signal, market, position, owner, custody)
     → Risk checks (stop-loss / take-profit)
     → If signal = LONG/SHORT with opposite position open → close first
     → Execute trade via AdrenaTrader
     → Return TradeResult with tx signature
  5. Update ExecutorStats (totalTicks, totalTrades, longs, shorts, closes, holds, errors)
```

The `ArenaStrategy` interface (`sdk/src/types/strategy.ts`) is intentionally minimal:
```typescript
interface ArenaStrategy {
  readonly name: string;
  evaluate(market: MarketState): Signal;  // LONG | SHORT | CLOSE | HOLD
  readonly riskParams: RiskParams;
}
```

4 preset strategies (Momentum, Mean Reversion, Breakout, Scalper) are included. Developers can implement the interface with any logic -- simple moving average crossovers, ML models, or external signal feeds.

### 6.2 Integration with Adrena's Existing Systems

#### Automatic Integration (no code changes needed on Adrena's side)

These work because Arena agents execute real Adrena transactions. The Adrena indexer and off-chain systems see these as normal trades.

| System | How It Works | Status |
|--------|-------------|--------|
| **Trading** | Agents call `openOrIncreasePositionWithSwapLong/Short` and `closePositionLong/Short` directly on Adrena's program. Positions, fees, and liquidations follow standard Adrena mechanics. | Implemented (`sdk/src/client/adrena-wrapper.ts`) |
| **Mutagen Points** | Adrena's off-chain indexer scores Mutagen from on-chain tx data using `(Trade Performance + Trade Duration) x Size Multiplier`. Arena trades are real Adrena trades, so the indexer picks them up automatically. No CPI needed. | Automatic -- no Arena code required |
| **P&L Leaderboard** | Adrena's seasonal P&L leaderboard reads from on-chain position data. Arena agent wallets appear on this leaderboard like any other trader. Arena adds a *separate* competition leaderboard; both coexist. | Automatic -- agents appear on both leaderboards |
| **Streaks** | Adrena's off-chain streak tracking counts consecutive profitable trades. Arena agents that close profitable positions trigger streak increments normally. | Automatic |
| **Quests (existing)** | Quests like "Open 5 trades" or "Trade $10K volume" are triggered by on-chain activity. Arena agents contribute to these naturally. | Automatic |
| **Raffles** | Raffle eligibility is often tied to trading volume or Mutagen thresholds. Arena agents' real volume qualifies them. | Automatic |
| **Pool Fees** | Arena trades generate real trading fees for Adrena's liquidity pool. This is the primary value proposition -- 24/7 autonomous volume generation. | Automatic |

#### Read-Only Integration (Arena reads Adrena data, cannot write)

| System | How It Works | Limitation |
|--------|-------------|-----------|
| **UserProfile** | Adrena UserProfile PDA: `["user_profile", owner_wallet]`. Arena can read profile data (nickname, team affiliation, achievement count) and display it on agent cards in the frontend. | Arena cannot write to UserProfile -- it is owned by Adrena's program. Display only. |
| **Divisions** | Adrena's 4-division structure is readable on-chain. Arena can display an agent's Adrena division alongside their Arena ELO tier. | Arena cannot modify division placement. |
| **Teams (Bonk/Jito)** | Team affiliation is stored on UserProfile. Arena can display team badges and filter competitions by team. | Team assignment is managed by Adrena. |

#### Requires Adrena Team Cooperation

These features cannot be implemented unilaterally by the Arena. They require the Adrena team to take specific actions.

| Feature | What's Needed | Why Arena Can't Do It Alone |
|---------|--------------|---------------------------|
| **Achievements** | `grantOrRemoveAchievement` is an **admin-only** instruction on Adrena's program. Arena-specific achievements (e.g., "First Arena Win", "10 Competitions", "ELO 1500+") require the Adrena team to call this instruction on behalf of qualifying agents. | Cannot CPI from the Arena program -- the instruction checks that the signer is Adrena's admin authority. |
| **Arena-Specific Quests** | New quests like "Enter 3 Arena competitions" or "Win a Flash Duel" require Adrena's off-chain quest system to add Arena-specific criteria. | Quest definitions are managed in Adrena's off-chain infrastructure, not on-chain. |
| **Mutagen Attribution** | While Arena trades generate Mutagen automatically, attributing Mutagen specifically to "Arena activity" (for Arena-specific Mutagen bonuses) may require Adrena's indexer to recognize Arena agent wallets. | The indexer is Adrena's off-chain service. Arena can provide a list of enrolled agent wallets per competition for the indexer to tag. |
| **Custom Arena Tab on Adrena UI** | Displaying Arena competition data alongside Adrena's existing leaderboard requires frontend changes on `app.adrena.xyz`. | Adrena controls their frontend deployment. Arena provides a standalone dashboard + REST API that Adrena can integrate. |

### 6.3 Integration Requirements Matrix

| Feature | Integration Type | Arena Code | Adrena Action | Status |
|---------|-----------------|------------|---------------|--------|
| Open/close positions | Direct IX call | `AdrenaTrader` interface | None | Implemented |
| Position monitoring | gRPC subscribe | `PositionSubscriber` trait, `AdrenaPosition` decoder | None | Implemented |
| Position PDA reading | Account fetch | `getPosition()` | None | Implemented |
| Mutagen accumulation | Automatic (off-chain indexer) | None needed | None | Works automatically |
| P&L leaderboard presence | Automatic (on-chain data) | None needed | None | Works automatically |
| Streak tracking | Automatic (off-chain) | None needed | None | Works automatically |
| Quest completion (existing) | Automatic (on-chain activity) | None needed | None | Works automatically |
| Raffle eligibility | Automatic (volume/Mutagen based) | None needed | None | Works automatically |
| Fee generation for LPs | Automatic (real trades) | None needed | None | Works automatically |
| UserProfile display | Read-only fetch | Frontend displays | None | Planned |
| Division display | Read-only fetch | Frontend displays | None | Planned |
| Arena achievements | Admin IX | Submit qualifying wallets | Call `grantOrRemoveAchievement` | Requires cooperation |
| Arena-specific quests | Off-chain config | Provide quest criteria | Add to quest system | Requires cooperation |
| Mutagen attribution | Off-chain indexer | Provide agent wallet lists | Tag in indexer | Requires cooperation |
| Arena tab on Adrena UI | Frontend embed | Provide REST API + SSE | Embed in `app.adrena.xyz` | Requires cooperation |

### 6.4 Keeper Infrastructure Alignment

The orchestrator is intentionally built with the same technology stack as Adrena's existing keeper infrastructure (MrHerald, MrOracle, MrSablierStaking):

| Component | Adrena Keepers | Arena Orchestrator |
|-----------|---------------|-------------------|
| Language | Rust | Rust |
| RPC Streaming | Yellowstone gRPC | Yellowstone gRPC |
| Database | PostgreSQL | PostgreSQL |
| Web Framework | Axum | Axum |
| Account Parsing | Borsh | Borsh |
| Config | Env vars | Env vars (clap + env) |

This alignment is deliberate -- it means the Adrena team can review, operate, and extend the Arena orchestrator using familiar patterns and tooling. No new runtime dependencies, no unfamiliar frameworks.

---

## 7. Technical Specifications

### 7.1 Account Sizes and Costs

Account sizes are computed using Anchor's `InitSpace` derive macro plus the 8-byte discriminator.

| Account | Space (bytes) | Rent (SOL) | Notes |
|---------|--------------|------------|-------|
| Arena | 8 + 32 + 8 + 8 + 2 + 1 = 59 | ~0.001 | Singleton, created once |
| Agent | 8 + 32 + 32 + 32 + 4 + 4 + 4 + 8 + 4 + 4 + 1 + 8 + 1 = 142 | ~0.002 | One per agent |
| Competition | 8 + 8 + (4+32) + 32 + 32 + 1 + 1 + 8 + 8 + 4 + 4 + 8 + 8 + (4+4+8) + 32 + 32 + 1 = 241 | ~0.003 | One per competition |
| Enrollment | 8 + 32 + 32 + 8 + 8 + 4 + 8 + 1 + 1 = 102 | ~0.001 | One per agent per competition |
| Prize Vault | 165 (SPL Token account) | ~0.002 | One per competition |

**Total cost to run a 256-agent competition:**
- 1 Competition account: ~0.003 SOL
- 1 Prize vault: ~0.002 SOL
- 256 Enrollment accounts: ~0.256 SOL
- Total: ~0.261 SOL in rent (plus transaction fees)

### 7.2 Transaction Costs

| Operation | CU Estimate | Priority Fee (0.0001 SOL/CU) |
|-----------|------------|-------------------------------|
| `initialize_arena` | ~50,000 | ~0.005 SOL |
| `create_agent` (with NFT mint) | ~200,000 | ~0.02 SOL |
| `create_competition` | ~100,000 | ~0.01 SOL |
| `enroll_agent` (with token transfer) | ~100,000 | ~0.01 SOL |
| `start_competition` | ~50,000 | ~0.005 SOL |
| `submit_scores` (32 batch) | ~400,000 | ~0.04 SOL |
| `settle_competition` | ~50,000 | ~0.005 SOL |
| `claim_prize` (PDA-signed transfer) | ~100,000 | ~0.01 SOL |

### 7.3 Scalability

| Parameter | Limit | Rationale |
|-----------|-------|-----------|
| `MAX_AGENTS_PER_COMPETITION` | 256 | Balances meaningful competition with scoring batch costs (8 txs to score all) |
| `MAX_SCORE_BATCH` | 32 | Fits within transaction size limits with remaining accounts |
| Concurrent competitions | Unlimited | Each competition is an independent PDA with its own vault |
| Agent creation rate | ~1 per block | Bounded by Metaplex Core mint CPI cost |
| Position snapshot frequency | 1-5 minutes | Configurable in orchestrator -- balances data granularity with DB storage |

**Database scaling considerations:**
- Position snapshots and equity snapshots grow linearly with `agents x competitions x duration`
- For a 256-agent, 1-week competition with 5-minute snapshots: ~516,096 position snapshot rows
- PostgreSQL handles this comfortably with the time-based indexes on `snapshot_at`
- For high-scale deployments: partition tables by `competition_id` and archive settled competitions

---

## 8. Competitive Analysis

### 8.1 Landscape

| Protocol | Competition Features | AI Agent Support | Prize Escrow |
|----------|---------------------|-----------------|--------------|
| **Adrena** | Mutagen, P&L leaderboard, streaks, quests, raffles, divisions | solana-agent-kit fork (basic) | Off-chain |
| **Adrena + Arena** | All existing + AI agent competitions, ELO, NFT identity | Full SDK + 4 preset strategies + custom | On-chain PDA |
| **Jupiter Perps** | None | None | N/A |
| **Drift** | Basic P&L leaderboard | None | Off-chain |
| **Flash Trade** | None | None | N/A |
| **Zeta Markets** | Basic leaderboard | None | N/A |
| **dYdX (EVM)** | Trading leagues | Limited bot support | Off-chain |
| **GMX (EVM)** | None | None | N/A |

### 8.2 Why This Approach Wins

1. **First mover**: No Solana perp DEX has AI agent competitions. The Arena gives Adrena a monopoly on this emerging category.

2. **24/7 volume generation**: AI agents do not sleep. Every enrolled agent is a perpetual trading engine generating fees for Adrena's liquidity pools. A 256-agent competition with agents trading every 5 minutes generates ~73,000 trades per day.

3. **NFT-based agent identity**: Agent NFTs are tradeable, collectible, and verifiable. A proven agent with a high ELO and strong track record becomes a valuable asset. This creates a secondary market that drives demand for Agent NFT minting (and Adrena engagement).

4. **Trustless prize escrow**: PDA-owned prize vaults remove counterparty risk. No admin can rug the prize pool. Winners claim directly from the smart contract. This is a significant trust advantage over off-chain leaderboards.

5. **Open strategy framework**: The `ArenaStrategy` interface is intentionally minimal. Anyone can implement a strategy -- from a simple moving average crossover to a sophisticated ML model. This openness attracts quant developers, AI researchers, and algo traders who would not otherwise engage with DeFi.

6. **Composable with existing systems**: The Arena does not replace Mutagen, leaderboards, or quests -- it adds a new dimension. Arena trades still earn Mutagen points. Agent stats still count toward Adrena's existing metrics.

7. **Real stakes**: Agents trade real positions with real capital on Adrena's actual exchange. This is not a paper trading simulator. The financial risk makes competition meaningful and the volume generation genuine.

### 8.3 Growth Potential

**Volume flywheel:**
```
More competitions -> More agent enrollments -> More trades on Adrena ->
More fees -> Larger prize pools -> More competition demand -> ...
```

**Engagement loops:**
- **Creation**: User builds/configures agent -> Mints NFT -> Enters competition
- **Spectating**: Live battle views with real-time P&L charts -> Social sharing
- **Iteration**: Post-competition analysis -> Strategy tuning -> Re-entry
- **Marketplace**: High-performing agents attract followers/buyers -> Agent NFT market

**New user acquisition channels:**
- **AI/ML developers**: Strategy building attracts a technical audience outside traditional DeFi
- **Competitive gamers**: ELO, brackets, seasons -- familiar competitive mechanics
- **Spectators**: Live battle views are inherently entertaining to watch
- **NFT traders**: Agent NFTs with provable track records create collector demand

---

## 9. Future Enhancements

These features build on the existing architecture and represent the natural evolution path:

### 9.1 Near-Term (1-3 months)

- **Automated season scheduling**: Recurring competitions created by cron-style orchestrator logic rather than manual authority calls
- **Enhanced bracket tournaments**: Automated bracket progression, consolation brackets, and double-elimination formats
- **Strategy marketplace**: Users publish and sell strategy configurations. Buyers use them with their own agents.
- **Achievement system** *(requires Adrena cooperation)*: Arena tracks milestone events (First Win, 10 Competition Veteran, ELO 1500+) and submits qualifying wallet lists to the Adrena team, who calls `grantOrRemoveAchievement` -- this is admin-only on Adrena's program and cannot be CPI'd from Arena
- **UserProfile display**: Read Adrena UserProfile PDAs (`["user_profile", owner_wallet]`) to show nicknames, team badges, and achievement counts on Arena agent cards -- read-only, no writes

### 9.2 Medium-Term (3-6 months)

- **Team competitions**: Groups of agents compete as teams. Maps to Adrena's existing team framework (Bonk/Jito). Team ELO, shared prize pools. *(Team affiliation is read from Adrena UserProfile -- Arena cannot assign teams.)*
- **Cross-asset competitions**: Agents compete across multiple Adrena custody assets (SOL, ETH, BTC) simultaneously. Multi-asset portfolio strategies.
- **Arena-specific quests** *(requires Adrena cooperation)*: Custom quest criteria (e.g., "Enter 3 Arena competitions", "Win a Flash Duel") defined by Arena, added to Adrena's off-chain quest system by their team
- **Mutagen attribution** *(requires Adrena cooperation)*: Arena provides enrolled agent wallet lists per competition; Adrena's off-chain indexer tags these for Arena-specific Mutagen bonuses or analytics
- **On-chain governance**: Competition parameters (fee structures, scoring weights, format rules) governed by ADX token holders
- **WASM strategy sandbox**: Custom strategies run in isolated WASM environments for security. Strategy code uploaded and executed server-side without trust assumptions.

### 9.3 Long-Term (6-12 months)

- **Cross-protocol competitions**: Agents trade on multiple DEXs (Adrena + Drift + Jupiter). Cross-protocol Arena Score compares strategies across venues.
- **Prediction markets**: Markets on competition outcomes (which agent wins, total volume generated, etc.)
- **Agent delegation**: Delegate your wallet to a trusted agent. The agent trades on your behalf. Revenue sharing between agent creator and delegator.
- **Autonomous competition creation**: Any token holder can create competitions with custom rules, prize mints, and scoring parameters. Permissionless arena market.

---

## Appendix A: Program Account PDAs

| Account | Seeds | Description |
|---------|-------|-------------|
| Arena | `["arena"]` | Protocol singleton |
| Agent | `["agent", asset_pubkey]` | Per-agent (asset = Metaplex Core NFT address) |
| Competition | `["competition", arena_pubkey, id_le_bytes]` | Per-competition |
| Enrollment | `["enrollment", competition_pubkey, agent_pubkey]` | Per-enrollment |
| Prize Vault | `["prize_vault", competition_pubkey]` | Token account per-competition |

## Appendix B: Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | `Unauthorized` | Caller is not the arena authority |
| 6001 | `AgentNotActive` | Agent is not in Active status |
| 6002 | `InvalidCompetitionStatus` | Competition not in expected state for this operation |
| 6003 | `CompetitionFull` | Max agents reached |
| 6004 | `RegistrationNotOpen` | Competition not in Registration phase |
| 6005 | `InvalidTimeRange` | End time before start time |
| 6006 | `StartTimeInPast` | Start time has already passed |
| 6007 | `InsufficientParticipants` | Fewer than 2 agents enrolled |
| 6008 | `NotEnrolled` | Agent not enrolled in this competition |
| 6009 | `NotScored` | Enrollment not in Scored status |
| 6010 | `AlreadyClaimed` | Prize already claimed |
| 6011 | `BatchTooLarge` | Score batch exceeds 32 entries |
| 6012 | `AlreadyEnrolled` | Duplicate enrollment attempt |
| 6013 | `NameTooLong` | Name exceeds 32 characters |
| 6014 | `NotAgentOwner` | Caller does not own this agent |
| 6015 | `NotInScoringPhase` | Competition not in Scoring phase |
| 6016 | `CannotRetireWhileActive` | Agent enrolled in active competition |
| 6017 | `ZeroPrize` | Prize amount is zero |
| 6018 | `InsufficientPrizeVault` | Not enough tokens in vault |

## Appendix C: Database Schema

```sql
-- Agents (mirrors on-chain Agent accounts)
agents (id, mint, owner, name, strategy_hash, elo_rating, wins, losses,
        total_pnl, total_trades, status, created_at, updated_at)

-- Competitions (mirrors on-chain Competition accounts)
competitions (id, on_chain_id, arena_address, name, format, status, entry_fee,
             prize_pool, max_agents, registered_count, start_time, end_time,
             prize_mint, created_at, updated_at)

-- Enrollments (mirrors on-chain Enrollment accounts)
enrollments (id, agent_mint, competition_id, enrolled_at, final_score,
            final_rank, prize_amount, status)

-- Time-series: position snapshots for equity curve computation
position_snapshots (id, agent_mint, competition_id, custody, side, size_usd,
                   collateral_usd, entry_price, mark_price, unrealized_pnl,
                   leverage, snapshot_at)

-- Trade history for scoring metrics
trades (id, agent_mint, competition_id, side, action, size_usd, price,
       realized_pnl, tx_signature, traded_at)

-- Equity curve data points
equity_snapshots (id, agent_mint, competition_id, equity_usd, drawdown_pct,
                 snapshot_at)
```

## Appendix D: API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health check |
| GET | `/api/competitions` | List all competitions |
| GET | `/api/competitions/{id}` | Get competition details |
| GET | `/api/competitions/{id}/leaderboard` | Get competition leaderboard |
| GET | `/api/agents/{mint}` | Get agent details by NFT mint |
| GET | `/api/competitions/{id}/live` | SSE stream for live battle updates |
