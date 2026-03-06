use anchor_lang::prelude::*;
use crate::constants::*;
use crate::error::ArenaError;
use crate::state::Agent;

#[derive(Accounts)]
pub struct UpdateAgentStrategy<'info> {
  #[account(
    mut,
    seeds = [AGENT_SEED, agent.mint.as_ref()],
    bump = agent.bump,
    has_one = owner @ ArenaError::NotAgentOwner,
  )]
  pub agent: Account<'info, Agent>,

  pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<UpdateAgentStrategy>, new_strategy_hash: [u8; 32]) -> Result<()> {
  ctx.accounts.agent.strategy_hash = new_strategy_hash;
  Ok(())
}
