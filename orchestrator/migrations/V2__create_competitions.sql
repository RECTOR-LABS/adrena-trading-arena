CREATE TABLE competitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    on_chain_id BIGINT NOT NULL,
    arena_address VARCHAR(44) NOT NULL,
    name VARCHAR(32) NOT NULL,
    format VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'Pending',
    entry_fee BIGINT NOT NULL DEFAULT 0,
    prize_pool BIGINT NOT NULL DEFAULT 0,
    max_agents INTEGER NOT NULL DEFAULT 256,
    registered_count INTEGER NOT NULL DEFAULT 0,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    prize_mint VARCHAR(44) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_competitions_status ON competitions(status);
