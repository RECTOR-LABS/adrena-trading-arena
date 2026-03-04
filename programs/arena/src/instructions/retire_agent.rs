use anchor_lang::prelude::*;
use crate::constants::*;
use crate::error::ArenaError;
use crate::state::{Agent, AgentStatus};

#[derive(Accounts)]
pub struct RetireAgent<'info> {
  #[account(
    mut,
    seeds = [AGENT_SEED, agent.mint.as_ref()],
    bump = agent.bump,
    has_one = owner @ ArenaError::NotAgentOwner,
  )]
  pub agent: Account<'info, Agent>,

  pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<RetireAgent>) -> Result<()> {
  require!(
    ctx.accounts.agent.status == AgentStatus::Active,
    ArenaError::AgentNotActive
  );
  ctx.accounts.agent.status = AgentStatus::Retired;
  Ok(())
}
