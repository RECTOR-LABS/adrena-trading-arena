import { PublicKey } from '@solana/web3.js';
import type { AgentConfig, AgentProfile, Competition, LeaderboardEntry } from '../types';
import { findArenaPda, findAgentPda, findCompetitionPda, findEnrollmentPda } from '../utils/pda';

/**
 * Minimal interface for the Anchor program object.
 * Defined here so we don't depend on a generated IDL — once the IDL
 * is available, replace this with the generated `Program<ArenaIdl>` type.
 */
export interface ArenaProgram {
  readonly programId: PublicKey;
  methods: Record<string, (...args: unknown[]) => ProgramMethodBuilder>;
  account: Record<string, { fetch(address: PublicKey): Promise<unknown>; all(): Promise<Array<{ publicKey: PublicKey; account: unknown }>> }>;
}

interface ProgramMethodBuilder {
  accounts(accs: Record<string, PublicKey>): ProgramMethodBuilder;
  signers(signers: unknown[]): ProgramMethodBuilder;
  rpc(): Promise<string>;
}

export interface ArenaProvider {
  publicKey: PublicKey;
}

export interface CreateAgentResult {
  agentPda: PublicKey;
  mint: PublicKey;
  txSig: string;
}

export interface EnrollAgentResult {
  enrollmentPda: PublicKey;
  txSig: string;
}

export class ArenaClient {
  readonly programId: PublicKey;
  private program: ArenaProgram;
  private provider: ArenaProvider;

  constructor(program: ArenaProgram, provider: ArenaProvider, programId?: PublicKey) {
    this.program = program;
    this.provider = provider;
    this.programId = programId ?? program.programId;
  }

  /**
   * Derives the arena PDA. Used internally by instruction methods.
   */
  getArenaPda(): [PublicKey, number] {
    return findArenaPda(this.programId);
  }

  /**
   * Derives an agent PDA from the agent's mint.
   */
  getAgentPda(mint: PublicKey): [PublicKey, number] {
    return findAgentPda(mint, this.programId);
  }

  /**
   * Derives a competition PDA.
   */
  getCompetitionPda(id: number): [PublicKey, number] {
    const [arena] = this.getArenaPda();
    return findCompetitionPda(arena, id, this.programId);
  }

  /**
   * Derives an enrollment PDA.
   */
  getEnrollmentPda(competitionPda: PublicKey, agentPda: PublicKey): [PublicKey, number] {
    return findEnrollmentPda(competitionPda, agentPda, this.programId);
  }

  /**
   * Create an agent NFT and on-chain profile.
   *
   * NOTE: Account layout depends on the generated IDL. The accounts
   * record below is a best-effort mapping that will need adjustment
   * once we have the actual IDL instruction context.
   */
  async createAgent(_config: AgentConfig): Promise<CreateAgentResult> {
    throw new Error('createAgent: mint creation not yet implemented. Use the on-chain program directly.');
  }

  /**
   * Enroll an existing agent into a competition.
   */
  async enrollAgent(agentMint: PublicKey, competitionId: number): Promise<EnrollAgentResult> {
    const [agentPda] = this.getAgentPda(agentMint);
    const [competitionPda] = this.getCompetitionPda(competitionId);
    const [enrollmentPda] = this.getEnrollmentPda(competitionPda, agentPda);

    const txSig = await (this.program.methods['enrollAgent'] as () => ProgramMethodBuilder)()
      .accounts({
        competition: competitionPda,
        agent: agentPda,
        enrollment: enrollmentPda,
        agentMint,
        owner: this.provider.publicKey,
      })
      .rpc();

    return { enrollmentPda, txSig };
  }

  /**
   * Fetch all competitions from the on-chain program.
   */
  async getCompetitions(): Promise<Competition[]> {
    const raw = await this.program.account['competition'].all();
    return raw.map((entry) => deserializeCompetition(entry.publicKey, entry.account));
  }

  /**
   * Fetch leaderboard entries for a specific competition.
   * In a full impl, this would aggregate enrollment + agent data.
   * For now it fetches enrollments and maps to LeaderboardEntry shape.
   */
  async getLeaderboard(competitionId: number): Promise<LeaderboardEntry[]> {
    const [competitionPda] = this.getCompetitionPda(competitionId);
    // Uses memcmp filter once IDL is finalized; currently fetches all enrollments
    const raw = await this.program.account['enrollment'].all();

    const entries = raw
      .filter((e) => {
        const acct = e.account as Record<string, unknown>;
        const comp = acct['competition'] as PublicKey | undefined;
        return comp?.equals(competitionPda);
      })
      .map((e, idx) => deserializeLeaderboardEntry(e.account, idx + 1));

    return entries.sort((a, b) => a.rank - b.rank);
  }

  /**
   * Fetch an agent's on-chain profile by mint.
   */
  async getAgentProfile(mint: PublicKey): Promise<AgentProfile> {
    const [agentPda] = this.getAgentPda(mint);
    const raw = await this.program.account['agent'].fetch(agentPda);
    return deserializeAgentProfile(raw);
  }
}

// ---------------------------------------------------------------------------
// Deserialization helpers — these map raw Anchor account data to our types.
// The exact field names depend on the IDL; these are best-effort mappings
// that should be verified once the IDL is generated.
// ---------------------------------------------------------------------------

function requireNumber(data: Record<string, unknown>, key: string, label: string): number {
  const value = data[key];
  if (value === undefined || value === null) throw new Error(`Missing required field '${key}' in ${label}`);
  if (typeof value === 'number') return value;
  // Handle BN objects from Anchor
  if (typeof value === 'object' && 'toNumber' in (value as object)) return (value as { toNumber(): number }).toNumber();
  throw new Error(`Expected number for '${key}' in ${label}, got ${typeof value}`);
}

function requireString(data: Record<string, unknown>, key: string, label: string): string {
  const value = data[key];
  if (value === undefined || value === null) throw new Error(`Missing required field '${key}' in ${label}`);
  if (typeof value !== 'string') throw new Error(`Expected string for '${key}' in ${label}, got ${typeof value}`);
  return value;
}

function requirePublicKey(data: Record<string, unknown>, key: string, label: string): PublicKey {
  const value = data[key];
  if (value === undefined || value === null) throw new Error(`Missing required field '${key}' in ${label}`);
  if (value instanceof PublicKey) return value;
  // Handle raw bytes
  if (value instanceof Uint8Array) return new PublicKey(value);
  if (typeof value === 'string') return new PublicKey(value);
  throw new Error(`Expected PublicKey for '${key}' in ${label}, got ${typeof value}`);
}

function assertObject(raw: unknown, label: string): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Expected object for ${label}, got ${typeof raw}`);
  }
  return raw as Record<string, unknown>;
}

function deserializeCompetition(_pubkey: PublicKey, raw: unknown): Competition {
  const data = assertObject(raw, 'Competition');
  return {
    id: requireNumber(data, 'id', 'Competition'),
    name: requireString(data, 'name', 'Competition'),
    arena: requirePublicKey(data, 'arena', 'Competition'),
    format: requireString(data, 'format', 'Competition') as Competition['format'],
    status: requireString(data, 'status', 'Competition') as Competition['status'],
    entryFee: requireNumber(data, 'entryFee', 'Competition'),
    prizePool: requireNumber(data, 'prizePool', 'Competition'),
    maxAgents: requireNumber(data, 'maxAgents', 'Competition'),
    registeredCount: requireNumber(data, 'registeredCount', 'Competition'),
    startTime: requireNumber(data, 'startTime', 'Competition'),
    endTime: requireNumber(data, 'endTime', 'Competition'),
    prizeMint: requirePublicKey(data, 'prizeMint', 'Competition'),
  };
}

function deserializeLeaderboardEntry(raw: unknown, rank: number): LeaderboardEntry {
  const data = assertObject(raw, 'LeaderboardEntry');
  return {
    agentMint: requirePublicKey(data, 'agentMint', 'LeaderboardEntry'),
    agentName: typeof data['agentName'] === 'string' ? data['agentName'] : 'Unknown',
    rank,
    score: typeof data['score'] === 'number' ? data['score'] : 0,
    pnl: typeof data['pnl'] === 'number' ? data['pnl'] : 0,
    trades: typeof data['trades'] === 'number' ? data['trades'] : 0,
    winRate: typeof data['winRate'] === 'number' ? data['winRate'] : 0,
  };
}

function deserializeAgentProfile(raw: unknown): AgentProfile {
  const data = assertObject(raw, 'AgentProfile');
  return {
    owner: requirePublicKey(data, 'owner', 'AgentProfile'),
    mint: requirePublicKey(data, 'mint', 'AgentProfile'),
    strategyHash: data['strategyHash'] instanceof Uint8Array
      ? data['strategyHash']
      : (() => { throw new Error(`Expected Uint8Array for 'strategyHash' in AgentProfile`); })(),
    eloRating: requireNumber(data, 'eloRating', 'AgentProfile'),
    wins: requireNumber(data, 'wins', 'AgentProfile'),
    losses: requireNumber(data, 'losses', 'AgentProfile'),
    totalPnl: requireNumber(data, 'totalPnl', 'AgentProfile'),
    totalTrades: requireNumber(data, 'totalTrades', 'AgentProfile'),
    competitionsEntered: requireNumber(data, 'competitionsEntered', 'AgentProfile'),
    status: requireString(data, 'status', 'AgentProfile') as AgentProfile['status'],
    createdAt: requireNumber(data, 'createdAt', 'AgentProfile'),
  };
}
