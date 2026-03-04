use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum EnrollmentStatus {
  Enrolled,
  Disqualified,
  Scored,
  Claimed,
}

#[account]
#[derive(InitSpace)]
pub struct Enrollment {
  pub agent: Pubkey,
  pub competition: Pubkey,
  pub enrolled_at: i64,
  pub final_score: i64,
  pub final_rank: u32,
  pub prize_amount: u64,
  pub status: EnrollmentStatus,
  pub bump: u8,
}
