import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Arena } from "../target/types/arena";

describe("arena", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.arena as Program<Arena>;

  it("Is initialized!", async () => {
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
