CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_mint VARCHAR(44) NOT NULL,
    competition_id UUID NOT NULL REFERENCES competitions(id),
    side VARCHAR(8) NOT NULL,
    action VARCHAR(8) NOT NULL,
    size_usd BIGINT NOT NULL,
    price BIGINT NOT NULL,
    realized_pnl BIGINT NOT NULL DEFAULT 0,
    tx_signature VARCHAR(88),
    traded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trades_agent_comp ON trades(agent_mint, competition_id);
CREATE INDEX idx_trades_time ON trades(traded_at);
