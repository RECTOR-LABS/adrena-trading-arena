use std::sync::atomic::AtomicUsize;
use std::sync::Arc;

use axum::routing::get;
use axum::Router;
use clap::Parser;
use http::{HeaderName, Method};
use tokio::sync::broadcast;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

mod api;
mod config;
mod db;
mod error;
mod grpc;
mod lifecycle;
mod scoring;

use api::handlers;
use api::state::AppState;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
  tracing_subscriber::fmt()
    .with_env_filter(
      tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
    )
    .init();

  let config = config::Config::parse();

  tracing::info!("Arena Orchestrator starting...");
  tracing::info!(port = config.api_port, "API port");
  if let Some(ref grpc) = config.grpc_endpoint {
    tracing::info!(grpc = %grpc, "gRPC endpoint");
  } else {
    tracing::info!("gRPC endpoint not configured");
  }
  tracing::info!(arena = %config.arena_program_id, "Arena program");
  tracing::info!(adrena = %config.adrena_program_id, "Adrena program");

  // Create DB pool only if DATABASE_URL is provided
  let pool = match config.database_url {
    Some(ref url) => match db::pool::create_pool(url) {
      Ok(p) => {
        tracing::info!("Database pool created");
        Some(p)
      }
      Err(e) => {
        tracing::error!(error = %e, "Database pool creation failed");
        return Err(format!("Database pool creation failed: {e}").into());
      }
    },
    None => {
      tracing::warn!("DATABASE_URL not set — running without database");
      None
    }
  };

  // Run migrations if DB is available
  if let Some(ref pool) = pool {
    db::migrations::run_migrations(pool)
      .await
      .expect("Failed to run database migrations");
  }

  let (live_tx, _) = broadcast::channel::<String>(256);

  let state = Arc::new(AppState {
    pool,
    live_tx,
    sse_connections: Arc::new(AtomicUsize::new(0)),
  });

  // CORS: configurable origin whitelist, read-only methods
  let cors_origin = std::env::var("CORS_ORIGIN")
    .unwrap_or_else(|_| "http://localhost:3000".to_string());
  let cors = CorsLayer::new()
    .allow_origin(AllowOrigin::exact(
      cors_origin
        .parse::<http::HeaderValue>()
        .expect("Invalid CORS_ORIGIN value"),
    ))
    .allow_methods([Method::GET, Method::OPTIONS])
    .allow_headers([HeaderName::from_static("content-type")]);

  let app = Router::new()
    .route("/health", get(handlers::health::health))
    .route("/api/competitions", get(handlers::competitions::list_competitions))
    .route("/api/competitions/{id}", get(handlers::competitions::get_competition))
    .route(
      "/api/competitions/{id}/leaderboard",
      get(handlers::competitions::get_leaderboard),
    )
    .route("/api/agents/{mint}", get(handlers::agents::get_agent))
    .route(
      "/api/competitions/{id}/live",
      get(handlers::live::live_updates),
    )
    .layer(cors)
    .layer(TraceLayer::new_for_http())
    .with_state(state);

  let addr = format!("{}:{}", config.api_bind, config.api_port);
  tracing::info!(addr = %addr, "Listening");

  let listener = tokio::net::TcpListener::bind(&addr).await?;
  axum::serve(listener, app).await?;

  Ok(())
}
