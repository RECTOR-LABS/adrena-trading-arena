CREATE TABLE equity_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_mint VARCHAR(44) NOT NULL,
    competition_id UUID NOT NULL REFERENCES competitions(id),
    equity_usd BIGINT NOT NULL,
    drawdown_pct SMALLINT NOT NULL DEFAULT 0,
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_equity_snap_agent_comp ON equity_snapshots(agent_mint, competition_id);
CREATE INDEX idx_equity_snap_time ON equity_snapshots(snapshot_at);
