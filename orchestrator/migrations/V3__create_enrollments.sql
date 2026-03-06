CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_mint VARCHAR(44) NOT NULL,
    competition_id UUID NOT NULL REFERENCES competitions(id),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    final_score BIGINT NOT NULL DEFAULT 0,
    final_rank INTEGER NOT NULL DEFAULT 0,
    prize_amount BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'Enrolled',
    UNIQUE(agent_mint, competition_id)
);
CREATE INDEX idx_enrollments_competition ON enrollments(competition_id);
CREATE INDEX idx_enrollments_agent ON enrollments(agent_mint);
