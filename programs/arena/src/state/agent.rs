use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum AgentStatus {
  Active,
  Suspended,
  Retired,
}

#[account]
#[derive(InitSpace)]
pub struct Agent {
  pub owner: Pubkey,
  pub mint: Pubkey,
  pub strategy_hash: [u8; 32],
  pub elo_rating: u32,
  pub wins: u32,
  pub losses: u32,
  pub total_pnl: i64,
  pub total_trades: u32,
  pub competitions_entered: u32,
  pub status: AgentStatus,
  pub created_at: i64,
  pub bump: u8,
}
