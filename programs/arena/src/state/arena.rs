use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Arena {
  pub authority: Pubkey,
  pub agent_count: u64,
  pub competition_count: u64,
  pub protocol_fee_bps: u16,
  pub bump: u8,
}
