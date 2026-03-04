use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::Arena;

#[derive(Accounts)]
pub struct InitializeArena<'info> {
  #[account(
    init,
    payer = authority,
    space = 8 + Arena::INIT_SPACE,
    seeds = [ARENA_SEED],
    bump,
  )]
  pub arena: Account<'info, Arena>,

  #[account(mut)]
  pub authority: Signer<'info>,

  pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeArena>, protocol_fee_bps: u16) -> Result<()> {
  let arena = &mut ctx.accounts.arena;
  arena.authority = ctx.accounts.authority.key();
  arena.agent_count = 0;
  arena.competition_count = 0;
  arena.protocol_fee_bps = protocol_fee_bps;
  arena.bump = ctx.bumps.arena;
  Ok(())
}
