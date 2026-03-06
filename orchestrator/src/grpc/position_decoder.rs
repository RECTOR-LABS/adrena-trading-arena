use borsh::{BorshDeserialize, BorshSerialize};

/// Adrena Position account layout (simplified).
///
/// Only includes the fields needed for scoring. The full on-chain account
/// has additional fields, but we skip them via Borsh sequential deserialization
/// up to the fields we care about.
///
/// All USD values are stored as u64 in micro-units (6 decimals).
/// `unrealized_pnl_usd` is signed because it can be negative.
#[derive(BorshDeserialize, BorshSerialize, Debug, Clone)]
pub struct AdrenaPosition {
  pub owner: [u8; 32],
  pub custody: [u8; 32],
  pub side: u8,
  pub size_usd: u64,
  pub collateral_usd: u64,
  pub entry_price: u64,
  pub unrealized_pnl_usd: i64,
}

/// Anchor accounts have an 8-byte discriminator prefix.
const ANCHOR_DISCRIMINATOR_LEN: usize = 8;

/// Decode an Adrena Position account from raw account data.
///
/// Skips the 8-byte Anchor discriminator before deserializing.
/// Returns `None` if the data is too short or deserialization fails.
pub fn decode_position(data: &[u8]) -> Option<AdrenaPosition> {
  if data.len() < ANCHOR_DISCRIMINATOR_LEN {
    return None;
  }
  AdrenaPosition::try_from_slice(&data[ANCHOR_DISCRIMINATOR_LEN..]).ok()
}

/// Convert a side byte to a human-readable string.
pub fn side_to_string(side: u8) -> &'static str {
  match side {
    0 => "long",
    1 => "short",
    _ => "unknown",
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use borsh::BorshSerialize;

  /// Helper: build valid position bytes with 8-byte discriminator prefix.
  fn build_position_bytes(pos: &AdrenaPosition) -> Vec<u8> {
    let mut buf = vec![0u8; ANCHOR_DISCRIMINATOR_LEN]; // discriminator
    let serialized = pos.try_to_vec().expect("serialization should succeed");
    buf.extend_from_slice(&serialized);
    buf
  }

  fn sample_position() -> AdrenaPosition {
    AdrenaPosition {
      owner: [1u8; 32],
      custody: [2u8; 32],
      side: 0,
      size_usd: 1_000_000_000,
      collateral_usd: 100_000_000,
      entry_price: 50_000_000_000,
      unrealized_pnl_usd: 20_000_000,
    }
  }

  #[test]
  fn decode_valid_position() {
    let pos = sample_position();
    let data = build_position_bytes(&pos);
    let decoded = decode_position(&data).expect("should decode");

    assert_eq!(decoded.owner, [1u8; 32]);
    assert_eq!(decoded.custody, [2u8; 32]);
    assert_eq!(decoded.side, 0);
    assert_eq!(decoded.size_usd, 1_000_000_000);
    assert_eq!(decoded.collateral_usd, 100_000_000);
    assert_eq!(decoded.entry_price, 50_000_000_000);
    assert_eq!(decoded.unrealized_pnl_usd, 20_000_000);
  }

  #[test]
  fn decode_short_position() {
    let mut pos = sample_position();
    pos.side = 1;
    pos.unrealized_pnl_usd = -5_000_000;
    let data = build_position_bytes(&pos);
    let decoded = decode_position(&data).expect("should decode");

    assert_eq!(decoded.side, 1);
    assert_eq!(decoded.unrealized_pnl_usd, -5_000_000);
  }

  #[test]
  fn decode_empty_data_returns_none() {
    assert!(decode_position(&[]).is_none());
  }

  #[test]
  fn decode_too_short_returns_none() {
    assert!(decode_position(&[0u8; 7]).is_none());
  }

  #[test]
  fn decode_discriminator_only_returns_none() {
    assert!(decode_position(&[0u8; 8]).is_none());
  }

  #[test]
  fn decode_truncated_data_returns_none() {
    let pos = sample_position();
    let data = build_position_bytes(&pos);
    // Truncate to half the expected data after discriminator
    let truncated = &data[..ANCHOR_DISCRIMINATOR_LEN + 32];
    assert!(decode_position(truncated).is_none());
  }

  #[test]
  fn side_to_string_values() {
    assert_eq!(side_to_string(0), "long");
    assert_eq!(side_to_string(1), "short");
    assert_eq!(side_to_string(2), "unknown");
    assert_eq!(side_to_string(255), "unknown");
  }
}
