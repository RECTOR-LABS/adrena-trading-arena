use tokio::sync::mpsc;

/// Position data received from the gRPC stream.
/// All USD values are in micro-units (6 decimals) matching Adrena's on-chain representation.
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct PositionData {
  pub owner: String,
  pub custody: String,
  pub side: String,
  pub size_usd: i64,
  pub collateral_usd: i64,
  pub entry_price: i64,
  pub mark_price: i64,
  pub unrealized_pnl: i64,
  pub leverage: i16,
}

pub type PositionUpdate = PositionData;

/// Trait for subscribing to position account updates.
///
/// Implementations produce a stream of `PositionUpdate` values via an mpsc channel.
/// The real implementation (Task 21) will use yellowstone-grpc-client to subscribe
/// to Adrena position account changes on-chain.
pub trait PositionSubscriber: Send + Sync {
  fn subscribe(
    &self,
  ) -> Result<mpsc::Receiver<PositionUpdate>, Box<dyn std::error::Error + Send + Sync>>;
}

/// Mock subscriber for testing. Wraps a pre-loaded sender so test code
/// can push arbitrary position updates into the channel.
pub struct MockPositionSubscriber {
  tx: mpsc::Sender<PositionUpdate>,
  rx: Option<mpsc::Receiver<PositionUpdate>>,
}

impl MockPositionSubscriber {
  /// Create a new mock subscriber with the given channel capacity.
  pub fn new(capacity: usize) -> Self {
    let (tx, rx) = mpsc::channel(capacity);
    Self { tx, rx: Some(rx) }
  }

  /// Get a clone of the sender to push test updates.
  pub fn sender(&self) -> mpsc::Sender<PositionUpdate> {
    self.tx.clone()
  }
}

impl PositionSubscriber for MockPositionSubscriber {
  fn subscribe(
    &self,
  ) -> Result<mpsc::Receiver<PositionUpdate>, Box<dyn std::error::Error + Send + Sync>> {
    // In a real scenario, each call would create a new subscription.
    // For the mock, we need interior mutability to hand off the receiver once.
    // This is intentionally simple — tests create one subscriber, call subscribe once.
    Err("MockPositionSubscriber::subscribe should be called via MockPositionSubscriber::take_receiver in tests".into())
  }
}

impl MockPositionSubscriber {
  /// Take the receiver out of the mock. Can only be called once.
  pub fn take_receiver(&mut self) -> Option<mpsc::Receiver<PositionUpdate>> {
    self.rx.take()
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[tokio::test]
  async fn mock_subscriber_sends_and_receives() {
    let mut mock = MockPositionSubscriber::new(16);
    let tx = mock.sender();
    let mut rx = mock.take_receiver().expect("receiver should be available");

    let position = PositionData {
      owner: "FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr".to_string(),
      custody: "7xS2gz2bTp3fwCC7knJvUWTEU9Tycczu6VhJYKgi1wdz".to_string(),
      side: "long".to_string(),
      size_usd: 1_000_000_000,
      collateral_usd: 100_000_000,
      entry_price: 50_000_000_000,
      mark_price: 51_000_000_000,
      unrealized_pnl: 20_000_000,
      leverage: 10,
    };

    tx.send(position.clone()).await.expect("send should succeed");
    let received = rx.recv().await.expect("should receive position");

    assert_eq!(received.owner, "FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr");
    assert_eq!(received.side, "long");
    assert_eq!(received.size_usd, 1_000_000_000);
    assert_eq!(received.unrealized_pnl, 20_000_000);
  }

  #[tokio::test]
  async fn mock_subscriber_take_receiver_only_once() {
    let mut mock = MockPositionSubscriber::new(4);
    let _rx = mock.take_receiver();
    assert!(mock.take_receiver().is_none(), "second take should return None");
  }

  #[test]
  fn mock_subscriber_subscribe_returns_error() {
    let mock = MockPositionSubscriber::new(4);
    assert!(mock.subscribe().is_err(), "subscribe() should error — use take_receiver instead");
  }
}
