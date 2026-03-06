import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

const ARENA_SEED = Buffer.from('arena');
const AGENT_SEED = Buffer.from('agent');
const COMPETITION_SEED = Buffer.from('competition');
const ENROLLMENT_SEED = Buffer.from('enrollment');
const PRIZE_VAULT_SEED = Buffer.from('prize_vault');

export function findArenaPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([ARENA_SEED], programId);
}

export function findAgentPda(mint: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([AGENT_SEED, mint.toBuffer()], programId);
}

export function findCompetitionPda(arena: PublicKey, id: number | BN, programId: PublicKey): [PublicKey, number] {
  const idBn = BN.isBN(id) ? id : new BN(id);
  if (idBn.isNeg()) throw new Error('Competition ID must be non-negative');
  return PublicKey.findProgramAddressSync(
    [COMPETITION_SEED, arena.toBuffer(), idBn.toArrayLike(Buffer, 'le', 8)],
    programId
  );
}

export function findEnrollmentPda(competition: PublicKey, agent: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ENROLLMENT_SEED, competition.toBuffer(), agent.toBuffer()],
    programId
  );
}

export function findPrizeVaultPda(competition: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PRIZE_VAULT_SEED, competition.toBuffer()],
    programId
  );
}
