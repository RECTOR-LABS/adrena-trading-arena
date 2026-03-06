import { PublicKey } from '@solana/web3.js';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Adrena Protocol — On-chain Program & Account Addresses (mainnet-beta)
// ---------------------------------------------------------------------------

export const ADRENA_PROGRAM_ID = new PublicKey(
  '13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet'
);

export const CORTEX = new PublicKey(
  'Dhz8Ta79hgyUbaRcu7qHMnqMfY47kQHfHt2s42D9dC4e'
);

export const MAIN_POOL = new PublicKey(
  '4bQRutgDJs6vuh6ZcWaPVXiQaBzbHketjbCDjL4oRN34'
);

// Custodies — one per supported collateral asset
export const USDC_CUSTODY = new PublicKey(
  'Dk523LZeDQbZtUwPEBjFXCd2Au1tD7mWZBJJmcgHktNk'
);

export const JITOSOL_CUSTODY = new PublicKey(
  'GZ9XfWwgTRhkma2Y91Q9r1XKotNXYjBnKKabj19rhT71'
);

export const WBTC_CUSTODY = new PublicKey(
  'GFu3qS22mo6bAjg4Lr5R7L8pPgHq6GvbjJPKEHkbbs2c'
);

export const BONK_CUSTODY = new PublicKey(
  '8aJuzsgjxBnvRhDcfQBD7z4CUj7QoPEpaNwVd7KqsSk5'
);

// Mints
export const USDC_MINT = new PublicKey(
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
);

export const JITOSOL_MINT = new PublicKey(
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn'
);

// Transfer authority PDA
export const TRANSFER_AUTHORITY_SEED = 'transfer_authority';

export function findTransferAuthorityPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(TRANSFER_AUTHORITY_SEED)],
    ADRENA_PROGRAM_ID
  );
}

// ---------------------------------------------------------------------------
// Position PDA: seeds = ["position", owner, pool, custody, side_u8]
// side_u8: 0 = Long, 1 = Short
// ---------------------------------------------------------------------------

export const POSITION_SEED = 'position';

export enum Side {
  Long = 0,
  Short = 1,
}

export function findPositionPda(
  owner: PublicKey,
  pool: PublicKey,
  custody: PublicKey,
  side: Side
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(POSITION_SEED),
      owner.toBuffer(),
      pool.toBuffer(),
      custody.toBuffer(),
      Buffer.from([side]),
    ],
    ADRENA_PROGRAM_ID
  );
}

// ---------------------------------------------------------------------------
// Anchor instruction discriminators
// Convention: first 8 bytes of sha256("global:<instruction_name>")
// ---------------------------------------------------------------------------

export function anchorDiscriminator(instructionName: string): Buffer {
  const hash = createHash('sha256')
    .update(`global:${instructionName}`)
    .digest();
  return hash.subarray(0, 8);
}

export const IX_OPEN_LONG = anchorDiscriminator('open_or_increase_position_with_swap_long');
export const IX_OPEN_SHORT = anchorDiscriminator('open_or_increase_position_with_swap_short');
export const IX_CLOSE_LONG = anchorDiscriminator('close_position_long');
export const IX_CLOSE_SHORT = anchorDiscriminator('close_position_short');

// ---------------------------------------------------------------------------
// Custody lookup: mint -> custody address
// ---------------------------------------------------------------------------

const CUSTODY_BY_MINT = new Map<string, PublicKey>([
  [USDC_MINT.toBase58(), USDC_CUSTODY],
  [JITOSOL_MINT.toBase58(), JITOSOL_CUSTODY],
]);

export function getCustodyByMint(mint: PublicKey): PublicKey | undefined {
  return CUSTODY_BY_MINT.get(mint.toBase58());
}

// ---------------------------------------------------------------------------
// Position account struct offsets & deserialization
//
// Total known layout size: 248 bytes
// All u64 values are stored as little-endian.
// ---------------------------------------------------------------------------

export const POSITION_ACCOUNT_SIZE = 248;

export interface RawPositionData {
  bump: number;
  side: Side;
  takeProfitIsSet: boolean;
  stopLossIsSet: boolean;
  owner: PublicKey;
  pool: PublicKey;
  custody: PublicKey;
  collateralCustody: PublicKey;
  openTime: bigint;
  updateTime: bigint;
  /** Entry price with 10 decimal places */
  price: bigint;
  /** Size in USD with 6 decimal places */
  sizeUsd: bigint;
  borrowSizeUsd: bigint;
  /** Collateral in USD with 6 decimal places */
  collateralUsd: bigint;
  unrealizedInterestUsd: bigint;
  cumulativeInterestSnapshot: bigint;
  lockedAmount: bigint;
  collateralAmount: bigint;
  exitFeeUsd: bigint;
  liquidationFeeUsd: bigint;
  id: bigint;
}

export function deserializePositionAccount(data: Buffer): RawPositionData {
  if (data.length < POSITION_ACCOUNT_SIZE) {
    throw new Error(
      `Position account data too small: ${data.length} bytes, expected >= ${POSITION_ACCOUNT_SIZE}`
    );
  }

  // Anchor accounts have an 8-byte discriminator prefix — skip it
  const offset = 8;
  const buf = data;

  const bump = buf.readUInt8(offset + 0);
  const sideRaw = buf.readUInt8(offset + 1);
  const takeProfitIsSet = buf.readUInt8(offset + 2) !== 0;
  const stopLossIsSet = buf.readUInt8(offset + 3) !== 0;
  // offset + 4..7 = padding

  const owner = new PublicKey(buf.subarray(offset + 8, offset + 40));
  const pool = new PublicKey(buf.subarray(offset + 40, offset + 72));
  const custody = new PublicKey(buf.subarray(offset + 72, offset + 104));
  const collateralCustody = new PublicKey(buf.subarray(offset + 104, offset + 136));

  const openTime = buf.readBigInt64LE(offset + 136);
  const updateTime = buf.readBigInt64LE(offset + 144);
  const price = buf.readBigUInt64LE(offset + 152);
  const sizeUsd = buf.readBigUInt64LE(offset + 160);
  const borrowSizeUsd = buf.readBigUInt64LE(offset + 168);
  const collateralUsd = buf.readBigUInt64LE(offset + 176);
  const unrealizedInterestUsd = buf.readBigUInt64LE(offset + 184);

  // U128 — read as two u64 LE parts combined
  const lo = buf.readBigUInt64LE(offset + 192);
  const hi = buf.readBigUInt64LE(offset + 200);
  const cumulativeInterestSnapshot = (hi << 64n) | lo;

  const lockedAmount = buf.readBigUInt64LE(offset + 208);
  const collateralAmount = buf.readBigUInt64LE(offset + 216);
  const exitFeeUsd = buf.readBigUInt64LE(offset + 224);
  const liquidationFeeUsd = buf.readBigUInt64LE(offset + 232);
  const id = buf.readBigUInt64LE(offset + 240);

  return {
    bump,
    side: sideRaw === 0 ? Side.Long : Side.Short,
    takeProfitIsSet,
    stopLossIsSet,
    owner,
    pool,
    custody,
    collateralCustody,
    openTime,
    updateTime,
    price,
    sizeUsd,
    borrowSizeUsd,
    collateralUsd,
    unrealizedInterestUsd,
    cumulativeInterestSnapshot,
    lockedAmount,
    collateralAmount,
    exitFeeUsd,
    liquidationFeeUsd,
    id,
  };
}
