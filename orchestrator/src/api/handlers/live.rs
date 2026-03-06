use std::convert::Infallible;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::{Path, State};
use axum::response::sse::{Event, KeepAlive, Sse};
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;
use uuid::Uuid;

use crate::api::state::{AppState, MAX_SSE_CONNECTIONS};
use crate::error::AppError;

/// GET /api/competitions/:id/live — Server-Sent Events stream for live updates.
///
/// Clients receive real-time position updates, trades, and score changes
/// for the specified competition. The stream sends keepalive pings every
/// 15 seconds to maintain the connection.
///
/// Messages are filtered to only include events for the subscribed competition.
/// Connection count is tracked and limited to prevent resource exhaustion.
pub async fn live_updates(
  State(state): State<Arc<AppState>>,
  Path(id): Path<String>,
) -> Result<Sse<impl tokio_stream::Stream<Item = Result<Event, Infallible>>>, AppError> {
  let competition_id = Uuid::parse_str(&id)
    .map_err(|_| AppError::NotFound(format!("Invalid competition ID: {id}")))?;

  // Enforce SSE connection limit
  let current = state.sse_connections.fetch_add(1, Ordering::Relaxed);
  if current >= MAX_SSE_CONNECTIONS {
    state.sse_connections.fetch_sub(1, Ordering::Relaxed);
    return Err(AppError::ServiceUnavailable(
      "Too many SSE connections".to_string(),
    ));
  }

  let sse_counter = Arc::clone(&state.sse_connections);
  let rx = state.live_tx.subscribe();

  let stream = BroadcastStream::new(rx).filter_map(move |result| match result {
    Ok(data) => {
      // Filter: only forward messages that contain the subscribed competition ID.
      // Messages are expected to be JSON with a "competition_id" field.
      let cid_str = competition_id.to_string();
      if data.contains(&cid_str) {
        Some(Ok(Event::default().data(data)))
      } else {
        None
      }
    }
    Err(e) => {
      tracing::warn!("SSE broadcast lag: {e}");
      None
    }
  });

  // Wrap the stream with an RAII guard that decrements the connection count on drop
  let guarded_stream = GuardedStream {
    inner: Box::pin(stream),
    _guard: SseConnectionGuard { counter: sse_counter },
  };

  Ok(
    Sse::new(guarded_stream).keep_alive(
      KeepAlive::new()
        .interval(Duration::from_secs(15))
        .text("ping"),
    ),
  )
}

/// RAII guard that decrements the SSE connection counter when the stream is dropped
/// (i.e., when the client disconnects).
struct SseConnectionGuard {
  counter: Arc<std::sync::atomic::AtomicUsize>,
}

impl Drop for SseConnectionGuard {
  fn drop(&mut self) {
    self.counter.fetch_sub(1, Ordering::Relaxed);
  }
}

/// Stream wrapper that holds the RAII guard for connection tracking.
/// When the stream is dropped (client disconnect), the guard decrements the counter.
struct GuardedStream<S> {
  inner: std::pin::Pin<Box<S>>,
  _guard: SseConnectionGuard,
}

impl<S> tokio_stream::Stream for GuardedStream<S>
where
  S: tokio_stream::Stream + Unpin,
{
  type Item = S::Item;

  fn poll_next(
    mut self: std::pin::Pin<&mut Self>,
    cx: &mut std::task::Context<'_>,
  ) -> std::task::Poll<Option<Self::Item>> {
    self.inner.as_mut().poll_next(cx)
  }
}
