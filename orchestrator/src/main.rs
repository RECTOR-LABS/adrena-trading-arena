use clap::Parser;

mod api;
mod config;
mod db;
mod error;
mod scoring;

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

  // Pool and migration would run here with a real DB:
  //
  //   let pool = db::pool::create_pool(&config.database_url)?;
  //   db::migrations::run_migrations(&pool).await?;
  //
  // For now, verify the build compiles cleanly.

  tracing::info!("Arena Orchestrator ready (no DB connected in skeleton mode)");
  Ok(())
}
