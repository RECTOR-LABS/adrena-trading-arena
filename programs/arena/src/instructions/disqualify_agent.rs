use anchor_lang::prelude::*;
use crate::constants::*;
use crate::error::ArenaError;
use crate::events::*;
use crate::state::{Agent, Arena, Competition, CompetitionStatus, Enrollment, EnrollmentStatus};

#[derive(Accounts)]
pub struct DisqualifyAgent<'info> {
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
    constraint = competition.status == CompetitionStatus::Registration
      || competition.status == CompetitionStatus::Active
      @ ArenaError::InvalidCompetitionStatus,
  )]
  pub competition: Account<'info, Competition>,

  #[account(
    mut,
    seeds = [ENROLLMENT_SEED, competition.key().as_ref(), agent.key().as_ref()],
    bump = enrollment.bump,
    constraint = enrollment.status == EnrollmentStatus::Enrolled @ ArenaError::InvalidEnrollmentStatus,
  )]
  pub enrollment: Account<'info, Enrollment>,

  #[account(
    seeds = [AGENT_SEED, agent.mint.as_ref()],
    bump = agent.bump,
  )]
  pub agent: Account<'info, Agent>,

  pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<DisqualifyAgent>) -> Result<()> {
  ctx.accounts.enrollment.status = EnrollmentStatus::Disqualified;
  ctx.accounts.competition.registered_count = ctx
    .accounts
    .competition
    .registered_count
    .checked_sub(1)
    .ok_or(ArenaError::Overflow)?;

  emit!(AgentDisqualified {
    agent: ctx.accounts.agent.key(),
    competition: ctx.accounts.competition.key(),
  });

  Ok(())
}
