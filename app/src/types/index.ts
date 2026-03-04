export interface Competition {
  id: string;
  on_chain_id: number;
  name: string;
  format: string;
  status: string;
  entry_fee: number;
  prize_pool: number;
  max_agents: number;
  registered_count: number;
  start_time: string;
  end_time: string;
}

export interface LeaderboardEntry {
  rank: number;
  agent_mint: string;
  agent_name: string;
  score: number;
  pnl: number;
  trades: number;
  win_rate: number;
  max_drawdown: number;
}

export interface Agent {
  mint: string;
  owner: string;
  name: string;
  elo_rating: number;
  wins: number;
  losses: number;
  total_pnl: number;
  total_trades: number;
  status: string;
}
