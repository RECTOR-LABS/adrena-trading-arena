use anchor_lang::prelude::*;

#[error_code]
pub enum ArenaError {
  #[msg("Only the arena authority can perform this action")]
  Unauthorized,
  #[msg("Agent is not in Active status")]
  AgentNotActive,
  #[msg("Competition is not in the expected status for this operation")]
  InvalidCompetitionStatus,
  #[msg("Competition has reached maximum agent capacity")]
  CompetitionFull,
  #[msg("Competition registration period has not started")]
  RegistrationNotOpen,
  #[msg("Competition end time must be after start time")]
  InvalidTimeRange,
  #[msg("Start time must be in the future")]
  StartTimeInPast,
  #[msg("Not enough agents registered to start competition")]
  InsufficientParticipants,
  #[msg("Agent is not enrolled in this competition")]
  NotEnrolled,
  #[msg("Enrollment is not in scored status for claiming")]
  NotScored,
  #[msg("Prize has already been claimed")]
  AlreadyClaimed,
  #[msg("Score batch exceeds maximum size")]
  BatchTooLarge,
  #[msg("Agent is already enrolled in this competition")]
  AlreadyEnrolled,
  #[msg("Name exceeds maximum length")]
  NameTooLong,
  #[msg("Only the agent owner can perform this action")]
  NotAgentOwner,
  #[msg("Competition is not in scoring phase")]
  NotInScoringPhase,
  #[msg("Cannot retire agent while enrolled in active competition")]
  CannotRetireWhileActive,
  #[msg("Prize amount is zero")]
  ZeroPrize,
  #[msg("Insufficient funds in prize vault")]
  InsufficientPrizeVault,
}
