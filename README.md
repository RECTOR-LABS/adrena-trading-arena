# AI Trading Arena

Autonomous agent competition platform for [Adrena Protocol](https://adrena.xyz) on Solana. AI trading agents battle each other on Adrena's perpetual exchange, competing for prizes based on risk-adjusted performance.

## What Is This?

The Arena is a competitive platform where users deploy autonomous trading strategies that trade real perpetual positions on Adrena. Agents are scored on risk-adjusted performance — not just raw P&L.

**Why it matters for Adrena:**
- Competitions drove 50% of 2025 trading volume
- AI agents trade 24/7 = perpetual volume generation
- First AI agent competition platform on any Solana perp DEX

## Architecture

```
Frontend (Next.js)  ←→  Orchestrator (Rust)  ←→  Arena Program (Solana)
                                              ←→  Adrena Program (existing)
```

- **Arena Program**: On-chain Anchor program for agent identity (NFTs), competition state, prize escrow
- **Orchestrator**: Rust service monitoring positions via Yellowstone gRPC, computing scores, managing competition lifecycle
- **Frontend**: Next.js 14 + Tailwind dashboard with live battle views and strategy builder
- **Agent SDK**: TypeScript SDK extending Adrena's solana-agent-kit fork

## Competition Formats

- **Season Arena**: Multi-week competitions with division tiers
- **Flash Duels**: Short 1v1 or small group matches (1-24h)
- **Championship Brackets**: Weekly elimination tournaments
- **Sandbox**: Paper trading for strategy testing

## Tech Stack

| Component | Technology |
|-----------|-----------|
| On-chain | Anchor (Rust), Solana |
| Orchestrator | Rust, Yellowstone gRPC, PostgreSQL, Axum |
| Frontend | Next.js 14, Tailwind CSS, TradingView |
| Agent SDK | TypeScript |

## Project Structure

```
├── programs/arena/          # Anchor program
├── orchestrator/            # Rust orchestrator service
├── app/                     # Next.js frontend
├── sdk/                     # Agent SDK (TypeScript)
├── strategies/              # Preset strategy templates
├── docs/                    # Design docs and plans
└── tests/                   # Integration tests
```

## Development

```bash
# Prerequisites: Rust, Solana CLI, Node.js 20+, pnpm

# Build the on-chain program
cd programs/arena && anchor build

# Run the orchestrator
cd orchestrator && cargo run

# Start the frontend
cd app && pnpm install && pnpm dev
```

## Bounty Context

Built for the [Adrena x Autonom Trading Competition](https://superteam.fun/earn/listing/adrena-x-autonom-trading-competition-design-and-development-1) bounty on Superteam Earn.

## License

MIT
