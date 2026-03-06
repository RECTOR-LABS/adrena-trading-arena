import { describe, it, expect } from 'vitest';
import { PublicKey, Keypair } from '@solana/web3.js';
import { findArenaPda, findAgentPda, findCompetitionPda, findEnrollmentPda, findPrizeVaultPda } from './pda';

const PROGRAM_ID = new PublicKey('PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6');

describe('PDA derivations', () => {
  it('derives arena PDA deterministically', () => {
    const [pda1] = findArenaPda(PROGRAM_ID);
    const [pda2] = findArenaPda(PROGRAM_ID);
    expect(pda1.toBase58()).toBe(pda2.toBase58());
  });

  it('derives different agent PDAs for different mints', () => {
    const mint1 = Keypair.generate().publicKey;
    const mint2 = Keypair.generate().publicKey;
    const [pda1] = findAgentPda(mint1, PROGRAM_ID);
    const [pda2] = findAgentPda(mint2, PROGRAM_ID);
    expect(pda1.toBase58()).not.toBe(pda2.toBase58());
  });

  it('derives competition PDA with correct id encoding', () => {
    const arena = Keypair.generate().publicKey;
    const [pda1] = findCompetitionPda(arena, 0, PROGRAM_ID);
    const [pda2] = findCompetitionPda(arena, 1, PROGRAM_ID);
    expect(pda1.toBase58()).not.toBe(pda2.toBase58());
  });

  it('throws for negative competition ID', () => {
    const arena = Keypair.generate().publicKey;
    expect(() => findCompetitionPda(arena, -1, PROGRAM_ID)).toThrow('Competition ID must be non-negative');
  });

  it('derives enrollment PDA from competition + agent', () => {
    const competition = Keypair.generate().publicKey;
    const agent = Keypair.generate().publicKey;
    const [pda1] = findEnrollmentPda(competition, agent, PROGRAM_ID);
    const [pda2] = findEnrollmentPda(competition, agent, PROGRAM_ID);
    expect(pda1.toBase58()).toBe(pda2.toBase58());
  });

  it('derives prize vault PDA from competition', () => {
    const competition = Keypair.generate().publicKey;
    const [pda] = findPrizeVaultPda(competition, PROGRAM_ID);
    expect(pda).toBeTruthy();
  });
});
