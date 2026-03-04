import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Arena } from "../target/types/arena";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
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
});
