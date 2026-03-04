# AI Trading Arena -- Deployment Guide

Step-by-step instructions for building, testing, and deploying all layers of the Arena.

---

## Prerequisites

| Tool | Version | Installation |
|------|---------|-------------|
| Rust | 1.75+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Solana CLI | 2.1+ | `sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"` |
| Anchor CLI | 0.32.1 | `cargo install --git https://github.com/coral-xyz/anchor avm && avm install 0.32.1 && avm use 0.32.1` |
| Node.js | 20+ | `nvm install 20` |
| pnpm | 10+ | `corepack enable && corepack prepare pnpm@latest --activate` |
| PostgreSQL | 14+ | `brew install postgresql@16` (macOS) or system package manager |

**Verify installation:**

```bash
rustc --version        # 1.75+
solana --version       # 2.1+
anchor --version       # 0.32.1
node --version         # 20+
pnpm --version         # 10+
psql --version         # 14+
```

---

## 1. On-Chain Program

### 1.1 Build

```bash
cd programs/arena

# Build the Anchor program
anchor build
```

This produces:
- `target/deploy/arena.so` -- the compiled program binary
- `target/idl/arena.json` -- the IDL for client generation
- `target/types/arena.ts` -- TypeScript types

### 1.2 Test (Localnet)

The test suite runs against a local Solana validator with the Metaplex Core program loaded as a genesis program.

```bash
# From project root
anchor test
```

This starts a local validator, deploys the program, and runs 27 integration tests covering:
- Arena initialization
- Agent creation (NFT minting via Metaplex Core CPI)
- Strategy updates and agent retirement
- Competition creation with prize vault
- Agent enrollment with entry fee transfers
- Competition start/stop lifecycle
- Score submission (batched, up to 32 per tx)
- Competition settlement
- Prize claiming (PDA-signed token transfers)
- Agent disqualification
- Edge cases (full competitions, duplicate enrollment, unauthorized access)

**Required test fixture:** `tests/fixtures/mpl_core.so` -- the Metaplex Core program binary. This is loaded as a genesis program via `Anchor.toml`:

```toml
[[test.genesis]]
address = "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
program = "tests/fixtures/mpl_core.so"
```

### 1.3 Deploy to Devnet

```bash
# Configure Solana CLI for devnet
solana config set --url https://api.devnet.solana.com

# Ensure your wallet has SOL for deployment
solana balance

# Deploy (uses the keypair in Anchor.toml provider.wallet)
anchor deploy --provider.cluster devnet
```

**Program ID**: `PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6`

To deploy with a specific keypair:

```bash
anchor deploy --provider.cluster devnet --provider.wallet /path/to/deployer.json
```

### 1.4 Initialize Arena

After deployment, initialize the Arena singleton:

```bash
# Using the Arena SDK or Anchor CLI
# protocol_fee_bps: 100 = 1%
anchor run initialize -- --protocol-fee-bps 100
```

Or programmatically via the SDK:

```typescript
import { ArenaClient } from '@adrena-arena/sdk';

const client = new ArenaClient(connection, wallet);
await client.initializeArena(100); // 1% protocol fee
```

---

## 2. Orchestrator

### 2.1 Database Setup

```bash
# Create the database
createdb arena

# Or with custom user
psql -U postgres -c "CREATE USER arena WITH PASSWORD 'arena';"
psql -U postgres -c "CREATE DATABASE arena OWNER arena;"
```

The orchestrator runs migrations automatically on startup via refinery. The 6 migration files in `orchestrator/migrations/` create:

1. `agents` -- mirrors on-chain Agent accounts
2. `competitions` -- mirrors on-chain Competition accounts
3. `enrollments` -- mirrors on-chain Enrollment accounts
4. `position_snapshots` -- time-series position data
5. `trades` -- trade history for scoring
6. `equity_snapshots` -- equity curve data points

### 2.2 Build

```bash
cd orchestrator
cargo build --release
```

The release binary is at `target/release/arena-orchestrator`.

### 2.3 Configuration

The orchestrator uses environment variables (with CLI flag overrides):

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://arena:arena@localhost:5432/arena` | PostgreSQL connection string |
| `GRPC_ENDPOINT` | `http://localhost:10000` | Yellowstone gRPC endpoint |
| `ADRENA_PROGRAM_ID` | `13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet` | Adrena program ID |
| `ARENA_PROGRAM_ID` | `PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6` | Arena program ID |
| `API_PORT` | `8080` | REST API listen port |

**Environment file example** (`.env`):

```bash
DATABASE_URL=postgres://arena:arena@localhost:5432/arena
GRPC_ENDPOINT=https://your-grpc-provider.example.com
ADRENA_PROGRAM_ID=13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet
ARENA_PROGRAM_ID=PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6
API_PORT=8080
```

### 2.4 Run

```bash
# Development
cd orchestrator
cargo run

# Production
./target/release/arena-orchestrator \
  --database-url "postgres://arena:arena@localhost:5432/arena" \
  --grpc-endpoint "https://your-grpc-provider.example.com" \
  --api-port 8080
```

The orchestrator starts in **skeleton mode** if the database is unreachable -- the API still serves health checks and static responses, but DB-dependent endpoints return errors. This allows graceful degradation during development.

### 2.5 Run Tests

```bash
cd orchestrator
cargo test
```

This runs 61 unit tests covering:
- Scoring metrics (net P&L, max drawdown, Sharpe ratio, win rate, Arena Score)
- Scoring engine (agent score computation)
- Lifecycle state machine (all valid/invalid transitions)
- gRPC position data structures
- Position decoder

### 2.6 Docker Deployment (Production)

Create a `Dockerfile` in the orchestrator directory:

```dockerfile
FROM rust:1.75 AS builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libssl3 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/arena-orchestrator /usr/local/bin/
CMD ["arena-orchestrator"]
```

Run with Docker Compose:

```yaml
version: "3.8"
name: arena

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: arena
      POSTGRES_PASSWORD: arena
      POSTGRES_DB: arena
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  orchestrator:
    build: ./orchestrator
    environment:
      DATABASE_URL: postgres://arena:arena@postgres:5432/arena
      GRPC_ENDPOINT: ${GRPC_ENDPOINT}
      API_PORT: "8080"
    ports:
      - "127.0.0.1:8080:8080"
    depends_on:
      - postgres

volumes:
  pgdata:
```

```bash
docker compose up -d
docker image prune -f  # clean up build layers
```

---

## 3. Agent SDK

### 3.1 Install Dependencies

```bash
cd sdk
pnpm install
```

### 3.2 Build

```bash
pnpm build
```

Outputs compiled JavaScript to `sdk/dist/`.

### 3.3 Run Tests

```bash
pnpm test
```

Runs 105 tests via Vitest covering:
- Technical indicators (SMA, EMA, Bollinger Bands, RSI)
- All 4 preset strategies (Momentum, Mean Reversion, Breakout, Scalper)
- ArenaClient (program instruction wrappers)
- PositionManager (risk enforcement, signal execution)
- AgentExecutor (tick loop, stats tracking)
- PriceFeed (Hermes API + mock)
- Utility functions (math, PDA derivation)

### 3.4 Usage Example

```typescript
import {
  createMomentumStrategy,
  AgentExecutor,
  ArenaClient,
  HermesPriceFeed,
} from '@adrena-arena/sdk';

// Configure strategy
const strategy = createMomentumStrategy({
  fastPeriod: 9,
  slowPeriod: 21,
  riskParams: {
    maxLeverage: 5,
    maxPositionPct: 20,
    stopLossPct: 5,
    takeProfitPct: 10,
  },
});

// Create executor
const executor = new AgentExecutor({
  strategy,
  trader: adrenaWrapper,
  priceFeed: new HermesPriceFeed(),
  capital: 1000,
  tickIntervalMs: 60_000, // 1 minute
  owner: walletPublicKey,
  mint: agentNftMint,
  custody: solCustodyAddress,
});

// Start autonomous trading
executor.start();

// Check stats
console.log(executor.getStats());

// Stop
executor.stop();
```

---

## 4. Frontend

### 4.1 Install Dependencies

```bash
cd app
pnpm install
```

### 4.2 Configuration

Create `app/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
```

For production, point to your deployed orchestrator and a production RPC:

```bash
NEXT_PUBLIC_API_URL=https://arena-api.yourdomain.com
NEXT_PUBLIC_RPC_URL=https://your-rpc-provider.example.com
```

### 4.3 Development

```bash
pnpm dev
```

Opens at `http://localhost:3000`.

### 4.4 Production Build

```bash
pnpm build
pnpm start
```

### 4.5 Vercel Deployment

The frontend is a standard Next.js 14 app and deploys to Vercel with zero configuration:

```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy
cd app
vercel
```

Set environment variables in the Vercel dashboard:
- `NEXT_PUBLIC_API_URL` -- your orchestrator's public URL
- `NEXT_PUBLIC_RPC_URL` -- your Solana RPC endpoint

### 4.6 Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Live competitions, featured agents, recent results |
| `/competitions` | Competition List | Browse and filter active/upcoming competitions |
| `/competitions/[id]` | Battle View | Real-time P&L charts, trade feed, agent stats |
| `/agents/new` | Agent Creation | Strategy selection wizard, NFT minting |
| `/agents/[mint]` | Agent Profile | Performance history, ELO, competition record |
| `/rankings` | Rankings | Global ELO leaderboard, season standings |

---

## 5. Full Stack Verification

After deploying all layers, verify the integration:

```bash
# 1. Health check
curl http://localhost:8080/health

# 2. List competitions (empty at first)
curl http://localhost:8080/api/competitions

# 3. Open frontend
open http://localhost:3000

# 4. Connect wallet via the UI

# 5. Create an agent via SDK or UI

# 6. Create and start a competition via authority wallet
```

---

## Environment Summary

| Component | Port | URL |
|-----------|------|-----|
| Solana (devnet) | -- | `https://api.devnet.solana.com` |
| PostgreSQL | 5432 | `localhost:5432` |
| Orchestrator API | 8080 | `http://localhost:8080` |
| Frontend (dev) | 3000 | `http://localhost:3000` |

**Program IDs:**
- Arena: `PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6`
- Adrena: `13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet`
- Metaplex Core: `CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d`
