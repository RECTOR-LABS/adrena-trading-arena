use clap::Parser;

#[derive(Parser, Debug, Clone)]
pub struct Config {
  #[arg(long, env = "DATABASE_URL", default_value = "postgres://arena:arena@localhost:5432/arena")]
  pub database_url: String,

  #[arg(long, env = "GRPC_ENDPOINT", default_value = "http://localhost:10000")]
  pub grpc_endpoint: String,

  #[arg(long, env = "ADRENA_PROGRAM_ID", default_value = "13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet")]
  pub adrena_program_id: String,

  #[arg(long, env = "ARENA_PROGRAM_ID", default_value = "PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6")]
  pub arena_program_id: String,

  #[arg(long, env = "API_PORT", default_value = "8080")]
  pub api_port: u16,
}
