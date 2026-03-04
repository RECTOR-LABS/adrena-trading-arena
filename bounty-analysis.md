# Bounty Analysis — Adrena x Autonom Trading Competition

## Bounty Overview

| Field | Value |
|-------|-------|
| Title | Adrena x Autonom: Trading Competition Design & Development |
| Sponsor | Superteam Ireland |
| Prize | 5,000 USDG (2,500 / 1,500 / 1,000) |
| Deadline | March 24, 2026 |
| Type | Bounty (human-only) |
| PRO Required | Yes |
| Submissions | 0 at time of analysis |

## Technical Requirements

### Stack

- **On-chain**: Solana (Anchor/native), Rust
- **Target protocol**: Adrena Protocol (program ID: `13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet`)
- **Keeper infra**: Yellowstone gRPC, PostgreSQL, Rust (matching Adrena's existing patterns)
- **Frontend**: Next.js + Tailwind (matching Adrena's landing page stack)

### Adrena's Existing Competition Infrastructure

- **Mutagen Points System**: `(Trade Performance + Trade Duration) × Size Multiplier`
  - Performance: `(PnL after fees / volume) × 100`, range 0.1%-7.5%, yields 0-0.3 mutagen
  - Duration: 10 seconds to 72 hours, yields 0-0.05 mutagen
  - Size multiplier: based on position size at closure
- **Leaderboard**: Off-chain, computed from indexed transaction data
- **Divisions**: 4 tiers based on trading volume
- **Seasons**: Pre-season "Awakening", Season 1 "The Expanse"
- **Raffles**: 0.01 mutagen = 1 raffle ticket
- **Streaks**: Daily/weekly/monthly active streaks
- **On-chain achievements**: `grantOrRemoveAchievement` instruction + `UserProfile.achievements[256]` bitfield

### Key Adrena Technical Details

- 101 on-chain instructions
- Position PDA: `["position", owner, pool, custody, side_byte]`
- UserProfile PDA: `["user_profile", owner]`
- Competition scoring is entirely off-chain (MrHerald indexer → PostgreSQL → backend API)
- They already forked `solana-agent-kit` with perp trading functions (`openPerpTradeLong/Short`, `closePerpTradeLong/Short`)
- Keeper infrastructure: MrOracle (price feeds), MrSablierStaking, MrHerald (tx indexer), MrRewards (token distributor)
- All keepers use Yellowstone gRPC + PostgreSQL + Rust

## Competitive Landscape

| Protocol | Competition Features |
|----------|---------------------|
| **Adrena** | Mutagen, P&L leaderboard, streaks, quests, raffles, divisions |
| **Jupiter Perps** | None |
| **Drift** | Basic P&L leaderboard, human-only competitions |
| **Flash Trade** | None |
| **Zeta Markets** | Basic leaderboard only |

**Gap**: No Solana perp DEX has AI agent competitions. This is the blue ocean.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Scope too large for prototype | Medium | High | Focus MVP on core loop: agent registration → enter competition → trade → score → rank |
| Adrena team coordination required | Medium | Medium | Build modular — can integrate later. Use their existing ABI/IDL for program interaction |
| "Autonom" partner requirements unclear | Low | Low | Design is protocol-agnostic. Autonom integration is additive |
| Other submissions compete | Low | Medium | Our edge: working code + deep technical integration + Solana/Rust expertise |

## Winning Strategy

1. **Design a genuinely novel format** — AI Trading Arena (no competitor has this)
2. **Ship working code** — Not just a doc, but a functional prototype
3. **Match their stack** — Rust/Anchor on-chain, Yellowstone gRPC keepers, Next.js frontend
4. **Extend their existing fork** — Build on their solana-agent-kit fork (shows deep research)
5. **Demonstrate volume generation** — Show how AI agents = 24/7 trading volume
6. **Polish the presentation** — Clean docs, deployment instructions, testing results
