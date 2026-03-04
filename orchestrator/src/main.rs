use std::sync::Arc;

use axum::routing::get;
use axum::Router;
use clap::Parser;
use tokio::sync::broadcast;
use tower_http::cors::CorsLayer;
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
  tracing::info!(grpc = %config.grpc_endpoint, "gRPC endpoint");
  tracing::info!(arena = %config.arena_program_id, "Arena program");
  tracing::info!(adrena = %config.adrena_program_id, "Adrena program");

  // Attempt DB connection if DATABASE_URL is set to a reachable host.
  // Falls back to skeleton mode (pool = None) if connection fails.
  let pool = match db::pool::create_pool(&config.database_url) {
    Ok(p) => {
      tracing::info!("Database pool created");
      Some(p)
    }
    Err(e) => {
      tracing::warn!(error = %e, "Database pool creation failed — running in skeleton mode");
      None
    }
  };

  let (live_tx, _) = broadcast::channel::<String>(256);

  let state = Arc::new(AppState { pool, live_tx });

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
    .layer(CorsLayer::permissive())
    .layer(TraceLayer::new_for_http())
    .with_state(state);

  let addr = format!("0.0.0.0:{}", config.api_port);
  tracing::info!(addr = %addr, "Listening");

  let listener = tokio::net::TcpListener::bind(&addr).await?;
  axum::serve(listener, app).await?;

  Ok(())
}
