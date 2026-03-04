use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6");

#[program]
pub mod arena {
  use super::*;

  pub fn initialize_arena(ctx: Context<InitializeArena>, protocol_fee_bps: u16) -> Result<()> {
    instructions::initialize_arena::handler(ctx, protocol_fee_bps)
  }

  pub fn create_agent(
    ctx: Context<CreateAgent>,
    name: String,
    uri: String,
    strategy_hash: [u8; 32],
  ) -> Result<()> {
    instructions::create_agent::handler(ctx, name, uri, strategy_hash)
  }

  pub fn update_agent_strategy(
    ctx: Context<UpdateAgentStrategy>,
    new_strategy_hash: [u8; 32],
  ) -> Result<()> {
    instructions::update_agent_strategy::handler(ctx, new_strategy_hash)
  }

  pub fn retire_agent(ctx: Context<RetireAgent>) -> Result<()> {
    instructions::retire_agent::handler(ctx)
  }
}
