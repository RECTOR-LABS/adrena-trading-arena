use anchor_lang::prelude::*;
use mpl_core::{
  instructions::CreateV2CpiBuilder,
  ID as MPL_CORE_ID,
};
use crate::constants::*;
use crate::error::ArenaError;
use crate::events::*;
use crate::state::{Arena, Agent, AgentStatus};

#[derive(Accounts)]
#[instruction(name: String, uri: String)]
pub struct CreateAgent<'info> {
  #[account(
    mut,
    seeds = [ARENA_SEED],
    bump = arena.bump,
  )]
  pub arena: Account<'info, Arena>,

  #[account(
    init,
    payer = owner,
    space = 8 + Agent::INIT_SPACE,
    seeds = [AGENT_SEED, asset.key().as_ref()],
    bump,
  )]
  pub agent: Account<'info, Agent>,

  /// New keypair that becomes the Metaplex Core asset address
  #[account(mut)]
  pub asset: Signer<'info>,

  #[account(mut)]
  pub owner: Signer<'info>,

  pub system_program: Program<'info, System>,

  /// CHECK: Validated by address constraint
  #[account(address = MPL_CORE_ID)]
  pub mpl_core_program: UncheckedAccount<'info>,
}

pub fn handler(
  ctx: Context<CreateAgent>,
  name: String,
  uri: String,
  strategy_hash: [u8; 32],
) -> Result<()> {
  require!(name.len() <= MAX_NAME_LEN, ArenaError::NameTooLong);
  require!(uri.len() <= MAX_URI_LEN, ArenaError::UriTooLong);

  // Mint Core NFT via CPI
  CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
    .asset(&ctx.accounts.asset.to_account_info())
    .payer(&ctx.accounts.owner.to_account_info())
    .system_program(&ctx.accounts.system_program.to_account_info())
    .name(name)
    .uri(uri)
    .invoke()?;

  // Initialize Agent account
  let agent = &mut ctx.accounts.agent;
  agent.owner = ctx.accounts.owner.key();
  agent.mint = ctx.accounts.asset.key();
  agent.strategy_hash = strategy_hash;
  agent.elo_rating = DEFAULT_ELO;
  agent.wins = 0;
  agent.losses = 0;
  agent.total_pnl = 0;
  agent.total_trades = 0;
  agent.competitions_entered = 0;
  agent.status = AgentStatus::Active;
  agent.created_at = Clock::get()?.unix_timestamp;
  agent.bump = ctx.bumps.agent;

  // Increment arena counter
  let arena = &mut ctx.accounts.arena;
  arena.agent_count = arena.agent_count.checked_add(1).ok_or(ArenaError::Overflow)?;

  emit!(AgentCreated {
    agent: ctx.accounts.agent.key(),
    owner: ctx.accounts.owner.key(),
    mint: ctx.accounts.asset.key(),
  });

  Ok(())
}
