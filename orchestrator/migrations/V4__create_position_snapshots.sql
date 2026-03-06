CREATE TABLE position_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_mint VARCHAR(44) NOT NULL,
    competition_id UUID NOT NULL REFERENCES competitions(id),
    custody VARCHAR(44) NOT NULL,
    side VARCHAR(8) NOT NULL,
    size_usd BIGINT NOT NULL,
    collateral_usd BIGINT NOT NULL,
    entry_price BIGINT NOT NULL,
    mark_price BIGINT NOT NULL,
    unrealized_pnl BIGINT NOT NULL,
    leverage SMALLINT NOT NULL,
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pos_snap_agent_comp ON position_snapshots(agent_mint, competition_id);
CREATE INDEX idx_pos_snap_time ON position_snapshots(snapshot_at);
