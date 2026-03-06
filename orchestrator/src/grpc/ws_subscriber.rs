use base64::Engine;
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;

use super::position_decoder;
use super::subscriber::{PositionData, PositionSubscriber, PositionUpdate};

/// Anchor discriminator for Adrena Position accounts.
///
/// Computed as `sha256("account:Position")[..8]`.
/// This is used to filter incoming program account notifications
/// so we only attempt to decode actual Position accounts.
const POSITION_DISCRIMINATOR: [u8; 8] = [0xaa, 0xbc, 0x8f, 0xe4, 0x7a, 0x40, 0xf7, 0xd0];

/// Delay between reconnection attempts when the WebSocket drops.
const RECONNECT_DELAY: std::time::Duration = std::time::Duration::from_secs(5);

/// Channel capacity for position updates.
const CHANNEL_CAPACITY: usize = 256;

/// Real position subscriber that connects to Solana WebSocket RPC
/// and uses `programSubscribe` to monitor Adrena position account changes.
pub struct WebSocketPositionSubscriber {
  ws_url: String,
  program_id: String,
}

impl WebSocketPositionSubscriber {
  /// Create a new WebSocket subscriber.
  ///
  /// - `ws_url`: Solana WebSocket RPC endpoint (e.g., `wss://api.devnet.solana.com`)
  /// - `program_id`: Adrena program ID to subscribe to
  pub fn new(ws_url: String, program_id: String) -> Self {
    Self {
      ws_url,
      program_id,
    }
  }

  /// Build the JSON-RPC `programSubscribe` request payload.
  fn build_subscribe_message(&self) -> String {
    serde_json::json!({
      "jsonrpc": "2.0",
      "id": 1,
      "method": "programSubscribe",
      "params": [
        self.program_id,
        {
          "encoding": "base64",
          "commitment": "confirmed"
        }
      ]
    })
    .to_string()
  }
}

impl PositionSubscriber for WebSocketPositionSubscriber {
  fn subscribe(
    &self,
  ) -> Result<mpsc::Receiver<PositionUpdate>, Box<dyn std::error::Error + Send + Sync>> {
    let (tx, rx) = mpsc::channel(CHANNEL_CAPACITY);
    let ws_url = self.ws_url.clone();
    let subscribe_msg = self.build_subscribe_message();

    tokio::spawn(async move {
      run_ws_loop(ws_url, subscribe_msg, tx).await;
    });

    Ok(rx)
  }
}

/// Main WebSocket event loop with automatic reconnection.
///
/// Connects to the Solana WebSocket RPC, sends the `programSubscribe` request,
/// and processes incoming notifications. On disconnect or error, waits
/// `RECONNECT_DELAY` seconds before reconnecting.
///
/// Exits only when the mpsc sender is dropped (receiver side closed).
async fn run_ws_loop(
  ws_url: String,
  subscribe_msg: String,
  tx: mpsc::Sender<PositionUpdate>,
) {
  loop {
    tracing::info!(url = %ws_url, "Connecting to Solana WebSocket RPC");

    match tokio_tungstenite::connect_async(&ws_url).await {
      Ok((ws_stream, response)) => {
        tracing::info!(
          status = %response.status(),
          "WebSocket connection established"
        );

        let (mut write, mut read) = ws_stream.split();

        // Send programSubscribe request
        if let Err(e) = write.send(Message::Text(subscribe_msg.clone())).await {
          tracing::error!(error = %e, "Failed to send programSubscribe request");
          sleep_before_reconnect().await;
          continue;
        }

        tracing::info!("programSubscribe request sent, waiting for notifications");

        // Process incoming messages
        while let Some(msg_result) = read.next().await {
          match msg_result {
            Ok(Message::Text(text)) => {
              if let Err(closed) = handle_ws_message(&text, &tx).await {
                if closed {
                  tracing::info!("Position channel closed, stopping WebSocket subscriber");
                  return;
                }
              }
            }
            Ok(Message::Ping(data)) => {
              if let Err(e) = write.send(Message::Pong(data)).await {
                tracing::warn!(error = %e, "Failed to send pong");
                break;
              }
            }
            Ok(Message::Close(frame)) => {
              tracing::warn!(?frame, "WebSocket closed by server");
              break;
            }
            Ok(_) => {
              // Binary, Pong, Frame — ignore
            }
            Err(e) => {
              tracing::error!(error = %e, "WebSocket read error");
              break;
            }
          }
        }

        tracing::warn!("WebSocket stream ended, will reconnect");
      }
      Err(e) => {
        tracing::error!(error = %e, "Failed to connect to WebSocket RPC");
      }
    }

    sleep_before_reconnect().await;
  }
}

/// Handle a single WebSocket text message.
///
/// Returns `Ok(())` on success or non-position notification.
/// Returns `Err(true)` if the channel is closed (subscriber should stop).
/// Returns `Err(false)` on parse/decode errors (subscriber should continue).
async fn handle_ws_message(
  text: &str,
  tx: &mpsc::Sender<PositionUpdate>,
) -> Result<(), bool> {
  let msg: serde_json::Value = match serde_json::from_str(text) {
    Ok(v) => v,
    Err(e) => {
      tracing::warn!(error = %e, "Failed to parse WebSocket message as JSON");
      return Err(false);
    }
  };

  // Check for subscription confirmation
  if msg.get("result").is_some() && msg.get("id").is_some() {
    let sub_id = &msg["result"];
    tracing::info!(subscription_id = %sub_id, "programSubscribe confirmed");
    return Ok(());
  }

  // Check for error response
  if let Some(error) = msg.get("error") {
    tracing::error!(error = %error, "RPC error received");
    return Err(false);
  }

  // Process programNotification
  if msg.get("method").and_then(|m| m.as_str()) != Some("programNotification") {
    return Ok(());
  }

  let value = match msg
    .get("params")
    .and_then(|p| p.get("result"))
    .and_then(|r| r.get("value"))
  {
    Some(v) => v,
    None => {
      tracing::warn!("programNotification missing params.result.value");
      return Err(false);
    }
  };

  let pubkey = value
    .get("pubkey")
    .and_then(|p| p.as_str())
    .unwrap_or("unknown");

  let account_data = match value
    .get("account")
    .and_then(|a| a.get("data"))
    .and_then(|d| d.as_array())
    .and_then(|arr| arr.first())
    .and_then(|b64| b64.as_str())
  {
    Some(data_str) => data_str,
    None => {
      tracing::debug!(pubkey = %pubkey, "Skipping notification with missing account data");
      return Ok(());
    }
  };

  let raw_bytes = match base64::engine::general_purpose::STANDARD.decode(account_data) {
    Ok(bytes) => bytes,
    Err(e) => {
      tracing::warn!(pubkey = %pubkey, error = %e, "Failed to decode base64 account data");
      return Err(false);
    }
  };

  // Filter: check Anchor discriminator before attempting full decode
  if raw_bytes.len() < 8 || raw_bytes[..8] != POSITION_DISCRIMINATOR {
    tracing::trace!(
      pubkey = %pubkey,
      data_len = raw_bytes.len(),
      "Skipping non-Position account"
    );
    return Ok(());
  }

  let position = match position_decoder::decode_position(&raw_bytes) {
    Some(pos) => pos,
    None => {
      tracing::warn!(pubkey = %pubkey, "Failed to decode Position account data");
      return Err(false);
    }
  };

  let owner = solana_sdk::pubkey::Pubkey::from(position.owner).to_string();
  let custody = solana_sdk::pubkey::Pubkey::from(position.custody).to_string();
  let side = position_decoder::side_to_string(position.side).to_string();

  let update = PositionData {
    owner: owner.clone(),
    custody,
    side: side.clone(),
    size_usd: position.size_usd as i64,
    collateral_usd: position.collateral_usd as i64,
    entry_price: position.entry_price as i64,
    mark_price: 0, // Not available from on-chain account data — requires oracle
    unrealized_pnl: position.unrealized_pnl_usd,
    leverage: compute_leverage(position.size_usd, position.collateral_usd),
  };

  tracing::debug!(
    pubkey = %pubkey,
    owner = %owner,
    side = %side,
    size_usd = position.size_usd,
    "Position update decoded"
  );

  if tx.send(update).await.is_err() {
    // Receiver dropped — stop the loop
    return Err(true);
  }

  Ok(())
}

/// Compute leverage as size / collateral, clamped to i16 range.
/// Returns 0 if collateral is zero to avoid division by zero.
fn compute_leverage(size_usd: u64, collateral_usd: u64) -> i16 {
  if collateral_usd == 0 {
    return 0;
  }
  let leverage = size_usd / collateral_usd;
  leverage.min(i16::MAX as u64) as i16
}

async fn sleep_before_reconnect() {
  tracing::info!(
    delay_secs = RECONNECT_DELAY.as_secs(),
    "Waiting before reconnection attempt"
  );
  tokio::time::sleep(RECONNECT_DELAY).await;
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn build_subscribe_message_format() {
    let sub = WebSocketPositionSubscriber::new(
      "wss://api.devnet.solana.com".to_string(),
      "13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet".to_string(),
    );
    let msg: serde_json::Value =
      serde_json::from_str(&sub.build_subscribe_message()).expect("valid JSON");

    assert_eq!(msg["jsonrpc"], "2.0");
    assert_eq!(msg["id"], 1);
    assert_eq!(msg["method"], "programSubscribe");

    let params = msg["params"].as_array().expect("params is array");
    assert_eq!(params[0], "13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet");
    assert_eq!(params[1]["encoding"], "base64");
    assert_eq!(params[1]["commitment"], "confirmed");
  }

  #[test]
  fn compute_leverage_normal() {
    assert_eq!(compute_leverage(10_000_000, 1_000_000), 10);
    assert_eq!(compute_leverage(5_000_000, 1_000_000), 5);
  }

  #[test]
  fn compute_leverage_zero_collateral() {
    assert_eq!(compute_leverage(10_000_000, 0), 0);
  }

  #[test]
  fn compute_leverage_clamped() {
    // Extremely high leverage should clamp to i16::MAX
    assert_eq!(compute_leverage(u64::MAX, 1), i16::MAX);
  }

  #[tokio::test]
  async fn handle_subscription_confirmation() {
    let (tx, _rx) = mpsc::channel(16);
    let msg = r#"{"jsonrpc":"2.0","result":42,"id":1}"#;
    let result = handle_ws_message(msg, &tx).await;
    assert!(result.is_ok());
  }

  #[tokio::test]
  async fn handle_rpc_error() {
    let (tx, _rx) = mpsc::channel(16);
    let msg = r#"{"jsonrpc":"2.0","error":{"code":-32600,"message":"Invalid request"},"id":1}"#;
    let result = handle_ws_message(msg, &tx).await;
    assert_eq!(result, Err(false));
  }

  #[tokio::test]
  async fn handle_non_position_notification() {
    // Build a notification with data that does NOT match the Position discriminator
    let fake_data = vec![0u8; 200];
    let b64 = base64::engine::general_purpose::STANDARD.encode(&fake_data);
    let msg = serde_json::json!({
      "jsonrpc": "2.0",
      "method": "programNotification",
      "params": {
        "subscription": 42,
        "result": {
          "context": { "slot": 100 },
          "value": {
            "pubkey": "SomeAccount111111111111111111111111111111111",
            "account": {
              "data": [b64, "base64"],
              "executable": false,
              "lamports": 1000000,
              "owner": "13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet",
              "rentEpoch": 0
            }
          }
        }
      }
    });
    let (tx, _rx) = mpsc::channel(16);
    let result = handle_ws_message(&msg.to_string(), &tx).await;
    // Non-position accounts are silently skipped
    assert!(result.is_ok());
  }

  #[tokio::test]
  async fn handle_valid_position_notification() {
    use borsh::BorshSerialize;

    let position = position_decoder::AdrenaPosition {
      owner: [1u8; 32],
      custody: [2u8; 32],
      side: 0,
      size_usd: 10_000_000,
      collateral_usd: 1_000_000,
      entry_price: 50_000_000_000,
      unrealized_pnl_usd: 500_000,
    };

    // Build raw bytes: discriminator + borsh-serialized position
    let mut raw = POSITION_DISCRIMINATOR.to_vec();
    let serialized = position.try_to_vec().expect("serialize");
    raw.extend_from_slice(&serialized);

    let b64 = base64::engine::general_purpose::STANDARD.encode(&raw);
    let msg = serde_json::json!({
      "jsonrpc": "2.0",
      "method": "programNotification",
      "params": {
        "subscription": 42,
        "result": {
          "context": { "slot": 100 },
          "value": {
            "pubkey": "PositionAccount111111111111111111111111111111",
            "account": {
              "data": [b64, "base64"],
              "executable": false,
              "lamports": 1000000,
              "owner": "13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet",
              "rentEpoch": 0
            }
          }
        }
      }
    });

    let (tx, mut rx) = mpsc::channel(16);
    let result = handle_ws_message(&msg.to_string(), &tx).await;
    assert!(result.is_ok());

    let update = rx.recv().await.expect("should receive position update");
    assert_eq!(
      update.owner,
      solana_sdk::pubkey::Pubkey::from([1u8; 32]).to_string()
    );
    assert_eq!(update.side, "long");
    assert_eq!(update.size_usd, 10_000_000);
    assert_eq!(update.collateral_usd, 1_000_000);
    assert_eq!(update.entry_price, 50_000_000_000);
    assert_eq!(update.unrealized_pnl, 500_000);
    assert_eq!(update.leverage, 10);
  }

  #[tokio::test]
  async fn handle_malformed_json() {
    let (tx, _rx) = mpsc::channel(16);
    let result = handle_ws_message("not json at all", &tx).await;
    assert_eq!(result, Err(false));
  }

  #[tokio::test]
  async fn handle_channel_closed() {
    use borsh::BorshSerialize;

    let position = position_decoder::AdrenaPosition {
      owner: [1u8; 32],
      custody: [2u8; 32],
      side: 1,
      size_usd: 5_000_000,
      collateral_usd: 1_000_000,
      entry_price: 30_000_000_000,
      unrealized_pnl_usd: -100_000,
    };

    let mut raw = POSITION_DISCRIMINATOR.to_vec();
    raw.extend_from_slice(&position.try_to_vec().expect("serialize"));
    let b64 = base64::engine::general_purpose::STANDARD.encode(&raw);

    let msg = serde_json::json!({
      "jsonrpc": "2.0",
      "method": "programNotification",
      "params": {
        "subscription": 42,
        "result": {
          "context": { "slot": 100 },
          "value": {
            "pubkey": "PositionAccount111111111111111111111111111111",
            "account": {
              "data": [b64, "base64"],
              "executable": false,
              "lamports": 1000000,
              "owner": "13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet",
              "rentEpoch": 0
            }
          }
        }
      }
    });

    let (tx, rx) = mpsc::channel(16);
    drop(rx); // Close the receiver

    let result = handle_ws_message(&msg.to_string(), &tx).await;
    assert_eq!(result, Err(true));
  }
}
