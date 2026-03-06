import { PublicKey } from '@solana/web3.js';

export type CompetitionFormat = 'Season' | 'FlashDuel' | 'Bracket' | 'Sandbox';
export type CompetitionStatus = 'Pending' | 'Registration' | 'Active' | 'Scoring' | 'Settled';

export interface Competition {
  id: number;
  name: string;
  arena: PublicKey;
  format: CompetitionFormat;
  status: CompetitionStatus;
  entryFee: number;
  prizePool: number;
  maxAgents: number;
  registeredCount: number;
  startTime: number;
  endTime: number;
  prizeMint: PublicKey;
}

export interface LeaderboardEntry {
  agentMint: PublicKey;
  agentName: string;
  rank: number;
  score: number;
  pnl: number;
  trades: number;
  winRate: number;
}
