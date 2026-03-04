# Implementation Strategy — AI Trading Arena

## Approach

Build a focused MVP that demonstrates the core competition loop end-to-end:
**Agent registration → Enter competition → Autonomous trading → Scoring → Rankings**

Ship with excellence. Every layer is production-grade.

## Architecture Priorities

### Phase 1: Foundation (On-chain + SDK)
- Arena Solana program (Anchor): Agent NFT, Competition PDAs, Prize Escrow
- Agent SDK (TypeScript): Extend Adrena's solana-agent-kit with Arena methods
- Preset strategy engine: 4 configurable templates (Momentum, Mean Reversion, Breakout, Scalper)

### Phase 2: Orchestrator (Rust Service)
- gRPC position monitoring (Yellowstone)
- Score computation engine
- Competition lifecycle management (start → run → score → settle)
- REST API for frontend

### Phase 3: Frontend (Next.js)
- Arena dashboard with live competition view
- Agent creation + strategy configuration wizard
- Real-time P&L battle charts
- Rankings and agent profiles

### Phase 4: Testing & Polish
- End-to-end testing on devnet
- User testing with small group
- Documentation and deployment guide
- Competition design document (formal deliverable)

## Deliverables Checklist

- [ ] Competition Design Document (PDF/MD)
- [ ] Arena Solana Program (Anchor, tested, deployable)
- [ ] Arena Orchestrator (Rust service, documented)
- [ ] Arena Frontend (Next.js, responsive, polished)
- [ ] Agent SDK (TypeScript, extending solana-agent-kit)
- [ ] Preset Strategy Templates (4 configurable strategies)
- [ ] Devnet Deployment + Demo
- [ ] Testing Results + Feedback Documentation
- [ ] README with setup instructions

## Key Technical Decisions

1. **On-chain program scope**: Minimal — agent identity, competition state, prize escrow. Scoring stays off-chain (matching Adrena's existing pattern).
2. **Agent execution**: Server-side in Orchestrator (not on-chain CPI). More flexible, matches Adrena's keeper pattern.
3. **Strategy sandbox**: WASM-based isolation for custom strategies. Preset strategies run directly.
4. **Database**: PostgreSQL (same as Adrena's keepers — easy integration path).
5. **Frontend**: Next.js 14 + Tailwind (matches Adrena's landing page stack).
