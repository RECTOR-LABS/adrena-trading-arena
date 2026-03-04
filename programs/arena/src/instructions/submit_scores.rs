use anchor_lang::prelude::*;
use crate::constants::*;
use crate::error::ArenaError;
use crate::state::{Arena, Competition, CompetitionStatus, Enrollment, EnrollmentStatus};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoreEntry {
  pub final_score: i64,
  pub final_rank: u32,
  pub prize_amount: u64,
}

#[derive(Accounts)]
pub struct SubmitScores<'info> {
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
  )]
  pub competition: Account<'info, Competition>,

  pub authority: Signer<'info>,
}

pub fn handler<'info>(ctx: Context<'_, '_, 'info, 'info, SubmitScores<'info>>, scores: Vec<ScoreEntry>) -> Result<()> {
  let competition = &mut ctx.accounts.competition;

  require!(
    competition.status == CompetitionStatus::Active
      || competition.status == CompetitionStatus::Scoring,
    ArenaError::InvalidCompetitionStatus
  );

  if competition.status == CompetitionStatus::Active {
    competition.status = CompetitionStatus::Scoring;
  }

  require!(scores.len() <= MAX_SCORE_BATCH, ArenaError::BatchTooLarge);

  require!(
    ctx.remaining_accounts.len() >= scores.len(),
    ArenaError::BatchTooLarge
  );

  for (i, score) in scores.iter().enumerate() {
    let enrollment_info = &ctx.remaining_accounts[i];
    let mut enrollment: Account<Enrollment> = Account::try_from(enrollment_info)?;

    require!(
      enrollment.competition == competition.key(),
      ArenaError::NotEnrolled
    );
    require!(
      enrollment.status == EnrollmentStatus::Enrolled,
      ArenaError::AlreadyClaimed
    );

    enrollment.final_score = score.final_score;
    enrollment.final_rank = score.final_rank;
    enrollment.prize_amount = score.prize_amount;
    enrollment.status = EnrollmentStatus::Scored;

    enrollment.exit(&crate::ID)?;
  }

  Ok(())
}
