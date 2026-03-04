import { describe, it, expect } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { ArenaClient } from './arena-client';
import { findArenaPda, findAgentPda, findCompetitionPda, findEnrollmentPda } from '../utils/pda';

const PROGRAM_ID = new PublicKey('PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6');

describe('ArenaClient', () => {
  // Minimal mock program that satisfies the ArenaProgram interface
  const mockProgram = {
    programId: PROGRAM_ID,
    methods: {},
    account: {},
  };

  const mockProvider = {
    publicKey: PublicKey.default,
  };

  const client = new ArenaClient(mockProgram, mockProvider);

  describe('PDA derivation wiring', () => {
    it('derives arena PDA correctly', () => {
      const [pda, bump] = client.getArenaPda();
      const [expected, expectedBump] = findArenaPda(PROGRAM_ID);
      expect(pda.equals(expected)).toBe(true);
      expect(bump).toBe(expectedBump);
    });

    it('derives agent PDA correctly', () => {
      const mint = PublicKey.unique();
      const [pda, bump] = client.getAgentPda(mint);
      const [expected, expectedBump] = findAgentPda(mint, PROGRAM_ID);
      expect(pda.equals(expected)).toBe(true);
      expect(bump).toBe(expectedBump);
    });

    it('derives competition PDA correctly', () => {
      const [pda, bump] = client.getCompetitionPda(1);
      const [arena] = findArenaPda(PROGRAM_ID);
      const [expected, expectedBump] = findCompetitionPda(arena, 1, PROGRAM_ID);
      expect(pda.equals(expected)).toBe(true);
      expect(bump).toBe(expectedBump);
    });

    it('derives enrollment PDA correctly', () => {
      const compPda = PublicKey.unique();
      const agentPda = PublicKey.unique();
      const [pda, bump] = client.getEnrollmentPda(compPda, agentPda);
      const [expected, expectedBump] = findEnrollmentPda(compPda, agentPda, PROGRAM_ID);
      expect(pda.equals(expected)).toBe(true);
      expect(bump).toBe(expectedBump);
    });
  });

  describe('constructor', () => {
    it('uses program.programId by default', () => {
      expect(client.programId.equals(PROGRAM_ID)).toBe(true);
    });

    it('allows overriding programId', () => {
      const customId = PublicKey.unique();
      const customClient = new ArenaClient(mockProgram, mockProvider, customId);
      expect(customClient.programId.equals(customId)).toBe(true);
    });
  });

  describe('method signatures', () => {
    it('has createAgent method', () => {
      expect(typeof client.createAgent).toBe('function');
    });

    it('has enrollAgent method', () => {
      expect(typeof client.enrollAgent).toBe('function');
    });

    it('has getCompetitions method', () => {
      expect(typeof client.getCompetitions).toBe('function');
    });

    it('has getLeaderboard method', () => {
      expect(typeof client.getLeaderboard).toBe('function');
    });

    it('has getAgentProfile method', () => {
      expect(typeof client.getAgentProfile).toBe('function');
    });
  });
});
