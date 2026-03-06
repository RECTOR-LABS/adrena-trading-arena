use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
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

  pub fn create_competition(ctx: Context<CreateCompetition>, args: CreateCompetitionArgs) -> Result<()> {
    instructions::create_competition::handler(ctx, args)
  }

  pub fn enroll_agent(ctx: Context<EnrollAgent>) -> Result<()> {
    instructions::enroll_agent::handler(ctx)
  }

  pub fn start_competition(ctx: Context<StartCompetition>) -> Result<()> {
    instructions::start_competition::handler(ctx)
  }

  pub fn submit_scores<'info>(ctx: Context<'_, '_, 'info, 'info, SubmitScores<'info>>, scores: Vec<ScoreEntry>) -> Result<()> {
    instructions::submit_scores::handler(ctx, scores)
  }

  pub fn settle_competition(ctx: Context<SettleCompetition>) -> Result<()> {
    instructions::settle_competition::handler(ctx)
  }

  pub fn claim_prize(ctx: Context<ClaimPrize>) -> Result<()> {
    instructions::claim_prize::handler(ctx)
  }

  pub fn disqualify_agent(ctx: Context<DisqualifyAgent>) -> Result<()> {
    instructions::disqualify_agent::handler(ctx)
  }
}
