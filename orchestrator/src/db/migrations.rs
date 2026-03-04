use deadpool_postgres::Pool;

use crate::error::AppError;

mod embedded {
  use refinery::embed_migrations;
  embed_migrations!("migrations");
}

/// Runs all pending database migrations.
///
/// Uses refinery to track and apply SQL migrations from the `migrations/` directory.
/// Migrations are embedded at compile time, so no external files are needed at runtime.
pub async fn run_migrations(pool: &Pool) -> Result<(), AppError> {
  let mut conn = pool.get().await?;
  // Deref chain: Object -> ClientWrapper -> tokio_postgres::Client
  // refinery's AsyncMigrate is implemented for tokio_postgres::Client
  let client: &mut tokio_postgres::Client = &mut **conn;
  embedded::migrations::runner()
    .run_async(client)
    .await
    .map_err(|e| AppError::Config(format!("Migration failed: {e}")))?;

  tracing::info!("Database migrations applied successfully");
  Ok(())
}
