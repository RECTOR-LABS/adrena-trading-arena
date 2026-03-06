use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, transfer_checked, TransferChecked};
use crate::constants::*;
use crate::error::ArenaError;
use crate::events::*;
use crate::state::{Agent, AgentStatus, Competition, CompetitionStatus, Enrollment, EnrollmentStatus};

#[derive(Accounts)]
pub struct EnrollAgent<'info> {
  #[account(
    seeds = [AGENT_SEED, agent.mint.as_ref()],
    bump = agent.bump,
    has_one = owner @ ArenaError::NotAgentOwner,
    constraint = agent.status == AgentStatus::Active @ ArenaError::AgentNotActive,
  )]
  pub agent: Account<'info, Agent>,

  #[account(
    mut,
    seeds = [COMPETITION_SEED, competition.arena.as_ref(), &competition.id.to_le_bytes()],
    bump = competition.bump,
    constraint = competition.status == CompetitionStatus::Registration @ ArenaError::RegistrationNotOpen,
    constraint = competition.registered_count < competition.max_agents @ ArenaError::CompetitionFull,
  )]
  pub competition: Account<'info, Competition>,

  #[account(
    init,
    payer = owner,
    space = 8 + Enrollment::INIT_SPACE,
    seeds = [ENROLLMENT_SEED, competition.key().as_ref(), agent.key().as_ref()],
    bump,
  )]
  pub enrollment: Account<'info, Enrollment>,

  #[account(
    mut,
    seeds = [PRIZE_VAULT_SEED, competition.key().as_ref()],
    bump,
  )]
  pub prize_vault: InterfaceAccount<'info, TokenAccount>,

  #[account(
    mut,
    token::mint = prize_mint,
    token::authority = owner,
  )]
  pub owner_token_account: InterfaceAccount<'info, TokenAccount>,

  #[account(
    constraint = prize_mint.key() == competition.prize_mint @ ArenaError::InvalidPrizeMint,
  )]
  pub prize_mint: InterfaceAccount<'info, Mint>,

  #[account(mut)]
  pub owner: Signer<'info>,

  pub token_program: Interface<'info, TokenInterface>,
  pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<EnrollAgent>) -> Result<()> {
  let competition = &ctx.accounts.competition;
  let entry_fee = competition.entry_fee;

  // Transfer entry fee if > 0
  if entry_fee > 0 {
    let transfer_accounts = TransferChecked {
      from: ctx.accounts.owner_token_account.to_account_info(),
      mint: ctx.accounts.prize_mint.to_account_info(),
      to: ctx.accounts.prize_vault.to_account_info(),
      authority: ctx.accounts.owner.to_account_info(),
    };
    transfer_checked(
      CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_accounts),
      entry_fee,
      ctx.accounts.prize_mint.decimals,
    )?;
  }

  // Initialize enrollment
  let enrollment = &mut ctx.accounts.enrollment;
  enrollment.agent = ctx.accounts.agent.key();
  enrollment.competition = ctx.accounts.competition.key();
  enrollment.enrolled_at = Clock::get()?.unix_timestamp;
  enrollment.final_score = 0;
  enrollment.final_rank = 0;
  enrollment.prize_amount = 0;
  enrollment.status = EnrollmentStatus::Enrolled;
  enrollment.bump = ctx.bumps.enrollment;

  // Update competition state
  let competition = &mut ctx.accounts.competition;
  competition.registered_count = competition.registered_count.checked_add(1).ok_or(ArenaError::Overflow)?;
  competition.prize_pool = competition.prize_pool.checked_add(entry_fee).ok_or(ArenaError::Overflow)?;

  emit!(AgentEnrolled {
    agent: ctx.accounts.agent.key(),
    competition: ctx.accounts.competition.key(),
  });

  Ok(())
}
