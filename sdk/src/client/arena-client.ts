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

function deserializeCompetition(_pubkey: PublicKey, raw: unknown): Competition {
  const data = raw as Record<string, unknown>;
  return {
    id: data['id'] as number,
    name: data['name'] as string,
    arena: data['arena'] as PublicKey,
    format: data['format'] as Competition['format'],
    status: data['status'] as Competition['status'],
    entryFee: data['entryFee'] as number,
    prizePool: data['prizePool'] as number,
    maxAgents: data['maxAgents'] as number,
    registeredCount: data['registeredCount'] as number,
    startTime: data['startTime'] as number,
    endTime: data['endTime'] as number,
    prizeMint: data['prizeMint'] as PublicKey,
  };
}

function deserializeLeaderboardEntry(raw: unknown, rank: number): LeaderboardEntry {
  const data = raw as Record<string, unknown>;
  return {
    agentMint: data['agentMint'] as PublicKey,
    agentName: data['agentName'] as string ?? 'Unknown',
    rank,
    score: data['score'] as number ?? 0,
    pnl: data['pnl'] as number ?? 0,
    trades: data['trades'] as number ?? 0,
    winRate: data['winRate'] as number ?? 0,
  };
}

function deserializeAgentProfile(raw: unknown): AgentProfile {
  const data = raw as Record<string, unknown>;
  return {
    owner: data['owner'] as PublicKey,
    mint: data['mint'] as PublicKey,
    strategyHash: data['strategyHash'] as Uint8Array,
    eloRating: data['eloRating'] as number,
    wins: data['wins'] as number,
    losses: data['losses'] as number,
    totalPnl: data['totalPnl'] as number,
    totalTrades: data['totalTrades'] as number,
    competitionsEntered: data['competitionsEntered'] as number,
    status: data['status'] as AgentProfile['status'],
    createdAt: data['createdAt'] as number,
  };
}
