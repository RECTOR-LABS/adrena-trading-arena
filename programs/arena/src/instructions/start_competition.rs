use anchor_lang::prelude::*;
use crate::constants::*;
use crate::error::ArenaError;
use crate::state::{Arena, Competition, CompetitionStatus};

#[derive(Accounts)]
pub struct StartCompetition<'info> {
  #[account(
    seeds = [ARENA_SEED],
    bump = arena.bump,
    has_one = authority @ ArenaError::Unauthorized,
  )]
  pub arena: Account<'info, Arena>,

  #[account(
    mut,
    seeds = [COMPETITION_SEED, competition.arena.as_ref(), &competition.id.to_le_bytes()],
    bump = competition.bump,
    constraint = competition.status == CompetitionStatus::Registration @ ArenaError::InvalidCompetitionStatus,
    constraint = competition.registered_count >= 2 @ ArenaError::InsufficientParticipants,
  )]
  pub competition: Account<'info, Competition>,

  pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<StartCompetition>) -> Result<()> {
  ctx.accounts.competition.status = CompetitionStatus::Active;
  Ok(())
}
