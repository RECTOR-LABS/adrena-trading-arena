CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mint VARCHAR(44) NOT NULL UNIQUE,
    owner VARCHAR(44) NOT NULL,
    name VARCHAR(32) NOT NULL,
    strategy_hash VARCHAR(64) NOT NULL,
    elo_rating INTEGER NOT NULL DEFAULT 1000,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    total_pnl BIGINT NOT NULL DEFAULT 0,
    total_trades INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_agents_owner ON agents(owner);
CREATE INDEX idx_agents_status ON agents(status);
