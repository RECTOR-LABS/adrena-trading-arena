import { PublicKey } from '@solana/web3.js';

export interface AgentConfig {
  name: string;
  uri: string;
  strategyHash: Uint8Array;
  owner: PublicKey;
}

export interface AgentProfile {
  owner: PublicKey;
  mint: PublicKey;
  strategyHash: Uint8Array;
  eloRating: number;
  wins: number;
  losses: number;
  totalPnl: number;
  totalTrades: number;
  competitionsEntered: number;
  status: 'Active' | 'Suspended' | 'Retired';
  createdAt: number;
}
