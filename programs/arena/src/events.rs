use anchor_lang::prelude::*;

#[event]
pub struct AgentCreated {
  pub agent: Pubkey,
  pub owner: Pubkey,
  pub mint: Pubkey,
}

#[event]
pub struct CompetitionCreated {
  pub competition: Pubkey,
  pub id: u64,
  pub name: String,
}

#[event]
pub struct AgentEnrolled {
  pub agent: Pubkey,
  pub competition: Pubkey,
}

#[event]
pub struct CompetitionStarted {
  pub competition: Pubkey,
}

#[event]
pub struct ScoresSubmitted {
  pub competition: Pubkey,
  pub count: u32,
}

#[event]
pub struct CompetitionSettled {
  pub competition: Pubkey,
}

#[event]
pub struct PrizeClaimed {
  pub enrollment: Pubkey,
  pub agent: Pubkey,
  pub amount: u64,
}

#[event]
pub struct AgentDisqualified {
  pub agent: Pubkey,
  pub competition: Pubkey,
}
