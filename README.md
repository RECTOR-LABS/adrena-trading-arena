<div align="center">

<pre>
 █████╗ ██████╗ ██████╗ ███████╗███╗   ██╗ █████╗
██╔══██╗██╔══██╗██╔══██╗██╔════╝████╗  ██║██╔══██╗
███████║██║  ██║██████╔╝█████╗  ██╔██╗ ██║███████║
██╔══██║██║  ██║██╔══██╗██╔══╝  ██║╚██╗██║██╔══██║
██║  ██║██████╔╝██║  ██║███████╗██║ ╚████║██║  ██║
╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝

████████╗██████╗  █████╗ ██████╗ ██╗███╗   ██╗ ██████╗
╚══██╔══╝██╔══██╗██╔══██╗██╔══██╗██║████╗  ██║██╔════╝
   ██║   ██████╔╝███████║██║  ██║██║██╔██╗ ██║██║  ███╗
   ██║   ██╔══██╗██╔══██║██║  ██║██║██║╚██╗██║██║   ██║
   ██║   ██║  ██║██║  ██║██████╔╝██║██║ ╚████║╚██████╔╝
   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝ ╚═════╝

 █████╗ ██████╗ ███████╗███╗   ██╗ █████╗
██╔══██╗██╔══██╗██╔════╝████╗  ██║██╔══██╗
███████║██████╔╝█████╗  ██╔██╗ ██║███████║
██╔══██║██╔══██╗██╔══╝  ██║╚██╗██║██╔══██║
██║  ██║██║  ██║███████╗██║ ╚████║██║  ██║
╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝
</pre>

# AI Trading Arena

**Autonomous agents battle on Adrena's perpetual exchange. Mint your agent as an NFT. Deploy your strategy. Compete for prizes.**

*Real trades on real markets. Risk-adjusted scoring. Trustless prize vaults. 24/7 volume generation.*

[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF.svg)](https://explorer.solana.com/address/PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6?cluster=devnet)
[![Tests](https://img.shields.io/badge/Tests-234%20passing-brightgreen.svg)](#-test-results)
[![Anchor](https://img.shields.io/badge/Anchor-0.32.1-blue.svg)](https://www.anchor-lang.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## The Idea

Adrena's competitions drove **50% of all 2025 trading volume**. What if those competitions ran 24/7, autonomously, with AI agents trading real perpetual positions?

The Arena makes this real. Users mint agent NFTs, configure trading strategies, and enter competitions. Agents trade on Adrena's actual perpetual exchange — every position, every P&L, every liquidation is real. Winners claim prizes from trustless on-chain vaults.

```
  You                     Arena                        Adrena
  ───                     ─────                        ──────
   │                        │                            │
   │── Mint Agent NFT ─────>│                            │
   │── Pick Strategy ──────>│                            │
   │── Enter Competition ──>│                            │
   │                        │── openPositionLong ───────>│
   │                        │<─ Position Opened ─────────│
   │                        │── closePositionShort ─────>│
   │                        │<─ P&L Realized ────────────│
   │                        │                            │
   │                        │── Score + Rank ───────────>│ (Mutagen, Leaderboard)
   │<─ Claim Prize ─────────│                            │
```

## How It Works

### 1. Mint Your Agent
Each agent is a **Metaplex Core NFT** with on-chain identity — ELO rating, win/loss record, total P&L, competition history. The NFT is transferable, so successful agents have real value.

### 2. Choose Your Strategy
Pick from 4 preset strategies or build your own:

| Strategy | Signal Logic | Best For |
|----------|-------------|----------|
| **Momentum** | EMA crossover (fast/slow) | Trending markets |
| **Mean Reversion** | Bollinger Band bounce | Range-bound markets |
| **Breakout** | N-period high/low break | Volatility expansion |
| **Scalper** | RSI overbought/oversold | High-frequency entries |

### 3. Enter a Competition

| Format | Duration | Entry |
|--------|----------|-------|
| **Season Arena** | 1-4 weeks | Sustained evaluation |
| **Flash Duels** | 1-24 hours | Quick battles |
| **Bracket Tournament** | Multi-day | Elimination rounds |
| **Sandbox** | Unlimited | Free practice |

### 4. Agents Battle Autonomously
The execution loop runs tick-by-tick:
```
fetch price → evaluate strategy → enforce risk limits → execute trade on Adrena → repeat
```

Stop-loss and take-profit fire automatically. Position sizing respects max leverage and capital allocation. No manual intervention.

### 5. Score and Claim

```
Arena Score = (Net P&L / Max Drawdown) x Activity Multiplier x Duration Bonus
```

Prizes sit in **PDA-signed vaults** — no admin can touch them. Winners claim directly on-chain.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 14)                     │
│   Live P&L Charts • Battle View • Rankings • Strategy Builder    │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST + SSE
┌──────────────────────────────┴──────────────────────────────────┐
│                    Orchestrator (Rust / Axum)                     │
│   Scoring Engine • Position Monitor • Lifecycle FSM • REST API   │
└───────────┬──────────────────────────────────┬──────────────────┘
            │ WebSocket                         │ RPC
┌───────────┴───────────┐         ┌────────────┴─────────────────┐
│   Arena Program        │         │   Adrena Program (existing)   │
│   (Anchor / Solana)    │         │   Perpetual Exchange           │
│                        │         │                                │
│   • Agent NFTs         │         │   • openPositionLong/Short     │
│   • Competition State  │         │   • closePositionLong/Short    │
│   • Prize Vaults       │         │   • Position Accounts          │
│   • Score Attestation  │         │   • Mutagen • Leaderboard      │
└────────────────────────┘         └────────────────────────────────┘
```

| Layer | Stack | What It Does |
|-------|-------|-------------|
| **Arena Program** | Anchor 0.32.1, Metaplex Core | 11 instructions. Agent NFTs, competition lifecycle, PDA prize vaults, batched score submission |
| **Orchestrator** | Rust, Axum, PostgreSQL | WebSocket position monitoring, Arena Score computation (Sharpe, drawdown, win rate), competition state machine, REST API + SSE streaming |
| **Agent SDK** | TypeScript, Vitest | `LiveAdrenaTrader` calling real Adrena instructions. 4 strategies, 4 indicators (EMA, SMA, RSI, Bollinger), tick-based executor with risk enforcement |
| **Frontend** | Next.js 14, Tailwind, TradingView | 6 pages — home, competitions, live battle view, agent creation, agent profile, global rankings. Wallet adapter (Phantom/Backpack/Solflare) |

---

## Adrena Integration

This is not a paper trading simulator. Agents trade on Adrena's actual perpetual exchange.

| Integration Point | How |
|-------------------|-----|
| **Trading** | `LiveAdrenaTrader` constructs real `openOrIncreasePositionWithSwapLong/Short` and `closePositionLong/Short` transactions against `13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet` |
| **Position Monitoring** | WebSocket `programSubscribe` filters Adrena position accounts by Anchor discriminator, decodes 248-byte Borsh struct in real-time |
| **Mutagen** | Arena trades are real Adrena trades — the Mutagen indexer picks them up automatically |
| **P&L Leaderboard** | Agent positions appear on Adrena's leaderboard like any other trader |
| **Quests & Streaks** | Real on-chain activity triggers quest progress and streak increments |

See the full integration matrix in [docs/competition-design.md](docs/competition-design.md#6-integration-with-adrena-protocol).

---

## On-Chain Program

**Arena Program**: [`PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6`](https://explorer.solana.com/address/PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6?cluster=devnet) (deployed on devnet)

| Instruction | What It Does |
|------------|-------------|
| `initialize_arena` | Create protocol singleton with fee config |
| `create_agent` | Mint Metaplex Core NFT + init agent account (ELO 1000) |
| `update_agent_strategy` | Commit new strategy hash |
| `retire_agent` | Deactivate agent |
| `create_competition` | Init competition + PDA prize vault |
| `enroll_agent` | Entry fee transfer to vault, create enrollment |
| `start_competition` | Transition Registration → Active (min 2 agents) |
| `submit_scores` | Batch score submission via remaining_accounts (up to 32/tx) |
| `settle_competition` | Transition Scoring → Settled |
| `claim_prize` | PDA-signed token transfer from vault to winner |
| `disqualify_agent` | Remove agent from competition |

**Security**: Checked arithmetic on all counters, remaining_accounts dedup via BTreeSet, prize vault balance pre-checks, Token Interface (SPL + Token-2022) support.

---

## Project Structure

```
adrena-trading-arena/
├── programs/arena/              # Anchor program
│   └── src/
│       ├── instructions/        # 11 instruction handlers
│       ├── state/               # Arena, Agent, Competition, Enrollment
│       ├── events.rs            # 8 event types
│       ├── error.rs             # 19 error variants
│       └── constants.rs         # Seeds, limits, defaults
├── orchestrator/                # Rust orchestrator
│   └── src/
│       ├── api/                 # Axum REST handlers + SSE
│       ├── db/                  # PostgreSQL queries (6 tables)
│       ├── grpc/                # WebSocket subscriber + position decoder
│       ├── scoring/             # Arena Score engine + metrics
│       └── lifecycle/           # Competition state machine
├── sdk/                         # TypeScript Agent SDK
│   └── src/
│       ├── client/              # ArenaClient + LiveAdrenaTrader
│       ├── strategies/          # Momentum, Mean Reversion, Breakout, Scalper
│       ├── indicators/          # EMA, SMA, RSI, Bollinger Bands
│       ├── executor/            # AgentExecutor + PositionManager
│       └── market/              # PriceFeed (Hermes API)
├── app/                         # Next.js 14 frontend
│   └── src/
│       ├── app/                 # 6 pages + error boundary + 404
│       ├── components/          # Battle, competitions, agents, rankings
│       ├── hooks/               # useCompetitions, useLiveUpdates, etc.
│       └── providers/           # Wallet adapter + React Query
├── tests/                       # On-chain integration tests
├── scripts/                     # Devnet E2E lifecycle test
└── docs/                        # Design doc, deployment guide, test results
```

---

## Quick Start

```bash
# Prerequisites: Rust 1.75+, Solana CLI 2.1+, Anchor 0.32.1, Node.js 20+, pnpm 10+

# On-chain program
anchor build && anchor test

# Agent SDK (133 tests)
cd sdk && pnpm install && pnpm test

# Orchestrator (74 tests)
cd orchestrator && cargo test

# Frontend
cd app && pnpm install && pnpm dev    # localhost:3000
```

Full deployment instructions in [docs/deployment-guide.md](docs/deployment-guide.md).

---

## Test Results

**234 tests. All passing. Zero warnings.**

| Layer | Tests | Covers |
|-------|-------|--------|
| On-chain | 27 | All 11 instructions, full lifecycle, edge cases |
| SDK | 133 | 4 strategies, 4 indicators, ArenaClient, LiveAdrenaTrader, executor, position manager, price feed |
| Orchestrator | 74 | Scoring metrics, Arena Score engine, lifecycle FSM, WebSocket subscriber, position decoder |
| Frontend | Build + TypeScript | 8 pages generated, zero TS errors, zero lint warnings |

```bash
# Verify yourself
cd sdk && pnpm test              # 133 passed
cd orchestrator && cargo test    # 74 passed, 0 warnings
cd app && pnpm build             # Compiled successfully
anchor build                     # Built successfully
```

---

## Documentation

| Document | What's Inside |
|----------|--------------|
| [**Competition Design**](docs/competition-design.md) | 880 lines. 4 competition formats, Arena Score formula, ELO system, Adrena integration matrix, competitive analysis vs 7 protocols, abuse prevention for 8 threat vectors |
| [**Deployment Guide**](docs/deployment-guide.md) | Step-by-step for all 4 layers. Docker Compose for orchestrator, Vercel for frontend, devnet program deployment |
| [**Testing Results**](docs/testing-results.md) | Real test output, devnet verification, 5-day user testing plan with 14 feedback questions, iteration recommendations |

---

## Bounty Submission

Built for [Adrena x Autonom: Trading Competition Design & Development](https://superteam.fun/earn/listing/adrena-x-autonom-trading-competition-design-and-development-1) on Superteam Earn.

| Deliverable | Location |
|------------|----------|
| Competition Design Document | [docs/competition-design.md](docs/competition-design.md) |
| Working Prototype | This repository — program + orchestrator + SDK + frontend |
| Testing & Feedback | [docs/testing-results.md](docs/testing-results.md) |

---

<div align="center">

**Arena Program** · [`PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6`](https://explorer.solana.com/address/PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6?cluster=devnet)

**Adrena Program** · [`13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet`](https://explorer.solana.com/address/13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet?cluster=devnet)

MIT License

</div>
