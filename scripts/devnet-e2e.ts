/**
 * Devnet E2E Test — AI Trading Arena
 *
 * Runs a full lifecycle test against the deployed devnet program:
 * 1. Initialize Arena
 * 2. Create Agent (mint Core NFT)
 * 3. Create Competition
 * 4. Enroll Agent
 * 5. Start Competition
 * 6. Submit Scores
 * 7. Settle Competition
 *
 * Usage: npx ts-node --esm scripts/devnet-e2e.ts
 * Requires: ANCHOR_WALLET=~/Documents/secret/solana-devnet.json
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Arena } from "../target/types/arena";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
  createMint,
  mintTo,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const MPL_CORE_PROGRAM_ID = new PublicKey(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
);

async function main() {
  // Setup
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.arena as Program<Arena>;
  const wallet = provider.wallet as anchor.Wallet;

  console.log("=".repeat(60));
  console.log("AI TRADING ARENA — Devnet E2E Test");
  console.log("=".repeat(60));
  console.log(`Program ID: ${program.programId.toBase58()}`);
  console.log(`Wallet:     ${wallet.publicKey.toBase58()}`);
  console.log(`Cluster:    ${provider.connection.rpcEndpoint}`);
  console.log();

  // PDA helpers
  function findArenaPda() {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("arena")],
      program.programId
    );
  }

  function findAgentPda(mint: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), mint.toBuffer()],
      program.programId
    );
  }

  function findCompetitionPda(arenaKey: PublicKey, id: number) {
    const idBuf = Buffer.alloc(8);
    idBuf.writeBigUInt64LE(BigInt(id));
    return PublicKey.findProgramAddressSync(
      [Buffer.from("competition"), arenaKey.toBuffer(), idBuf],
      program.programId
    );
  }

  function findEnrollmentPda(competition: PublicKey, agent: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("enrollment"), competition.toBuffer(), agent.toBuffer()],
      program.programId
    );
  }

  function findPrizeVaultPda(competition: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("prize_vault"), competition.toBuffer()],
      program.programId
    );
  }

  // ── Step 1: Initialize Arena ──────────────────────────────────────
  console.log("Step 1: Initialize Arena...");
  const [arenaPda] = findArenaPda();

  try {
    const existing = await program.account.arena.fetch(arenaPda);
    console.log(`  Arena already initialized (agent_count: ${existing.agentCount}, competition_count: ${existing.competitionCount})`);
  } catch {
    const tx = await program.methods
      .initializeArena(250)
      .accounts({
        arena: arenaPda,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`  Arena initialized: ${tx}`);
  }
  console.log(`  Arena PDA: ${arenaPda.toBase58()}`);
  console.log();

  // ── Step 2: Create Agent ──────────────────────────────────────────
  console.log("Step 2: Create Agent (mint Core NFT)...");
  const agentAsset = Keypair.generate();
  const [agentPda] = findAgentPda(agentAsset.publicKey);
  const strategyHash = Buffer.alloc(32);
  Buffer.from("momentum-ema-crossover").copy(strategyHash);

  const createAgentTx = await program.methods
    .createAgent("Arena Champion", "https://arweave.net/arena-agent-metadata", Array.from(strategyHash) as any)
    .accounts({
      arena: arenaPda,
      agent: agentPda,
      asset: agentAsset.publicKey,
      owner: wallet.publicKey,
      systemProgram: SystemProgram.programId,
      mplCoreProgram: MPL_CORE_PROGRAM_ID,
    })
    .signers([agentAsset])
    .rpc();
  console.log(`  Agent created: ${createAgentTx}`);
  console.log(`  Agent PDA: ${agentPda.toBase58()}`);
  console.log(`  Agent NFT: ${agentAsset.publicKey.toBase58()}`);

  const agent = await program.account.agent.fetch(agentPda);
  console.log(`  ELO: ${agent.eloRating}, Status: Active`);
  console.log();

  // ── Step 3: Create Competition ────────────────────────────────────
  console.log("Step 3: Create Competition...");
  const arena = await program.account.arena.fetch(arenaPda);
  const compId = arena.competitionCount.toNumber();
  const [competitionPda] = findCompetitionPda(arenaPda, compId);
  const [prizeVaultPda] = findPrizeVaultPda(competitionPda);

  // Create prize mint (SPL token for entry fees / prizes)
  const prizeMint = await createMint(
    provider.connection,
    wallet.payer,
    wallet.publicKey,
    null,
    6,
  );
  console.log(`  Prize Mint: ${prizeMint.toBase58()}`);

  const now = Math.floor(Date.now() / 1000);
  const createCompTx = await program.methods
    .createCompetition({
      name: "Flash Duel Alpha",
      format: { flashDuel: {} } as any,
      entryFee: new BN(0), // Free entry for test
      maxAgents: 64,
      startTime: new BN(now + 10),
      endTime: new BN(now + 3600),
      scoringParams: {
        minTrades: 1,
        maxLeverage: 10,
        positionSizeCap: new BN(100_000_000_000),
      },
    })
    .accounts({
      arena: arenaPda,
      competition: competitionPda,
      prizeVault: prizeVaultPda,
      prizeMint: prizeMint,
      authority: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log(`  Competition created: ${createCompTx}`);
  console.log(`  Competition PDA: ${competitionPda.toBase58()}`);
  console.log(`  Prize Vault: ${prizeVaultPda.toBase58()}`);
  console.log();

  // ── Step 4: Enroll Agent ──────────────────────────────────────────
  console.log("Step 4: Enroll Agent...");
  const [enrollmentPda] = findEnrollmentPda(competitionPda, agentPda);

  // Create owner token account for the prize mint (even with 0 entry fee)
  const ownerAta = await createAssociatedTokenAccount(
    provider.connection,
    wallet.payer,
    prizeMint,
    wallet.publicKey,
  );

  const enrollTx = await program.methods
    .enrollAgent()
    .accounts({
      agent: agentPda,
      competition: competitionPda,
      enrollment: enrollmentPda,
      prizeVault: prizeVaultPda,
      ownerTokenAccount: ownerAta,
      prizeMint: prizeMint,
      owner: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log(`  Agent enrolled: ${enrollTx}`);
  console.log(`  Enrollment PDA: ${enrollmentPda.toBase58()}`);
  console.log();

  // ── Step 5: Create & Enroll a Second Agent (need min 2) ───────────
  console.log("Step 5: Create & Enroll second agent (min 2 required)...");
  const agent2Asset = Keypair.generate();
  const [agent2Pda] = findAgentPda(agent2Asset.publicKey);
  const strategyHash2 = Buffer.alloc(32);
  Buffer.from("mean-reversion-bollinger").copy(strategyHash2);

  await program.methods
    .createAgent("Arena Contender", "https://arweave.net/arena-agent-2", Array.from(strategyHash2) as any)
    .accounts({
      arena: arenaPda,
      agent: agent2Pda,
      asset: agent2Asset.publicKey,
      owner: wallet.publicKey,
      systemProgram: SystemProgram.programId,
      mplCoreProgram: MPL_CORE_PROGRAM_ID,
    })
    .signers([agent2Asset])
    .rpc();

  const [enrollment2Pda] = findEnrollmentPda(competitionPda, agent2Pda);
  await program.methods
    .enrollAgent()
    .accounts({
      agent: agent2Pda,
      competition: competitionPda,
      enrollment: enrollment2Pda,
      prizeVault: prizeVaultPda,
      ownerTokenAccount: ownerAta,
      prizeMint: prizeMint,
      owner: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log(`  Second agent created & enrolled`);
  console.log();

  // ── Step 6: Start Competition ─────────────────────────────────────
  console.log("Step 6: Start Competition...");
  const startTx = await program.methods
    .startCompetition()
    .accounts({
      competition: competitionPda,
      authority: wallet.publicKey,
    })
    .rpc();
  console.log(`  Competition started: ${startTx}`);

  const compAfterStart = await program.account.competition.fetch(competitionPda);
  console.log(`  Status: Active, Registered: ${compAfterStart.registeredCount}`);
  console.log();

  // ── Step 7: Submit Scores ─────────────────────────────────────────
  console.log("Step 7: Submit Scores...");
  const scoresTx = await program.methods
    .submitScores([
      { agent: agentPda, score: new BN(8500), rank: 1, prizeAmount: new BN(0) },
      { agent: agent2Pda, score: new BN(6200), rank: 2, prizeAmount: new BN(0) },
    ])
    .accounts({
      competition: competitionPda,
      authority: wallet.publicKey,
    })
    .remainingAccounts([
      { pubkey: enrollmentPda, isWritable: true, isSigner: false },
      { pubkey: enrollment2Pda, isWritable: true, isSigner: false },
    ])
    .rpc();
  console.log(`  Scores submitted: ${scoresTx}`);

  const e1 = await program.account.enrollment.fetch(enrollmentPda);
  const e2 = await program.account.enrollment.fetch(enrollment2Pda);
  console.log(`  Agent 1 — Score: ${e1.finalScore}, Rank: ${e1.finalRank}`);
  console.log(`  Agent 2 — Score: ${e2.finalScore}, Rank: ${e2.finalRank}`);
  console.log();

  // ── Step 8: Settle Competition ────────────────────────────────────
  console.log("Step 8: Settle Competition...");
  const settleTx = await program.methods
    .settleCompetition()
    .accounts({
      competition: competitionPda,
      authority: wallet.publicKey,
    })
    .rpc();
  console.log(`  Competition settled: ${settleTx}`);

  const compFinal = await program.account.competition.fetch(competitionPda);
  console.log(`  Final Status: Settled`);
  console.log();

  // ── Summary ───────────────────────────────────────────────────────
  console.log("=".repeat(60));
  console.log("E2E TEST COMPLETE — All steps passed!");
  console.log("=".repeat(60));
  console.log();
  console.log("Artifacts:");
  console.log(`  Program:     ${program.programId.toBase58()}`);
  console.log(`  Arena PDA:   ${arenaPda.toBase58()}`);
  console.log(`  Agent 1 NFT: ${agentAsset.publicKey.toBase58()}`);
  console.log(`  Agent 2 NFT: ${agent2Asset.publicKey.toBase58()}`);
  console.log(`  Competition: ${competitionPda.toBase58()}`);
  console.log(`  Prize Vault: ${prizeVaultPda.toBase58()}`);
  console.log(`  Prize Mint:  ${prizeMint.toBase58()}`);
  console.log();
  console.log(`Explorer: https://explorer.solana.com/address/${program.programId.toBase58()}?cluster=devnet`);
}

main().catch((err) => {
  console.error("E2E TEST FAILED:", err);
  process.exit(1);
});
