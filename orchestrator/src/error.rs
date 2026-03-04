use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
  #[error("Database error: {0}")]
  Database(#[from] tokio_postgres::Error),

  #[error("Pool error: {0}")]
  Pool(#[from] deadpool_postgres::PoolError),

  #[error("Config error: {0}")]
  Config(String),

  #[error("Solana error: {0}")]
  Solana(String),

  #[error("Not found: {0}")]
  NotFound(String),

  #[error("Internal error: {0}")]
  Internal(String),
}
