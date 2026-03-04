# AI Trading Arena — Design Document

**Date**: 2026-03-04
**Project**: Adrena x Autonom Trading Competition
**Author**: RECTOR
**Status**: Approved

---

## 1. Concept

The AI Trading Arena is a competitive platform where autonomous trading agents battle each other on Adrena's perpetual exchange. Users deploy strategies that trade real positions. Agents are scored on risk-adjusted performance.

**Value proposition to Adrena:**
- Competitions drove 50% of 2025 volume. AI agents trade 24/7 = perpetual volume.
- New user segment (algo builders) that no other Solana perp DEX has captured.
- First mover advantage in AI agent competitions on-chain.

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                │
│  Arena Dashboard │ Strategy Builder │ Live Battles   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│              ARENA ORCHESTRATOR (Rust)                │
│  Agent Registry │ Match Engine │ Scorer │ Lifecycle   │
│  gRPC stream (Yellowstone) │ PostgreSQL │ API        │
└──────────┬───────────────────────────┬──────────────┘
           │                           │
┌──────────┴──────────┐  ┌────────────┴──────────────┐
│  ARENA PROGRAM      │  │    ADRENA PROGRAM          │
│  (on-chain Anchor)  │  │    (existing, 101 ixs)     │
│  • Agent NFT mint   │  │    • openPosition           │
│  • Competition PDA  │  │    • closePosition          │
│  • Prize escrow     │  │    • Position accounts      │
│  • Result attestation│  │    • UserProfile            │
└─────────────────────┘  └───────────────────────────┘
```

### Three Layers

1. **Arena Program** (new on-chain Solana program) — Agent identity, competition state, prize escrow, result attestation
2. **Arena Orchestrator** (off-chain Rust service) — Monitors agent positions via gRPC, computes scores, manages lifecycle, serves API
3. **Arena Frontend** (Next.js + Tailwind) — Dashboard, strategy builder, live battles

## 3. Agent System

### Agent Identity — On-chain NFT

- Each agent is a Metaplex Core NFT minted via the Arena program
- NFT metadata: name, avatar, creator wallet, strategy hash, performance history URI
- Agent NFT = passport required to enter competitions
- Enables: agent trading, agent following, agent marketplace (future)

### Strategy Definition — Two Tiers

**Tier 1: Preset Strategies (No-code)**

Users configure from battle-tested templates:
- **Momentum**: Trend-following with MA crossovers
- **Mean Reversion**: Bollinger band bounce
- **Breakout**: Range detection + breakout entry
- **Scalper**: High-frequency small moves

Parameters: timeframe, entry/exit thresholds, position size %, max leverage, stop loss %, take profit %

Stored as JSON config on-chain (hashed for verification).

**Tier 2: Custom Strategies (Code)**

TypeScript SDK extending Adrena's solana-agent-kit fork:

```typescript
interface ArenaStrategy {
  name: string;
  evaluate(market: MarketState): Signal; // LONG | SHORT | CLOSE | HOLD
  riskParams: RiskParams; // maxLeverage, maxPositionSize, stopLoss
}
```

Strategy code runs in Orchestrator's sandboxed executor (WASM or isolated process).
On-chain: strategy hash stored for audit trail.

### Agent Execution

- Orchestrator runs each agent's strategy on a tick cycle (configurable: 30s-5min)
- When strategy emits signal → Orchestrator builds & sends Adrena transaction
- Agent wallet = dedicated keypair per agent (funded from user's escrow deposit)
- All trades through Adrena's actual program — real positions, real P&L

## 4. Competition Formats

### Format 1: Season Arena (multi-week)
- Mirrors existing Adrena season structure
- All registered agents compete simultaneously
- Duration: 2-4 weeks
- Prize pool: ADX + sponsor tokens
- Divisions by agent age/performance tier

### Format 2: Flash Duels (short bursts)
- 1v1 or small group (2-8 agents)
- Duration: 1 hour, 4 hours, 24 hours
- Entry fee → winner takes pool
- Quick, exciting, shareable

### Format 3: Championship Brackets
- Weekly tournament, 16/32/64 agent bracket
- Single elimination, each round = 24h trading period
- Seeded by ELO rating
- Grand prize for tournament winner

### Format 4: Sandbox (no stakes)
- Practice mode with paper trading (virtual USDC)
- Strategy testing and backtesting
- Onboarding funnel → convert to real competitions

## 5. Scoring & Ranking

### Primary: Arena Score (risk-adjusted)

```
Arena Score = (Net P&L / Max Drawdown) × Activity Multiplier × Duration Bonus
```

- **Net P&L**: Total realized profit/loss after all fees
- **Max Drawdown**: Largest peak-to-trough decline
- **Activity Multiplier**: Minimum trade count required
- **Duration Bonus**: Meaningful hold duration (anti-scalp-spam)

### Secondary (tiebreakers & badges)
- Win Rate (% profitable trades)
- Sharpe Ratio (return per volatility unit)
- Trade Count
- Largest Single Win

### ELO Rating (persistent)
- Persists across competitions
- Updated based on placement vs expected
- Used for bracket seeding and division placement

### Mutagen Integration
- Arena trades earn Mutagen through existing formula
- Bonus Arena Mutagen multiplier for participants
- Top agents earn achievements via `grantOrRemoveAchievement`

## 6. Fraud Prevention

| Threat | Mitigation |
|--------|-----------|
| Wash trading | Pool-based matching (not order book) — self-matching impossible |
| Sybil attacks | Agent NFT mint cost + capital escrow. Max 3 agents/wallet/competition |
| Strategy copying | Strategy hashes on-chain. Code strategies run server-side |
| Oracle manipulation | ChaosLabs oracle, 20s staleness threshold |
| Capital concentration | Position size caps per competition |
| Collusion | Correlation analysis — flag suspiciously correlated agents |
| Late entry | Lock entries before competition start |
| Strategy tampering | Strategy hash committed at entry. Deviation = disqualification |

## 7. Integration with Adrena

| System | Integration |
|--------|------------|
| `UserProfile` | Agents linked to profiles. Competition achievements |
| `Position` accounts | Orchestrator reads position PDAs for verification |
| Mutagen | Arena trades earn mutagen + bonus multiplier |
| Leaderboard | Arena tab alongside existing P&L leaderboard |
| `solana-agent-kit` | Extend with Arena SDK methods |
| MrHerald | Shared gRPC stream or PostgreSQL query |
| Keeper infra | Same patterns (Yellowstone gRPC, priority fees, Rust) |
| Teams (Bonk/Jito) | Team-based arena competitions |

## 8. UI/UX

### Pages

1. **Arena Home** — Live competitions, featured agents, recent results
2. **Agent Workshop** — Create/configure agents, strategy builder
3. **Competition Lobby** — Browse open competitions, entry requirements
4. **Live Battle View** — Real-time P&L charts, position tracking, trade feed
5. **Agent Profile** — History, ELO, competition record, strategy type
6. **Rankings** — Global ELO leaderboard, season standings, hall of fame

### Key UX Moments

- **Agent creation**: Name → Avatar → Strategy → Configure → Mint NFT → Fund → Ready
- **Live spectating**: Split-screen P&L, trade-by-trade feed, agent vs agent overlays
- **Post-match recap**: Trade breakdown, key turning points, "play of the match"

## 9. Tech Stack

| Layer | Technology |
|-------|-----------|
| On-chain program | Anchor (matching Adrena's rev), Rust |
| Orchestrator | Rust, Yellowstone gRPC, tokio-postgres, Axum API |
| Frontend | Next.js 14, Tailwind CSS, TradingView charts |
| Agent SDK | TypeScript (extending solana-agent-kit) |
| Database | PostgreSQL |
| Charts | TradingView Lightweight Charts / D3.js |

## 10. Competitive Advantage

- **Jupiter Perps**: No competition module
- **Drift**: Human-only competitions, basic P&L leaderboard
- **Flash Trade**: No competition infra
- **Zeta Markets**: Basic leaderboard only

**Adrena + Arena = the only Solana perp DEX with AI agent competitions.**
