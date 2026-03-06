use std::sync::atomic::AtomicUsize;
use std::sync::Arc;

use deadpool_postgres::Pool;
use tokio::sync::broadcast;

/// Maximum number of concurrent SSE connections allowed.
pub const MAX_SSE_CONNECTIONS: usize = 1000;

/// Shared application state passed to all Axum handlers via `State<Arc<AppState>>`.
pub struct AppState {
  /// Database connection pool. `None` when DATABASE_URL is not set.
  pub pool: Option<Pool>,
  /// Broadcast channel for SSE live updates to connected clients.
  pub live_tx: broadcast::Sender<String>,
  /// Current number of active SSE connections.
  pub sse_connections: Arc<AtomicUsize>,
}
