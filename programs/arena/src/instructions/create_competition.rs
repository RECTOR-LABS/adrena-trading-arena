use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use crate::constants::*;
use crate::error::ArenaError;
use crate::events::*;
use crate::state::{Arena, Competition, CompetitionFormat, CompetitionStatus, ScoringParams};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateCompetitionArgs {
  pub name: String,
  pub format: CompetitionFormat,
  pub entry_fee: u64,
  pub max_agents: u32,
  pub start_time: i64,
  pub end_time: i64,
  pub scoring_params: ScoringParams,
}

#[derive(Accounts)]
#[instruction(args: CreateCompetitionArgs)]
pub struct CreateCompetition<'info> {
  #[account(
    mut,
    seeds = [ARENA_SEED],
    bump = arena.bump,
    has_one = authority @ ArenaError::Unauthorized,
  )]
  pub arena: Account<'info, Arena>,

  #[account(
    init,
    payer = authority,
    space = 8 + Competition::INIT_SPACE,
    seeds = [COMPETITION_SEED, arena.key().as_ref(), &arena.competition_count.to_le_bytes()],
    bump,
  )]
  pub competition: Account<'info, Competition>,

  #[account(
    init,
    payer = authority,
    token::mint = prize_mint,
    token::authority = competition,
    seeds = [PRIZE_VAULT_SEED, competition.key().as_ref()],
    bump,
  )]
  pub prize_vault: InterfaceAccount<'info, TokenAccount>,

  pub prize_mint: InterfaceAccount<'info, Mint>,

  #[account(mut)]
  pub authority: Signer<'info>,

  pub token_program: Interface<'info, TokenInterface>,
  pub system_program: Program<'info, System>,
}

pub fn create_competition_handler(ctx: Context<CreateCompetition>, args: CreateCompetitionArgs) -> Result<()> {
  require!(args.name.len() <= MAX_NAME_LEN, ArenaError::NameTooLong);
  require!(args.end_time > args.start_time, ArenaError::InvalidTimeRange);

  let now = Clock::get()?.unix_timestamp;
  require!(args.start_time > now, ArenaError::StartTimeInPast);

  require!(
    args.max_agents >= 2 && args.max_agents <= MAX_AGENTS_PER_COMPETITION,
    ArenaError::InvalidMaxAgents
  );

  let arena = &mut ctx.accounts.arena;
  let id = arena.competition_count;

  let competition = &mut ctx.accounts.competition;
  competition.id = id;
  competition.name = args.name.clone();
  competition.arena = arena.key();
  competition.authority = ctx.accounts.authority.key();
  competition.format = args.format;
  competition.status = CompetitionStatus::Registration;
  competition.entry_fee = args.entry_fee;
  competition.prize_pool = 0;
  competition.total_prizes_allocated = 0;
  competition.max_agents = args.max_agents;
  competition.registered_count = 0;
  competition.start_time = args.start_time;
  competition.end_time = args.end_time;
  competition.scoring_params = args.scoring_params;
  competition.prize_mint = ctx.accounts.prize_mint.key();
  competition.prize_vault = ctx.accounts.prize_vault.key();
  competition.bump = ctx.bumps.competition;

  arena.competition_count = arena.competition_count.checked_add(1).ok_or(ArenaError::Overflow)?;

  emit!(CompetitionCreated {
    competition: ctx.accounts.competition.key(),
    id,
    name: args.name,
  });

  Ok(())
}
