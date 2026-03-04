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
  async createAgent(config: AgentConfig): Promise<CreateAgentResult> {
    const mint = config.owner; // placeholder — real impl derives/creates mint
    const [agentPda] = this.getAgentPda(mint);
    const [arena] = this.getArenaPda();

    const txSig = await (this.program.methods['createAgent'] as (
      name: string,
      uri: string,
      strategyHash: Uint8Array,
    ) => ProgramMethodBuilder)(
      config.name,
      config.uri,
      config.strategyHash,
    )
      .accounts({
        arena,
        agent: agentPda,
        agentMint: mint,
        owner: this.provider.publicKey,
      })
      .rpc();

    return { agentPda, mint, txSig };
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

function requireField<T>(data: Record<string, unknown>, key: string, label: string): T {
  const value = data[key];
  if (value === undefined || value === null) {
    throw new Error(`Missing required field '${key}' in ${label}`);
  }
  return value as T;
}

function deserializeCompetition(_pubkey: PublicKey, raw: unknown): Competition {
  const data = raw as Record<string, unknown>;
  return {
    id: requireField<number>(data, 'id', 'Competition'),
    name: requireField<string>(data, 'name', 'Competition'),
    arena: requireField<PublicKey>(data, 'arena', 'Competition'),
    format: requireField<Competition['format']>(data, 'format', 'Competition'),
    status: requireField<Competition['status']>(data, 'status', 'Competition'),
    entryFee: requireField<number>(data, 'entryFee', 'Competition'),
    prizePool: requireField<number>(data, 'prizePool', 'Competition'),
    maxAgents: requireField<number>(data, 'maxAgents', 'Competition'),
    registeredCount: requireField<number>(data, 'registeredCount', 'Competition'),
    startTime: requireField<number>(data, 'startTime', 'Competition'),
    endTime: requireField<number>(data, 'endTime', 'Competition'),
    prizeMint: requireField<PublicKey>(data, 'prizeMint', 'Competition'),
  };
}

function deserializeLeaderboardEntry(raw: unknown, rank: number): LeaderboardEntry {
  const data = raw as Record<string, unknown>;
  return {
    agentMint: requireField<PublicKey>(data, 'agentMint', 'LeaderboardEntry'),
    agentName: (data['agentName'] as string | undefined) ?? 'Unknown',
    rank,
    score: (data['score'] as number | undefined) ?? 0,
    pnl: (data['pnl'] as number | undefined) ?? 0,
    trades: (data['trades'] as number | undefined) ?? 0,
    winRate: (data['winRate'] as number | undefined) ?? 0,
  };
}

function deserializeAgentProfile(raw: unknown): AgentProfile {
  const data = raw as Record<string, unknown>;
  return {
    owner: requireField<PublicKey>(data, 'owner', 'AgentProfile'),
    mint: requireField<PublicKey>(data, 'mint', 'AgentProfile'),
    strategyHash: requireField<Uint8Array>(data, 'strategyHash', 'AgentProfile'),
    eloRating: requireField<number>(data, 'eloRating', 'AgentProfile'),
    wins: requireField<number>(data, 'wins', 'AgentProfile'),
    losses: requireField<number>(data, 'losses', 'AgentProfile'),
    totalPnl: requireField<number>(data, 'totalPnl', 'AgentProfile'),
    totalTrades: requireField<number>(data, 'totalTrades', 'AgentProfile'),
    competitionsEntered: requireField<number>(data, 'competitionsEntered', 'AgentProfile'),
    status: requireField<AgentProfile['status']>(data, 'status', 'AgentProfile'),
    createdAt: requireField<number>(data, 'createdAt', 'AgentProfile'),
  };
}
