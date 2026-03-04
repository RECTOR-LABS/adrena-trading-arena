use deadpool_postgres::Pool;
use tokio::sync::broadcast;

/// Shared application state passed to all Axum handlers via `State<Arc<AppState>>`.
pub struct AppState {
  /// Database connection pool. `None` in skeleton mode (no DB connected).
  pub pool: Option<Pool>,
  /// Broadcast channel for SSE live updates to connected clients.
  pub live_tx: broadcast::Sender<String>,
}
