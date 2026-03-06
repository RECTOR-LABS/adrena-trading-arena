import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

import type {
  AdrenaTrader,
  TradeParams,
  CloseParams,
  PositionInfo,
} from './adrena-wrapper';
import {
  ADRENA_PROGRAM_ID,
  CORTEX,
  MAIN_POOL,
  USDC_CUSTODY,
  USDC_MINT,
  Side,
  findPositionPda,
  findTransferAuthorityPda,
  deserializePositionAccount,
  IX_OPEN_LONG,
  IX_OPEN_SHORT,
  IX_CLOSE_LONG,
  IX_CLOSE_SHORT,
} from './adrena-constants';

// ---------------------------------------------------------------------------
// Decimal precision constants
// ---------------------------------------------------------------------------

/** Adrena prices use 10 decimal places */
const PRICE_DECIMALS = 10;
const PRICE_SCALE = 10n ** BigInt(PRICE_DECIMALS);

/** USD amounts use 6 decimal places */
const USD_DECIMALS = 6;
const USD_SCALE = 10n ** BigInt(USD_DECIMALS);

// ---------------------------------------------------------------------------
// Instruction data serialization helpers
// ---------------------------------------------------------------------------

/**
 * Serialize open position params:
 *   discriminator (8) + price (u64) + collateral (u64) + leverage (u32)
 */
function serializeOpenParams(
  discriminator: Buffer,
  price: bigint,
  collateral: bigint,
  leverageBps: number
): Buffer {
  // 8 (disc) + 8 (price) + 8 (collateral) + 4 (leverage)
  const buf = Buffer.alloc(28);
  discriminator.copy(buf, 0);
  buf.writeBigUInt64LE(price, 8);
  buf.writeBigUInt64LE(collateral, 16);
  buf.writeUInt32LE(leverageBps, 24);
  return buf;
}

/**
 * Serialize close position params:
 *   discriminator (8) + option_flag (1) + [price (u64) if Some]
 *
 * Option<u64>: 0 = None, 1 = Some(value)
 */
function serializeCloseParams(
  discriminator: Buffer,
  price: bigint | null
): Buffer {
  if (price === null) {
    // None variant: disc (8) + 0u8 (1)
    const buf = Buffer.alloc(9);
    discriminator.copy(buf, 0);
    buf.writeUInt8(0, 8);
    return buf;
  }
  // Some variant: disc (8) + 1u8 (1) + u64 (8)
  const buf = Buffer.alloc(17);
  discriminator.copy(buf, 0);
  buf.writeUInt8(1, 8);
  buf.writeBigUInt64LE(price, 9);
  return buf;
}

// ---------------------------------------------------------------------------
// Wallet interface — compatible with Anchor Wallet and raw Keypair
// ---------------------------------------------------------------------------

export interface AdrenaWallet {
  publicKey: PublicKey;
  signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction>;
}

/**
 * Wraps a Keypair into the AdrenaWallet interface.
 */
export function keypairToWallet(keypair: Keypair): AdrenaWallet {
  return {
    publicKey: keypair.publicKey,
    async signTransaction(tx: VersionedTransaction) {
      tx.sign([keypair]);
      return tx;
    },
  };
}

// ---------------------------------------------------------------------------
// LiveAdrenaTrader
// ---------------------------------------------------------------------------

export class LiveAdrenaTrader implements AdrenaTrader {
  readonly connection: Connection;
  readonly wallet: AdrenaWallet;
  readonly programId: PublicKey;
  readonly pool: PublicKey;

  constructor(
    connection: Connection,
    wallet: AdrenaWallet,
    opts?: {
      programId?: PublicKey;
      pool?: PublicKey;
    }
  ) {
    this.connection = connection;
    this.wallet = wallet;
    this.programId = opts?.programId ?? ADRENA_PROGRAM_ID;
    this.pool = opts?.pool ?? MAIN_POOL;
  }

  // -----------------------------------------------------------------------
  // Public API — implements AdrenaTrader
  // -----------------------------------------------------------------------

  async openLong(params: TradeParams): Promise<string> {
    return this.openPosition(params, Side.Long);
  }

  async openShort(params: TradeParams): Promise<string> {
    return this.openPosition(params, Side.Short);
  }

  async closeLong(params: CloseParams): Promise<string> {
    return this.closePosition(params, Side.Long);
  }

  async closeShort(params: CloseParams): Promise<string> {
    return this.closePosition(params, Side.Short);
  }

  async getPosition(
    owner: PublicKey,
    custody: PublicKey
  ): Promise<PositionInfo | null> {
    // Try long first, then short
    const longResult = await this.fetchPositionBySide(owner, custody, Side.Long);
    if (longResult) return longResult;
    return this.fetchPositionBySide(owner, custody, Side.Short);
  }

  // -----------------------------------------------------------------------
  // Position PDA helpers (public for testability)
  // -----------------------------------------------------------------------

  derivePositionPda(
    owner: PublicKey,
    custody: PublicKey,
    side: Side
  ): [PublicKey, number] {
    return findPositionPda(owner, this.pool, custody, side);
  }

  // -----------------------------------------------------------------------
  // Internal — open position
  // -----------------------------------------------------------------------

  private async openPosition(
    params: TradeParams,
    side: Side
  ): Promise<string> {
    const { owner, mint, collateral, leverage, price, slippageBps } = params;

    // Custody for the trading asset — use mint as the custody (caller maps)
    const custody = mint;

    // USDC is the collateral custody for all positions
    const collateralCustody = USDC_CUSTODY;

    const [positionPda] = this.derivePositionPda(owner, custody, side);
    const [transferAuthority] = findTransferAuthorityPda();

    // The user's USDC ATA — collateral comes from here
    const fundingAccount = getAssociatedTokenAddressSync(
      USDC_MINT,
      owner,
      true // allowOwnerOffCurve for PDA owners
    );

    // Compute slippage-adjusted price
    const adjustedPrice =
      side === Side.Long
        ? applySlippage(price, slippageBps, true)
        : applySlippage(price, slippageBps, false);

    // Scale values to on-chain representation
    const priceScaled = BigInt(Math.round(adjustedPrice * Number(PRICE_SCALE)));
    const collateralScaled = BigInt(Math.round(collateral * Number(USD_SCALE)));
    const leverageBps = Math.round(leverage * 10000);

    const discriminator = side === Side.Long ? IX_OPEN_LONG : IX_OPEN_SHORT;
    const data = serializeOpenParams(discriminator, priceScaled, collateralScaled, leverageBps);

    // Build instruction accounts
    // The exact account layout follows Adrena's instruction definition.
    // Accounts listed in the order the program expects.
    const keys = [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: fundingAccount, isSigner: false, isWritable: true },
      { pubkey: transferAuthority, isSigner: false, isWritable: false },
      { pubkey: CORTEX, isSigner: false, isWritable: true },
      { pubkey: this.pool, isSigner: false, isWritable: true },
      { pubkey: positionPda, isSigner: false, isWritable: true },
      { pubkey: custody, isSigner: false, isWritable: true },
      { pubkey: collateralCustody, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys,
      data,
    });

    return this.sendTransaction(instruction);
  }

  // -----------------------------------------------------------------------
  // Internal — close position
  // -----------------------------------------------------------------------

  private async closePosition(
    params: CloseParams,
    side: Side
  ): Promise<string> {
    const { owner, mint, price, slippageBps } = params;

    const custody = mint;
    const collateralCustody = USDC_CUSTODY;
    const [positionPda] = this.derivePositionPda(owner, custody, side);
    const [transferAuthority] = findTransferAuthorityPda();

    // User receives USDC back
    const receivingAccount = getAssociatedTokenAddressSync(
      USDC_MINT,
      owner,
      true
    );

    // For close: if price > 0, apply reverse slippage (min acceptable)
    let priceScaled: bigint | null = null;
    if (price > 0) {
      const adjustedPrice =
        side === Side.Long
          ? applySlippage(price, slippageBps, false) // long close wants min price
          : applySlippage(price, slippageBps, true); // short close wants max price
      priceScaled = BigInt(Math.round(adjustedPrice * Number(PRICE_SCALE)));
    }

    const discriminator = side === Side.Long ? IX_CLOSE_LONG : IX_CLOSE_SHORT;
    const data = serializeCloseParams(discriminator, priceScaled);

    const keys = [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: receivingAccount, isSigner: false, isWritable: true },
      { pubkey: transferAuthority, isSigner: false, isWritable: false },
      { pubkey: CORTEX, isSigner: false, isWritable: true },
      { pubkey: this.pool, isSigner: false, isWritable: true },
      { pubkey: positionPda, isSigner: false, isWritable: true },
      { pubkey: custody, isSigner: false, isWritable: true },
      { pubkey: collateralCustody, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys,
      data,
    });

    return this.sendTransaction(instruction);
  }

  // -----------------------------------------------------------------------
  // Internal — fetch & deserialize a position by side
  // -----------------------------------------------------------------------

  private async fetchPositionBySide(
    owner: PublicKey,
    custody: PublicKey,
    side: Side
  ): Promise<PositionInfo | null> {
    const [positionPda] = this.derivePositionPda(owner, custody, side);

    const accountInfo = await this.connection.getAccountInfo(positionPda);
    if (!accountInfo || !accountInfo.data || accountInfo.data.length === 0) {
      return null;
    }

    const raw = deserializePositionAccount(
      Buffer.from(accountInfo.data)
    );

    const entryPrice = Number(raw.price) / Number(PRICE_SCALE);
    const sizeUsd = Number(raw.sizeUsd) / Number(USD_SCALE);
    const collateralUsd = Number(raw.collateralUsd) / Number(USD_SCALE);

    // Approximate liquidation price:
    // Long: entryPrice - (collateralUsd / sizeUsd * entryPrice)
    // Short: entryPrice + (collateralUsd / sizeUsd * entryPrice)
    const collateralRatio = sizeUsd > 0 ? collateralUsd / sizeUsd : 0;
    const liquidationPrice =
      raw.side === Side.Long
        ? entryPrice * (1 - collateralRatio)
        : entryPrice * (1 + collateralRatio);

    return {
      owner: raw.owner,
      custody: raw.custody,
      side: raw.side === Side.Long ? 'long' : 'short',
      sizeUsd,
      collateralUsd,
      entryPrice,
      liquidationPrice,
      // Unrealized PnL requires current market price — not available on-chain
      // in the position account. Callers should compute this separately.
      unrealizedPnl: 0,
      openedAt: Number(raw.openTime),
    };
  }

  // -----------------------------------------------------------------------
  // Internal — transaction assembly & submission
  // -----------------------------------------------------------------------

  private async sendTransaction(
    instruction: TransactionInstruction
  ): Promise<string> {
    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash('confirmed');

    const messageV0 = new TransactionMessage({
      payerKey: this.wallet.publicKey,
      recentBlockhash: blockhash,
      instructions: [instruction],
    }).compileToV0Message();

    const tx = new VersionedTransaction(messageV0);
    const signed = await this.wallet.signTransaction(tx);

    const signature = await this.connection.sendRawTransaction(
      signed.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      }
    );

    await this.connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );

    return signature;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Apply slippage tolerance to a price.
 * @param up - true = increase price (buyer pays more), false = decrease (seller accepts less)
 */
function applySlippage(price: number, slippageBps: number, up: boolean): number {
  const factor = slippageBps / 10000;
  return up ? price * (1 + factor) : price * (1 - factor);
}
