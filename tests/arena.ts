import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Arena } from "../target/types/arena";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
  createMint,
  mintTo,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccount,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { expect } from "chai";

const MPL_CORE_PROGRAM_ID = new PublicKey(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
);

describe("arena", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.arena as Program<Arena>;
  const wallet = provider.wallet as anchor.Wallet;

  let arenaPda: PublicKey;
  let arenaBump: number;

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

  function findEnrollmentPda(competitionKey: PublicKey, agentKey: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("enrollment"),
        competitionKey.toBuffer(),
        agentKey.toBuffer(),
      ],
      program.programId
    );
  }

  function findPrizeVaultPda(competitionKey: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("prize_vault"), competitionKey.toBuffer()],
      program.programId
    );
  }

  async function createAgentHelper(name: string, uri: string): Promise<{
    assetKeypair: Keypair;
    agentPda: PublicKey;
  }> {
    const assetKeypair = Keypair.generate();
    const [agentPda] = findAgentPda(assetKeypair.publicKey);
    const strategyHash = Buffer.alloc(32);
    strategyHash.write("test-strategy");

    await program.methods
      .createAgent(name, uri, Array.from(strategyHash))
      .accounts({
        arena: arenaPda,
        agent: agentPda,
        asset: assetKeypair.publicKey,
        owner: wallet.publicKey,
        systemProgram: SystemProgram.programId,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
      })
      .signers([assetKeypair])
      .rpc();

    return { assetKeypair, agentPda };
  }

  describe("initialize_arena", () => {
    it("initializes the arena singleton", async () => {
      [arenaPda, arenaBump] = findArenaPda();
      await program.methods
        .initializeArena(250)
        .accounts({
          arena: arenaPda,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const arena = await program.account.arena.fetch(arenaPda);
      expect(arena.authority.toBase58()).to.equal(wallet.publicKey.toBase58());
      expect(arena.protocolFeeBps).to.equal(250);
      expect(arena.agentCount.toNumber()).to.equal(0);
      expect(arena.competitionCount.toNumber()).to.equal(0);
      expect(arena.bump).to.equal(arenaBump);
    });

    it("fails on double initialization", async () => {
      try {
        await program.methods
          .initializeArena(500)
          .accounts({
            arena: arenaPda,
            authority: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        // Account already initialized - Anchor rejects init on existing PDA
        expect(err).to.exist;
      }
    });
  });

  describe("create_agent", () => {
    let assetKeypair: Keypair;
    let agentPda: PublicKey;

    it("mints NFT and creates agent PDA", async () => {
      assetKeypair = Keypair.generate();
      [agentPda] = findAgentPda(assetKeypair.publicKey);

      const strategyHash = Buffer.alloc(32);
      strategyHash.write("momentum-v1");

      await program.methods
        .createAgent(
          "TestAgent",
          "https://arena.adrena.xyz/agents/1",
          Array.from(strategyHash)
        )
        .accounts({
          arena: arenaPda,
          agent: agentPda,
          asset: assetKeypair.publicKey,
          owner: wallet.publicKey,
          systemProgram: SystemProgram.programId,
          mplCoreProgram: MPL_CORE_PROGRAM_ID,
        })
        .signers([assetKeypair])
        .rpc();

      const agent = await program.account.agent.fetch(agentPda);
      expect(agent.owner.toBase58()).to.equal(wallet.publicKey.toBase58());
      expect(agent.mint.toBase58()).to.equal(
        assetKeypair.publicKey.toBase58()
      );
      expect(agent.eloRating).to.equal(1000);
      expect(agent.wins).to.equal(0);
      expect(agent.losses).to.equal(0);
      expect(agent.totalPnl.toNumber()).to.equal(0);
      expect(agent.totalTrades).to.equal(0);
      expect(agent.competitionsEntered).to.equal(0);
      expect(JSON.stringify(agent.status)).to.equal(
        JSON.stringify({ active: {} })
      );

      // Verify arena counter incremented
      const arena = await program.account.arena.fetch(arenaPda);
      expect(arena.agentCount.toNumber()).to.equal(1);
    });
  });

  describe("update_agent_strategy", () => {
    let assetKeypair: Keypair;
    let agentPda: PublicKey;

    before(async () => {
      // Create a fresh agent for these tests
      assetKeypair = Keypair.generate();
      [agentPda] = findAgentPda(assetKeypair.publicKey);
      const strategyHash = Buffer.alloc(32);

      await program.methods
        .createAgent(
          "StrategyAgent",
          "https://arena.adrena.xyz/agents/2",
          Array.from(strategyHash)
        )
        .accounts({
          arena: arenaPda,
          agent: agentPda,
          asset: assetKeypair.publicKey,
          owner: wallet.publicKey,
          systemProgram: SystemProgram.programId,
          mplCoreProgram: MPL_CORE_PROGRAM_ID,
        })
        .signers([assetKeypair])
        .rpc();
    });

    it("updates strategy hash", async () => {
      const newHash = Buffer.alloc(32);
      newHash.write("mean-reversion-v2");

      await program.methods
        .updateAgentStrategy(Array.from(newHash))
        .accounts({
          agent: agentPda,
          owner: wallet.publicKey,
        })
        .rpc();

      const agent = await program.account.agent.fetch(agentPda);
      expect(Buffer.from(agent.strategyHash).toString()).to.include(
        "mean-reversion-v2"
      );
    });

    it("rejects non-owner", async () => {
      const fakeOwner = Keypair.generate();
      const newHash = Buffer.alloc(32);

      try {
        await program.methods
          .updateAgentStrategy(Array.from(newHash))
          .accounts({
            agent: agentPda,
            owner: fakeOwner.publicKey,
          })
          .signers([fakeOwner])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.toString()).to.include("NotAgentOwner");
      }
    });
  });

  describe("retire_agent", () => {
    let assetKeypair: Keypair;
    let agentPda: PublicKey;

    before(async () => {
      assetKeypair = Keypair.generate();
      [agentPda] = findAgentPda(assetKeypair.publicKey);
      const strategyHash = Buffer.alloc(32);

      await program.methods
        .createAgent(
          "RetireAgent",
          "https://arena.adrena.xyz/agents/3",
          Array.from(strategyHash)
        )
        .accounts({
          arena: arenaPda,
          agent: agentPda,
          asset: assetKeypair.publicKey,
          owner: wallet.publicKey,
          systemProgram: SystemProgram.programId,
          mplCoreProgram: MPL_CORE_PROGRAM_ID,
        })
        .signers([assetKeypair])
        .rpc();
    });

    it("retires active agent", async () => {
      await program.methods
        .retireAgent()
        .accounts({
          agent: agentPda,
          owner: wallet.publicKey,
        })
        .rpc();

      const agent = await program.account.agent.fetch(agentPda);
      expect(JSON.stringify(agent.status)).to.equal(
        JSON.stringify({ retired: {} })
      );
    });

    it("rejects already retired agent", async () => {
      try {
        await program.methods
          .retireAgent()
          .accounts({
            agent: agentPda,
            owner: wallet.publicKey,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.toString()).to.include("AgentNotActive");
      }
    });
  });

  // ========================================
  // Competition lifecycle tests
  // ========================================

  describe("competition lifecycle", () => {
    let prizeMint: PublicKey;
    let competitionPda: PublicKey;
    let competitionBump: number;
    let prizeVaultPda: PublicKey;
    let agent1: { assetKeypair: Keypair; agentPda: PublicKey };
    let agent2: { assetKeypair: Keypair; agentPda: PublicKey };
    let enrollment1Pda: PublicKey;
    let enrollment2Pda: PublicKey;
    let ownerAta: PublicKey;

    const ENTRY_FEE = 1_000_000; // 1 USDC (6 decimals)
    const MINT_AMOUNT = 100_000_000; // 100 USDC

    before(async () => {
      // Create USDC-like mint (6 decimals)
      prizeMint = await createMint(
        provider.connection,
        wallet.payer,
        wallet.publicKey,
        null,
        6
      );

      // Create owner's ATA and fund it
      ownerAta = await createAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        prizeMint,
        wallet.publicKey
      );

      await mintTo(
        provider.connection,
        wallet.payer,
        prizeMint,
        ownerAta,
        wallet.publicKey,
        MINT_AMOUNT
      );

      // Create 2 agents for competition
      agent1 = await createAgentHelper(
        "CompAgent1",
        "https://arena.adrena.xyz/agents/comp1"
      );
      agent2 = await createAgentHelper(
        "CompAgent2",
        "https://arena.adrena.xyz/agents/comp2"
      );
    });

    describe("create_competition", () => {
      it("creates a competition with prize vault", async () => {
        const arena = await program.account.arena.fetch(arenaPda);
        const compId = arena.competitionCount.toNumber();
        [competitionPda, competitionBump] = findCompetitionPda(arenaPda, compId);
        [prizeVaultPda] = findPrizeVaultPda(competitionPda);

        const now = Math.floor(Date.now() / 1000);
        await program.methods
          .createCompetition({
            name: "Season One",
            format: { season: {} },
            entryFee: new BN(ENTRY_FEE),
            maxAgents: 64,
            startTime: new BN(now + 2),
            endTime: new BN(now + 86400),
            scoringParams: {
              minTrades: 10,
              maxLeverage: 50,
              positionSizeCap: new BN(1_000_000_000),
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

        const comp = await program.account.competition.fetch(competitionPda);
        expect(comp.name).to.equal("Season One");
        expect(JSON.stringify(comp.format)).to.equal(
          JSON.stringify({ season: {} })
        );
        expect(JSON.stringify(comp.status)).to.equal(
          JSON.stringify({ registration: {} })
        );
        expect(comp.entryFee.toNumber()).to.equal(ENTRY_FEE);
        expect(comp.prizePool.toNumber()).to.equal(0);
        expect(comp.maxAgents).to.equal(64);
        expect(comp.registeredCount).to.equal(0);
        expect(comp.prizeMint.toBase58()).to.equal(prizeMint.toBase58());
        expect(comp.prizeVault.toBase58()).to.equal(prizeVaultPda.toBase58());
        expect(comp.arena.toBase58()).to.equal(arenaPda.toBase58());
        expect(comp.bump).to.equal(competitionBump);

        // Verify arena counter incremented
        const arenaAfter = await program.account.arena.fetch(arenaPda);
        expect(arenaAfter.competitionCount.toNumber()).to.equal(compId + 1);
      });

      it("rejects name too long", async () => {
        const arena = await program.account.arena.fetch(arenaPda);
        const compId = arena.competitionCount.toNumber();
        const [badCompPda] = findCompetitionPda(arenaPda, compId);
        const [badVaultPda] = findPrizeVaultPda(badCompPda);

        const now = Math.floor(Date.now() / 1000);
        try {
          await program.methods
            .createCompetition({
              name: "A".repeat(33), // exceeds MAX_NAME_LEN (32)
              format: { season: {} },
              entryFee: new BN(0),
              maxAgents: 8,
              startTime: new BN(now + 60),
              endTime: new BN(now + 86400),
              scoringParams: {
                minTrades: 1,
                maxLeverage: 10,
                positionSizeCap: new BN(1_000_000),
              },
            })
            .accounts({
              arena: arenaPda,
              competition: badCompPda,
              prizeVault: badVaultPda,
              prizeMint: prizeMint,
              authority: wallet.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("NameTooLong");
        }
      });

      it("rejects invalid time range", async () => {
        const arena = await program.account.arena.fetch(arenaPda);
        const compId = arena.competitionCount.toNumber();
        const [badCompPda] = findCompetitionPda(arenaPda, compId);
        const [badVaultPda] = findPrizeVaultPda(badCompPda);

        const now = Math.floor(Date.now() / 1000);
        try {
          await program.methods
            .createCompetition({
              name: "BadTime",
              format: { flashDuel: {} },
              entryFee: new BN(0),
              maxAgents: 8,
              startTime: new BN(now + 86400),
              endTime: new BN(now + 60), // end before start
              scoringParams: {
                minTrades: 1,
                maxLeverage: 10,
                positionSizeCap: new BN(1_000_000),
              },
            })
            .accounts({
              arena: arenaPda,
              competition: badCompPda,
              prizeVault: badVaultPda,
              prizeMint: prizeMint,
              authority: wallet.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("InvalidTimeRange");
        }
      });
    });

    describe("enroll_agent", () => {
      it("enrolls first agent and transfers entry fee", async () => {
        [enrollment1Pda] = findEnrollmentPda(
          competitionPda,
          agent1.agentPda
        );

        const balanceBefore = (await getAccount(provider.connection, ownerAta))
          .amount;

        await program.methods
          .enrollAgent()
          .accounts({
            agent: agent1.agentPda,
            competition: competitionPda,
            enrollment: enrollment1Pda,
            prizeVault: prizeVaultPda,
            ownerTokenAccount: ownerAta,
            prizeMint: prizeMint,
            owner: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        const enrollment = await program.account.enrollment.fetch(
          enrollment1Pda
        );
        expect(enrollment.agent.toBase58()).to.equal(
          agent1.agentPda.toBase58()
        );
        expect(enrollment.competition.toBase58()).to.equal(
          competitionPda.toBase58()
        );
        expect(JSON.stringify(enrollment.status)).to.equal(
          JSON.stringify({ enrolled: {} })
        );
        expect(enrollment.finalScore.toNumber()).to.equal(0);
        expect(enrollment.finalRank).to.equal(0);
        expect(enrollment.prizeAmount.toNumber()).to.equal(0);

        // Verify token transfer
        const balanceAfter = (await getAccount(provider.connection, ownerAta))
          .amount;
        expect(Number(balanceBefore - balanceAfter)).to.equal(ENTRY_FEE);

        // Verify competition state
        const comp = await program.account.competition.fetch(competitionPda);
        expect(comp.registeredCount).to.equal(1);
        expect(comp.prizePool.toNumber()).to.equal(ENTRY_FEE);
      });

      it("enrolls second agent", async () => {
        [enrollment2Pda] = findEnrollmentPda(
          competitionPda,
          agent2.agentPda
        );

        await program.methods
          .enrollAgent()
          .accounts({
            agent: agent2.agentPda,
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

        const comp = await program.account.competition.fetch(competitionPda);
        expect(comp.registeredCount).to.equal(2);
        expect(comp.prizePool.toNumber()).to.equal(ENTRY_FEE * 2);
      });

      it("rejects duplicate enrollment", async () => {
        // enrollment1Pda already exists — trying to init again should fail
        const [dupPda] = findEnrollmentPda(competitionPda, agent1.agentPda);
        try {
          await program.methods
            .enrollAgent()
            .accounts({
              agent: agent1.agentPda,
              competition: competitionPda,
              enrollment: dupPda,
              prizeVault: prizeVaultPda,
              ownerTokenAccount: ownerAta,
              prizeMint: prizeMint,
              owner: wallet.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          // Anchor init constraint prevents re-initializing an existing PDA
          expect(err).to.exist;
        }
      });
    });

    describe("start_competition", () => {
      it("rejects start with unauthorized signer", async () => {
        const fake = Keypair.generate();
        try {
          await program.methods
            .startCompetition()
            .accounts({
              arena: arenaPda,
              competition: competitionPda,
              authority: fake.publicKey,
            })
            .signers([fake])
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("Unauthorized");
        }
      });

      it("starts competition with 2+ agents", async () => {
        await program.methods
          .startCompetition()
          .accounts({
            arena: arenaPda,
            competition: competitionPda,
            authority: wallet.publicKey,
          })
          .rpc();

        const comp = await program.account.competition.fetch(competitionPda);
        expect(JSON.stringify(comp.status)).to.equal(
          JSON.stringify({ active: {} })
        );
      });

      it("rejects starting already-active competition", async () => {
        try {
          await program.methods
            .startCompetition()
            .accounts({
              arena: arenaPda,
              competition: competitionPda,
              authority: wallet.publicKey,
            })
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("InvalidCompetitionStatus");
        }
      });
    });

    describe("submit_scores", () => {
      it("submits scores and transitions to Scoring", async () => {
        // Agent1 wins: gets full prize pool, agent2 gets nothing
        const totalPrize = ENTRY_FEE * 2;
        const scores = [
          { finalScore: new BN(9500), finalRank: 1, prizeAmount: new BN(totalPrize) },
          { finalScore: new BN(4200), finalRank: 2, prizeAmount: new BN(0) },
        ];

        await program.methods
          .submitScores(scores)
          .accounts({
            arena: arenaPda,
            competition: competitionPda,
            prizeVault: prizeVaultPda,
            authority: wallet.publicKey,
          })
          .remainingAccounts([
            {
              pubkey: enrollment1Pda,
              isWritable: true,
              isSigner: false,
            },
            {
              pubkey: enrollment2Pda,
              isWritable: true,
              isSigner: false,
            },
          ])
          .rpc();

        // Verify competition is now Scoring
        const comp = await program.account.competition.fetch(competitionPda);
        expect(JSON.stringify(comp.status)).to.equal(
          JSON.stringify({ scoring: {} })
        );

        // Verify enrollment scores
        const e1 = await program.account.enrollment.fetch(enrollment1Pda);
        expect(e1.finalScore.toNumber()).to.equal(9500);
        expect(e1.finalRank).to.equal(1);
        expect(e1.prizeAmount.toNumber()).to.equal(totalPrize);
        expect(JSON.stringify(e1.status)).to.equal(
          JSON.stringify({ scored: {} })
        );

        const e2 = await program.account.enrollment.fetch(enrollment2Pda);
        expect(e2.finalScore.toNumber()).to.equal(4200);
        expect(e2.finalRank).to.equal(2);
        expect(e2.prizeAmount.toNumber()).to.equal(0);
        expect(JSON.stringify(e2.status)).to.equal(
          JSON.stringify({ scored: {} })
        );
      });
    });

    describe("settle_competition", () => {
      it("settles the competition", async () => {
        await program.methods
          .settleCompetition()
          .accounts({
            arena: arenaPda,
            competition: competitionPda,
            authority: wallet.publicKey,
          })
          .rpc();

        const comp = await program.account.competition.fetch(competitionPda);
        expect(JSON.stringify(comp.status)).to.equal(
          JSON.stringify({ settled: {} })
        );
      });

      it("rejects settling already settled competition", async () => {
        try {
          await program.methods
            .settleCompetition()
            .accounts({
              arena: arenaPda,
              competition: competitionPda,
              authority: wallet.publicKey,
            })
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("NotInScoringPhase");
        }
      });
    });

    describe("claim_prize", () => {
      it("rejects claim for zero-prize agent", async () => {
        try {
          await program.methods
            .claimPrize()
            .accounts({
              agent: agent2.agentPda,
              competition: competitionPda,
              enrollment: enrollment2Pda,
              prizeVault: prizeVaultPda,
              ownerTokenAccount: ownerAta,
              prizeMint: prizeMint,
              owner: wallet.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          expect(err.toString()).to.include("ZeroPrize");
        }
      });

      it("claims prize for winner", async () => {
        const balanceBefore = (await getAccount(provider.connection, ownerAta))
          .amount;
        const totalPrize = ENTRY_FEE * 2;

        await program.methods
          .claimPrize()
          .accounts({
            agent: agent1.agentPda,
            competition: competitionPda,
            enrollment: enrollment1Pda,
            prizeVault: prizeVaultPda,
            ownerTokenAccount: ownerAta,
            prizeMint: prizeMint,
            owner: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();

        // Verify token transfer
        const balanceAfter = (await getAccount(provider.connection, ownerAta))
          .amount;
        expect(Number(balanceAfter - balanceBefore)).to.equal(totalPrize);

        // Verify enrollment status
        const e1 = await program.account.enrollment.fetch(enrollment1Pda);
        expect(JSON.stringify(e1.status)).to.equal(
          JSON.stringify({ claimed: {} })
        );
      });

      it("rejects double claim (enrollment closed after first claim)", async () => {
        try {
          await program.methods
            .claimPrize()
            .accounts({
              agent: agent1.agentPda,
              competition: competitionPda,
              enrollment: enrollment1Pda,
              prizeVault: prizeVaultPda,
              ownerTokenAccount: ownerAta,
              prizeMint: prizeMint,
              owner: wallet.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();
          expect.fail("Should have thrown");
        } catch (err) {
          // Enrollment account is closed after claim, so it can't be deserialized
          expect(err).to.exist;
        }
      });
    });
  });

  // ========================================
  // Disqualify + edge case tests
  // ========================================

  describe("disqualify_agent", () => {
    let prizeMint2: PublicKey;
    let comp2Pda: PublicKey;
    let vault2Pda: PublicKey;
    let dqAgent: { assetKeypair: Keypair; agentPda: PublicKey };
    let dqEnrollmentPda: PublicKey;
    let ownerAta2: PublicKey;

    before(async () => {
      // Setup a second competition for DQ tests
      prizeMint2 = await createMint(
        provider.connection,
        wallet.payer,
        wallet.publicKey,
        null,
        6
      );

      ownerAta2 = await createAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        prizeMint2,
        wallet.publicKey
      );

      await mintTo(
        provider.connection,
        wallet.payer,
        prizeMint2,
        ownerAta2,
        wallet.publicKey,
        100_000_000
      );

      const arena = await program.account.arena.fetch(arenaPda);
      const compId = arena.competitionCount.toNumber();
      [comp2Pda] = findCompetitionPda(arenaPda, compId);
      [vault2Pda] = findPrizeVaultPda(comp2Pda);

      const now = Math.floor(Date.now() / 1000);
      await program.methods
        .createCompetition({
          name: "DQ Test",
          format: { flashDuel: {} },
          entryFee: new BN(500_000),
          maxAgents: 8,
          startTime: new BN(now + 60),
          endTime: new BN(now + 86400),
          scoringParams: {
            minTrades: 5,
            maxLeverage: 20,
            positionSizeCap: new BN(500_000_000),
          },
        })
        .accounts({
          arena: arenaPda,
          competition: comp2Pda,
          prizeVault: vault2Pda,
          prizeMint: prizeMint2,
          authority: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Create and enroll an agent
      dqAgent = await createAgentHelper(
        "DQAgent",
        "https://arena.adrena.xyz/agents/dq"
      );

      [dqEnrollmentPda] = findEnrollmentPda(comp2Pda, dqAgent.agentPda);

      await program.methods
        .enrollAgent()
        .accounts({
          agent: dqAgent.agentPda,
          competition: comp2Pda,
          enrollment: dqEnrollmentPda,
          prizeVault: vault2Pda,
          ownerTokenAccount: ownerAta2,
          prizeMint: prizeMint2,
          owner: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

    it("disqualifies enrolled agent", async () => {
      const compBefore = await program.account.competition.fetch(comp2Pda);
      const countBefore = compBefore.registeredCount;

      await program.methods
        .disqualifyAgent()
        .accounts({
          arena: arenaPda,
          competition: comp2Pda,
          enrollment: dqEnrollmentPda,
          agent: dqAgent.agentPda,
          authority: wallet.publicKey,
        })
        .rpc();

      const enrollment = await program.account.enrollment.fetch(
        dqEnrollmentPda
      );
      expect(JSON.stringify(enrollment.status)).to.equal(
        JSON.stringify({ disqualified: {} })
      );

      const compAfter = await program.account.competition.fetch(comp2Pda);
      expect(compAfter.registeredCount).to.equal(countBefore - 1);
    });

    it("rejects disqualifying already disqualified agent", async () => {
      try {
        await program.methods
          .disqualifyAgent()
          .accounts({
            arena: arenaPda,
            competition: comp2Pda,
            enrollment: dqEnrollmentPda,
            agent: dqAgent.agentPda,
            authority: wallet.publicKey,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.toString()).to.include("InvalidEnrollmentStatus");
      }
    });
  });

  describe("start_competition edge cases", () => {
    let prizeMint3: PublicKey;
    let comp3Pda: PublicKey;
    let vault3Pda: PublicKey;
    let ownerAta3: PublicKey;

    before(async () => {
      prizeMint3 = await createMint(
        provider.connection,
        wallet.payer,
        wallet.publicKey,
        null,
        6
      );

      ownerAta3 = await createAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        prizeMint3,
        wallet.publicKey
      );

      await mintTo(
        provider.connection,
        wallet.payer,
        prizeMint3,
        ownerAta3,
        wallet.publicKey,
        100_000_000
      );

      const arena = await program.account.arena.fetch(arenaPda);
      const compId = arena.competitionCount.toNumber();
      [comp3Pda] = findCompetitionPda(arenaPda, compId);
      [vault3Pda] = findPrizeVaultPda(comp3Pda);

      const now = Math.floor(Date.now() / 1000);
      await program.methods
        .createCompetition({
          name: "Edge Case",
          format: { bracket: {} },
          entryFee: new BN(0),
          maxAgents: 4,
          startTime: new BN(now + 60),
          endTime: new BN(now + 86400),
          scoringParams: {
            minTrades: 1,
            maxLeverage: 100,
            positionSizeCap: new BN(1_000_000_000),
          },
        })
        .accounts({
          arena: arenaPda,
          competition: comp3Pda,
          prizeVault: vault3Pda,
          prizeMint: prizeMint3,
          authority: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

    it("rejects start with < 2 agents", async () => {
      // Competition has 0 enrolled agents
      try {
        await program.methods
          .startCompetition()
          .accounts({
            arena: arenaPda,
            competition: comp3Pda,
            authority: wallet.publicKey,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.toString()).to.include("InsufficientParticipants");
      }
    });

    it("rejects start with exactly 1 agent", async () => {
      // Enroll one agent
      const singleAgent = await createAgentHelper(
        "Solo",
        "https://arena.adrena.xyz/agents/solo"
      );
      const [enrollPda] = findEnrollmentPda(comp3Pda, singleAgent.agentPda);

      await program.methods
        .enrollAgent()
        .accounts({
          agent: singleAgent.agentPda,
          competition: comp3Pda,
          enrollment: enrollPda,
          prizeVault: vault3Pda,
          ownerTokenAccount: ownerAta3,
          prizeMint: prizeMint3,
          owner: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      try {
        await program.methods
          .startCompetition()
          .accounts({
            arena: arenaPda,
            competition: comp3Pda,
            authority: wallet.publicKey,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.toString()).to.include("InsufficientParticipants");
      }
    });
  });

  describe("competition full enrollment", () => {
    let prizeMint4: PublicKey;
    let comp4Pda: PublicKey;
    let vault4Pda: PublicKey;
    let ownerAta4: PublicKey;

    before(async () => {
      prizeMint4 = await createMint(
        provider.connection,
        wallet.payer,
        wallet.publicKey,
        null,
        6
      );

      ownerAta4 = await createAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        prizeMint4,
        wallet.publicKey
      );

      await mintTo(
        provider.connection,
        wallet.payer,
        prizeMint4,
        ownerAta4,
        wallet.publicKey,
        100_000_000
      );

      const arena = await program.account.arena.fetch(arenaPda);
      const compId = arena.competitionCount.toNumber();
      [comp4Pda] = findCompetitionPda(arenaPda, compId);
      [vault4Pda] = findPrizeVaultPda(comp4Pda);

      const now = Math.floor(Date.now() / 1000);
      await program.methods
        .createCompetition({
          name: "Full Test",
          format: { sandbox: {} },
          entryFee: new BN(0),
          maxAgents: 2,  // only allow 2
          startTime: new BN(now + 60),
          endTime: new BN(now + 86400),
          scoringParams: {
            minTrades: 1,
            maxLeverage: 10,
            positionSizeCap: new BN(1_000_000),
          },
        })
        .accounts({
          arena: arenaPda,
          competition: comp4Pda,
          prizeVault: vault4Pda,
          prizeMint: prizeMint4,
          authority: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Enroll 2 agents to fill it up
      for (let i = 0; i < 2; i++) {
        const ag = await createAgentHelper(
          `FullAgent${i}`,
          `https://arena.adrena.xyz/agents/full${i}`
        );
        const [enrollPda] = findEnrollmentPda(comp4Pda, ag.agentPda);
        await program.methods
          .enrollAgent()
          .accounts({
            agent: ag.agentPda,
            competition: comp4Pda,
            enrollment: enrollPda,
            prizeVault: vault4Pda,
            ownerTokenAccount: ownerAta4,
            prizeMint: prizeMint4,
            owner: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      }
    });

    it("rejects enrollment when competition is full", async () => {
      const extraAgent = await createAgentHelper(
        "ExtraAgent",
        "https://arena.adrena.xyz/agents/extra"
      );
      const [enrollPda] = findEnrollmentPda(comp4Pda, extraAgent.agentPda);

      try {
        await program.methods
          .enrollAgent()
          .accounts({
            agent: extraAgent.agentPda,
            competition: comp4Pda,
            enrollment: enrollPda,
            prizeVault: vault4Pda,
            ownerTokenAccount: ownerAta4,
            prizeMint: prizeMint4,
            owner: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.toString()).to.include("CompetitionFull");
      }
    });
  });
});
