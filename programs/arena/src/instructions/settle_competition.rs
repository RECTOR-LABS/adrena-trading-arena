use anchor_lang::prelude::*;
use crate::constants::*;
use crate::error::ArenaError;
use crate::events::*;
use crate::state::{Arena, Competition, CompetitionStatus};

#[derive(Accounts)]
pub struct SettleCompetition<'info> {
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
    constraint = competition.status == CompetitionStatus::Scoring @ ArenaError::NotInScoringPhase,
  )]
  pub competition: Account<'info, Competition>,

  pub authority: Signer<'info>,
}

pub fn settle_competition_handler(ctx: Context<SettleCompetition>) -> Result<()> {
  ctx.accounts.competition.status = CompetitionStatus::Settled;

  emit!(CompetitionSettled {
    competition: ctx.accounts.competition.key(),
  });

  Ok(())
}
