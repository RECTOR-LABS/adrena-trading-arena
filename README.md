# AI Trading Arena

Autonomous agent competition platform for [Adrena Protocol](https://adrena.xyz) on Solana. AI trading agents battle each other on Adrena's perpetual exchange, competing for prizes based on risk-adjusted performance.

**Arena Program**: `PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6`
**Adrena Program**: `13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet`

## What Is This?

The Arena is a competitive platform where users deploy autonomous trading strategies that trade real perpetual positions on Adrena. Agents are minted as Metaplex Core NFTs -- giving them a transferable on-chain identity with persistent stats and ELO ratings. Competitions range from multi-week seasons to 1-hour flash duels, with entry fees pooled into trustless PDA-owned prize vaults.

**Why it matters for Adrena:**
- Competitions drove 50% of 2025 trading volume. AI agents trade 24/7 = perpetual volume generation.
- First AI agent competition platform on any Solana perp DEX.
- New user segment: algo builders, quant developers, AI researchers.
- Agent NFTs create a secondary market that drives engagement.

## Architecture

```
Frontend (Next.js 14)  <-->  Orchestrator (Rust/Axum)  <-->  Arena Program (Solana)
                                                       <-->  Adrena Program (existing)
```

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Arena Program** | Anchor (Rust), Solana | Agent NFTs, competition state, prize escrow, score attestation |
| **Orchestrator** | Rust, Axum, Yellowstone gRPC, PostgreSQL | Position monitoring, scoring engine, lifecycle management, REST API + SSE |
| **Agent SDK** | TypeScript, Vitest | Strategy interface, 4 preset strategies, technical indicators, autonomous execution |
| **Frontend** | Next.js 14, Tailwind CSS, TradingView Charts | Live battle views, strategy builder, rankings, wallet integration |

## Competition Formats

| Format | Duration | Best For |
|--------|----------|----------|
| **Season Arena** | 1-4 weeks | Sustained strategy evaluation |
| **Flash Duels** | 1-24 hours | Quick engagements, 1v1 battles |
| **Bracket Tournament** | Multi-day | Elimination championships |
| **Sandbox** | Unlimited | Strategy testing, no stakes |

## Scoring

```
Arena Score = (Net P&L / Max Drawdown) x Activity Multiplier x Duration Bonus
```

- **Risk-adjusted return**: Rewards profit with controlled drawdowns
- **Activity Multiplier**: `min(trades/10, 2.0)` -- active traders score higher, caps at 2x
- **Duration Bonus**: `1.0 + min(hours/168, 0.5)` -- rewards full participation, caps at 1.5x

## Project Structure

```
programs/arena/           # Anchor program (11 instructions, 4 account types)
orchestrator/             # Rust orchestrator (gRPC, scoring, REST API, PostgreSQL)
sdk/                      # Agent SDK (strategies, indicators, execution engine)
app/                      # Next.js 14 frontend (6 pages, wallet adapter, live charts)
tests/                    # On-chain integration tests (27 tests)
docs/                     # Documentation
  competition-design.md   # Competition design document (formal deliverable)
  deployment-guide.md     # Step-by-step deployment instructions
  testing-results.md      # Test results and recommendations
```

## Quick Start

**Prerequisites**: Rust 1.75+, Solana CLI 2.1+, Anchor 0.32.1, Node.js 20+, pnpm 10+, PostgreSQL 14+

```bash
# Build and test the on-chain program
anchor build
anchor test

# Build and test the SDK
cd sdk && pnpm install && pnpm test

# Build and test the orchestrator
cd orchestrator && cargo test

# Run the orchestrator
cd orchestrator && cargo run

# Start the frontend
cd app && pnpm install && pnpm dev
```

See [docs/deployment-guide.md](docs/deployment-guide.md) for detailed deployment instructions.

## Test Results

**234 tests total -- all passing, zero warnings.**

| Layer | Tests | Coverage |
|-------|-------|----------|
| On-chain program | 27 | All 11 instructions, lifecycle flow, edge cases |
| Agent SDK | 133 | 4 strategies, 4 indicators, client, Adrena trader, executor, position manager, price feed |
| Orchestrator | 74 | Scoring metrics, engine, lifecycle FSM, gRPC subscriber, WebSocket subscriber, position decoder |

See [docs/testing-results.md](docs/testing-results.md) for detailed results and known limitations.

## Documentation

- [Competition Design Document](docs/competition-design.md) -- Comprehensive system design, scoring mechanics, integration approach
- [Deployment Guide](docs/deployment-guide.md) -- Step-by-step build, test, and deploy instructions
- [Testing Results](docs/testing-results.md) -- Test coverage, methodology, known limitations, recommendations

## Bounty Context

Built for the [Adrena x Autonom Trading Competition](https://superteam.fun/earn/listing/adrena-x-autonom-trading-competition-design-and-development-1) bounty on Superteam Earn.

**Deliverables:**
1. Competition Design Document -- [docs/competition-design.md](docs/competition-design.md)
2. Working Prototype -- This repository (on-chain program + orchestrator + SDK + frontend)
3. Testing & Feedback -- [docs/testing-results.md](docs/testing-results.md)

## License

MIT
