use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum CompetitionFormat {
  Season,
  FlashDuel,
  Bracket,
  Sandbox,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum CompetitionStatus {
  Pending,
  Registration,
  Active,
  Scoring,
  Settled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct ScoringParams {
  pub min_trades: u32,
  pub max_leverage: u32,
  pub position_size_cap: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Competition {
  pub id: u64,
  #[max_len(32)]
  pub name: String,
  pub arena: Pubkey,
  pub authority: Pubkey,
  pub format: CompetitionFormat,
  pub status: CompetitionStatus,
  pub entry_fee: u64,
  pub prize_pool: u64,
  pub max_agents: u32,
  pub registered_count: u32,
  pub start_time: i64,
  pub end_time: i64,
  pub scoring_params: ScoringParams,
  pub prize_mint: Pubkey,
  pub prize_vault: Pubkey,
  pub bump: u8,
}
