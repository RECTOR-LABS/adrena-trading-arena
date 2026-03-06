use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, transfer_checked, TransferChecked};
use crate::constants::*;
use crate::error::ArenaError;
use crate::events::*;
use crate::state::{Agent, Competition, CompetitionStatus, Enrollment, EnrollmentStatus};

#[derive(Accounts)]
pub struct ClaimPrize<'info> {
  #[account(
    seeds = [AGENT_SEED, agent.mint.as_ref()],
    bump = agent.bump,
    has_one = owner @ ArenaError::NotAgentOwner,
  )]
  pub agent: Account<'info, Agent>,

  #[account(
    seeds = [COMPETITION_SEED, competition.arena.as_ref(), &competition.id.to_le_bytes()],
    bump = competition.bump,
    constraint = competition.status == CompetitionStatus::Settled @ ArenaError::InvalidCompetitionStatus,
  )]
  pub competition: Account<'info, Competition>,

  #[account(
    mut,
    seeds = [ENROLLMENT_SEED, competition.key().as_ref(), agent.key().as_ref()],
    bump = enrollment.bump,
    constraint = enrollment.status == EnrollmentStatus::Scored @ ArenaError::NotScored,
    constraint = enrollment.prize_amount > 0 @ ArenaError::ZeroPrize,
    close = owner,
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

  pub prize_mint: InterfaceAccount<'info, Mint>,

  #[account(mut)]
  pub owner: Signer<'info>,

  pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<ClaimPrize>) -> Result<()> {
  let competition = &ctx.accounts.competition;
  let enrollment = &ctx.accounts.enrollment;
  let prize_amount = enrollment.prize_amount;
  let agent_key = enrollment.agent;

  // CE-03: Vault balance pre-check
  ctx.accounts.prize_vault.reload()?;
  require!(
    ctx.accounts.prize_vault.amount >= prize_amount,
    ArenaError::InsufficientPrizeVault
  );

  // Build signer seeds for the competition PDA (vault authority)
  let competition_id_bytes = competition.id.to_le_bytes();
  let signer_seeds: &[&[&[u8]]] = &[&[
    COMPETITION_SEED,
    competition.arena.as_ref(),
    &competition_id_bytes,
    &[competition.bump],
  ]];

  let transfer_accounts = TransferChecked {
    from: ctx.accounts.prize_vault.to_account_info(),
    mint: ctx.accounts.prize_mint.to_account_info(),
    to: ctx.accounts.owner_token_account.to_account_info(),
    authority: ctx.accounts.competition.to_account_info(),
  };

  transfer_checked(
    CpiContext::new_with_signer(
      ctx.accounts.token_program.to_account_info(),
      transfer_accounts,
      signer_seeds,
    ),
    prize_amount,
    ctx.accounts.prize_mint.decimals,
  )?;

  // Mark as claimed (account will be closed via `close = owner` constraint)
  ctx.accounts.enrollment.status = EnrollmentStatus::Claimed;

  emit!(PrizeClaimed {
    enrollment: ctx.accounts.enrollment.key(),
    agent: agent_key,
    amount: prize_amount,
  });

  Ok(())
}
