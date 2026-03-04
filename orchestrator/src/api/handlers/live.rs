use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::{Path, State};
use axum::response::sse::{Event, KeepAlive, Sse};
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;
use uuid::Uuid;

use crate::api::state::AppState;
use crate::error::AppError;

/// GET /api/competitions/:id/live — Server-Sent Events stream for live updates.
///
/// Clients receive real-time position updates, trades, and score changes
/// for the specified competition. The stream sends keepalive pings every
/// 15 seconds to maintain the connection.
pub async fn live_updates(
  State(state): State<Arc<AppState>>,
  Path(id): Path<String>,
) -> Result<Sse<impl tokio_stream::Stream<Item = Result<Event, Infallible>>>, AppError> {
  let _uuid = Uuid::parse_str(&id)
    .map_err(|_| AppError::NotFound(format!("Invalid competition ID: {id}")))?;

  let rx = state.live_tx.subscribe();
  let stream = BroadcastStream::new(rx).filter_map(|result| match result {
    Ok(data) => Some(Ok(Event::default().data(data))),
    Err(_) => None,
  });

  Ok(
    Sse::new(stream).keep_alive(
      KeepAlive::new()
        .interval(Duration::from_secs(15))
        .text("ping"),
    ),
  )
}
