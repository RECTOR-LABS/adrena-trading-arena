/// Competition lifecycle states.
///
/// Transitions follow a strict linear progression:
///   Pending -> Registration -> Active -> Scoring -> Settled
///
/// No backwards transitions or skipping allowed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CompetitionState {
  Pending,
  Registration,
  Active,
  Scoring,
  Settled,
}

impl CompetitionState {
  /// Check whether transitioning from `self` to `next` is valid.
  pub fn can_transition_to(&self, next: &CompetitionState) -> bool {
    matches!(
      (self, next),
      (CompetitionState::Pending, CompetitionState::Registration)
        | (CompetitionState::Registration, CompetitionState::Active)
        | (CompetitionState::Active, CompetitionState::Scoring)
        | (CompetitionState::Scoring, CompetitionState::Settled)
    )
  }

  /// Attempt to transition to the next state.
  /// Returns the new state on success, or an error message on invalid transition.
  pub fn transition(self, next: CompetitionState) -> Result<CompetitionState, String> {
    if self.can_transition_to(&next) {
      Ok(next)
    } else {
      Err(format!("Invalid transition: {:?} -> {:?}", self, next))
    }
  }

  /// Parse a state from its string representation (as stored in DB).
  pub fn from_str_label(s: &str) -> Option<CompetitionState> {
    match s {
      "pending" => Some(CompetitionState::Pending),
      "registration" => Some(CompetitionState::Registration),
      "active" => Some(CompetitionState::Active),
      "scoring" => Some(CompetitionState::Scoring),
      "settled" => Some(CompetitionState::Settled),
      _ => None,
    }
  }

  /// Convert state to its string representation.
  pub fn as_str(&self) -> &'static str {
    match self {
      CompetitionState::Pending => "pending",
      CompetitionState::Registration => "registration",
      CompetitionState::Active => "active",
      CompetitionState::Scoring => "scoring",
      CompetitionState::Settled => "settled",
    }
  }
}

impl std::fmt::Display for CompetitionState {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(f, "{}", self.as_str())
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  // ── Valid transitions ──────────────────────────────────────────────────

  #[test]
  fn valid_pending_to_registration() {
    let state = CompetitionState::Pending;
    assert!(state.can_transition_to(&CompetitionState::Registration));
    let result = state.transition(CompetitionState::Registration);
    assert_eq!(result.unwrap(), CompetitionState::Registration);
  }

  #[test]
  fn valid_registration_to_active() {
    let state = CompetitionState::Registration;
    assert!(state.can_transition_to(&CompetitionState::Active));
    let result = state.transition(CompetitionState::Active);
    assert_eq!(result.unwrap(), CompetitionState::Active);
  }

  #[test]
  fn valid_active_to_scoring() {
    let state = CompetitionState::Active;
    assert!(state.can_transition_to(&CompetitionState::Scoring));
    let result = state.transition(CompetitionState::Scoring);
    assert_eq!(result.unwrap(), CompetitionState::Scoring);
  }

  #[test]
  fn valid_scoring_to_settled() {
    let state = CompetitionState::Scoring;
    assert!(state.can_transition_to(&CompetitionState::Settled));
    let result = state.transition(CompetitionState::Settled);
    assert_eq!(result.unwrap(), CompetitionState::Settled);
  }

  #[test]
  fn valid_full_lifecycle() {
    let state = CompetitionState::Pending;
    let state = state.transition(CompetitionState::Registration).unwrap();
    let state = state.transition(CompetitionState::Active).unwrap();
    let state = state.transition(CompetitionState::Scoring).unwrap();
    let state = state.transition(CompetitionState::Settled).unwrap();
    assert_eq!(state, CompetitionState::Settled);
  }

  // ── Invalid transitions ────────────────────────────────────────────────

  #[test]
  fn invalid_pending_to_active() {
    let state = CompetitionState::Pending;
    assert!(!state.can_transition_to(&CompetitionState::Active));
    assert!(state.transition(CompetitionState::Active).is_err());
  }

  #[test]
  fn invalid_pending_to_scoring() {
    let state = CompetitionState::Pending;
    assert!(!state.can_transition_to(&CompetitionState::Scoring));
    assert!(state.transition(CompetitionState::Scoring).is_err());
  }

  #[test]
  fn invalid_pending_to_settled() {
    let state = CompetitionState::Pending;
    assert!(!state.can_transition_to(&CompetitionState::Settled));
    assert!(state.transition(CompetitionState::Settled).is_err());
  }

  #[test]
  fn invalid_registration_to_pending() {
    let state = CompetitionState::Registration;
    assert!(!state.can_transition_to(&CompetitionState::Pending));
    assert!(state.transition(CompetitionState::Pending).is_err());
  }

  #[test]
  fn invalid_registration_to_scoring() {
    let state = CompetitionState::Registration;
    assert!(!state.can_transition_to(&CompetitionState::Scoring));
    assert!(state.transition(CompetitionState::Scoring).is_err());
  }

  #[test]
  fn invalid_active_to_pending() {
    let state = CompetitionState::Active;
    assert!(!state.can_transition_to(&CompetitionState::Pending));
    assert!(state.transition(CompetitionState::Pending).is_err());
  }

  #[test]
  fn invalid_active_to_registration() {
    let state = CompetitionState::Active;
    assert!(!state.can_transition_to(&CompetitionState::Registration));
    assert!(state.transition(CompetitionState::Registration).is_err());
  }

  #[test]
  fn invalid_active_to_settled() {
    let state = CompetitionState::Active;
    assert!(!state.can_transition_to(&CompetitionState::Settled));
    assert!(state.transition(CompetitionState::Settled).is_err());
  }

  #[test]
  fn invalid_scoring_to_pending() {
    let state = CompetitionState::Scoring;
    assert!(!state.can_transition_to(&CompetitionState::Pending));
    assert!(state.transition(CompetitionState::Pending).is_err());
  }

  #[test]
  fn invalid_scoring_to_active() {
    let state = CompetitionState::Scoring;
    assert!(!state.can_transition_to(&CompetitionState::Active));
    assert!(state.transition(CompetitionState::Active).is_err());
  }

  #[test]
  fn invalid_settled_to_anything() {
    let state = CompetitionState::Settled;
    assert!(!state.can_transition_to(&CompetitionState::Pending));
    assert!(!state.can_transition_to(&CompetitionState::Registration));
    assert!(!state.can_transition_to(&CompetitionState::Active));
    assert!(!state.can_transition_to(&CompetitionState::Scoring));
    // Settled -> Settled is also invalid (terminal state)
    assert!(!state.can_transition_to(&CompetitionState::Settled));
  }

  #[test]
  fn invalid_self_transitions() {
    assert!(!CompetitionState::Pending.can_transition_to(&CompetitionState::Pending));
    assert!(!CompetitionState::Registration.can_transition_to(&CompetitionState::Registration));
    assert!(!CompetitionState::Active.can_transition_to(&CompetitionState::Active));
    assert!(!CompetitionState::Scoring.can_transition_to(&CompetitionState::Scoring));
    assert!(!CompetitionState::Settled.can_transition_to(&CompetitionState::Settled));
  }

  // ── Error message format ───────────────────────────────────────────────

  #[test]
  fn transition_error_message_format() {
    let err = CompetitionState::Pending
      .transition(CompetitionState::Settled)
      .unwrap_err();
    assert!(err.contains("Pending"), "error should mention source state");
    assert!(err.contains("Settled"), "error should mention target state");
  }

  // ── String conversions ─────────────────────────────────────────────────

  #[test]
  fn as_str_roundtrip() {
    let states = [
      CompetitionState::Pending,
      CompetitionState::Registration,
      CompetitionState::Active,
      CompetitionState::Scoring,
      CompetitionState::Settled,
    ];
    for state in &states {
      let s = state.as_str();
      let parsed = CompetitionState::from_str_label(s)
        .unwrap_or_else(|| panic!("failed to parse '{s}'"));
      assert_eq!(&parsed, state);
    }
  }

  #[test]
  fn from_str_label_invalid() {
    assert!(CompetitionState::from_str_label("invalid").is_none());
    assert!(CompetitionState::from_str_label("").is_none());
    assert!(CompetitionState::from_str_label("PENDING").is_none());
  }

  #[test]
  fn display_impl() {
    assert_eq!(format!("{}", CompetitionState::Pending), "pending");
    assert_eq!(format!("{}", CompetitionState::Active), "active");
    assert_eq!(format!("{}", CompetitionState::Settled), "settled");
  }
}
