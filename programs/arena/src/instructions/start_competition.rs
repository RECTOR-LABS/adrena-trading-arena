use anchor_lang::prelude::*;
use crate::constants::*;
use crate::error::ArenaError;
use crate::events::*;
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

pub fn start_competition_handler(ctx: Context<StartCompetition>) -> Result<()> {
  let now = Clock::get()?.unix_timestamp;
  require!(now >= ctx.accounts.competition.start_time, ArenaError::StartTimeInPast);

  ctx.accounts.competition.status = CompetitionStatus::Active;

  emit!(CompetitionStarted {
    competition: ctx.accounts.competition.key(),
  });

  Ok(())
}
