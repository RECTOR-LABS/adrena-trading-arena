use deadpool_postgres::{Config, Pool, Runtime};
use tokio_postgres::NoTls;

use crate::error::AppError;

/// Creates a PostgreSQL connection pool from a database URL.
///
/// The URL format is: `postgres://user:password@host:port/database`
pub fn create_pool(database_url: &str) -> Result<Pool, AppError> {
  // Parse the postgres URL into components.
  // Format: postgres://user:password@host:port/dbname
  let stripped = database_url
    .strip_prefix("postgres://")
    .or_else(|| database_url.strip_prefix("postgresql://"))
    .ok_or_else(|| AppError::Config("Database URL must start with postgres://".into()))?;

  // Split on @ to separate credentials from host
  let (creds, host_and_db) = stripped
    .split_once('@')
    .ok_or_else(|| AppError::Config("Database URL missing @ separator".into()))?;

  // Parse credentials
  let (user, password) = creds.split_once(':').unwrap_or((creds, ""));

  // Split host:port/dbname
  let (host_port, dbname) = host_and_db
    .split_once('/')
    .ok_or_else(|| AppError::Config("Database URL missing database name".into()))?;

  let (host, port_str) = host_port.split_once(':').unwrap_or((host_port, "5432"));
  let port: u16 = port_str
    .parse()
    .map_err(|_| AppError::Config(format!("Invalid port: {port_str}")))?;

  let mut cfg = Config::new();
  cfg.host = Some(host.to_string());
  cfg.port = Some(port);
  cfg.user = Some(user.to_string());
  cfg.password = if password.is_empty() {
    None
  } else {
    Some(password.to_string())
  };
  cfg.dbname = Some(dbname.to_string());

  cfg
    .create_pool(Some(Runtime::Tokio1), NoTls)
    .map_err(|e| AppError::Config(format!("Failed to create pool: {e}")))
}
