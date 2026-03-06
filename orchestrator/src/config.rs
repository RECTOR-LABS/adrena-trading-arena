use clap::Parser;

#[derive(Parser, Debug, Clone)]
pub struct Config {
  #[arg(long, env = "DATABASE_URL")]
  pub database_url: Option<String>,

  #[arg(long, env = "GRPC_ENDPOINT")]
  pub grpc_endpoint: Option<String>,

  /// Solana WebSocket RPC URL for programSubscribe (devnet-compatible).
  #[arg(long, env = "WS_RPC_URL", default_value = "wss://api.devnet.solana.com")]
  pub ws_rpc_url: String,

  /// Use MockPositionSubscriber instead of the real WebSocket subscriber.
  #[arg(long, env = "USE_MOCK_SUBSCRIBER", default_value = "true")]
  pub use_mock_subscriber: bool,

  #[arg(long, env = "ADRENA_PROGRAM_ID", default_value = "13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet")]
  pub adrena_program_id: String,

  #[arg(long, env = "ARENA_PROGRAM_ID", default_value = "PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6")]
  pub arena_program_id: String,

  #[arg(long, env = "API_BIND", default_value = "0.0.0.0")]
  pub api_bind: String,

  #[arg(long, env = "API_PORT", default_value = "8080")]
  pub api_port: u16,
}
