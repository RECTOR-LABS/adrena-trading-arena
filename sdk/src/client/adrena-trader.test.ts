import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from '@solana/web3.js';
import { LiveAdrenaTrader, keypairToWallet } from './live-adrena-trader';
import type { AdrenaWallet } from './live-adrena-trader';
import {
  ADRENA_PROGRAM_ID,
  MAIN_POOL,
  USDC_CUSTODY,
  JITOSOL_CUSTODY,
  Side,
  findPositionPda,
  findTransferAuthorityPda,
  anchorDiscriminator,
  deserializePositionAccount,
  POSITION_ACCOUNT_SIZE,
  IX_OPEN_LONG,
  IX_OPEN_SHORT,
  IX_CLOSE_LONG,
  IX_CLOSE_SHORT,
} from './adrena-constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockConnection(): Connection {
  return {
    getAccountInfo: vi.fn().mockResolvedValue(null),
    getLatestBlockhash: vi.fn().mockResolvedValue({
      blockhash: '11111111111111111111111111111111',
      lastValidBlockHeight: 100,
    }),
    sendRawTransaction: vi.fn().mockResolvedValue('mock-sig-123'),
    confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
  } as unknown as Connection;
}

function mockWallet(): AdrenaWallet {
  const kp = Keypair.generate();
  return {
    publicKey: kp.publicKey,
    signTransaction: vi.fn(async (tx: VersionedTransaction) => tx),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LiveAdrenaTrader', () => {
  let connection: Connection;
  let wallet: AdrenaWallet;
  let trader: LiveAdrenaTrader;

  beforeEach(() => {
    connection = mockConnection();
    wallet = mockWallet();
    trader = new LiveAdrenaTrader(connection, wallet);
  });

  describe('constructor', () => {
    it('uses default program ID and pool', () => {
      expect(trader.programId.equals(ADRENA_PROGRAM_ID)).toBe(true);
      expect(trader.pool.equals(MAIN_POOL)).toBe(true);
    });

    it('accepts custom program ID and pool', () => {
      const customProgramId = PublicKey.unique();
      const customPool = PublicKey.unique();
      const custom = new LiveAdrenaTrader(connection, wallet, {
        programId: customProgramId,
        pool: customPool,
      });
      expect(custom.programId.equals(customProgramId)).toBe(true);
      expect(custom.pool.equals(customPool)).toBe(true);
    });
  });

  describe('keypairToWallet', () => {
    it('wraps Keypair into AdrenaWallet interface', () => {
      const kp = Keypair.generate();
      const w = keypairToWallet(kp);
      expect(w.publicKey.equals(kp.publicKey)).toBe(true);
      expect(typeof w.signTransaction).toBe('function');
    });
  });

  describe('PDA derivation', () => {
    it('derives long position PDA matching findPositionPda', () => {
      const owner = Keypair.generate().publicKey;
      const custody = JITOSOL_CUSTODY;

      const [fromTrader, bumpTrader] = trader.derivePositionPda(owner, custody, Side.Long);
      const [fromFn, bumpFn] = findPositionPda(owner, MAIN_POOL, custody, Side.Long);

      expect(fromTrader.equals(fromFn)).toBe(true);
      expect(bumpTrader).toBe(bumpFn);
    });

    it('derives short position PDA matching findPositionPda', () => {
      const owner = Keypair.generate().publicKey;
      const custody = USDC_CUSTODY;

      const [fromTrader, bumpTrader] = trader.derivePositionPda(owner, custody, Side.Short);
      const [fromFn, bumpFn] = findPositionPda(owner, MAIN_POOL, custody, Side.Short);

      expect(fromTrader.equals(fromFn)).toBe(true);
      expect(bumpTrader).toBe(bumpFn);
    });

    it('long and short PDAs differ for same owner/custody', () => {
      const owner = Keypair.generate().publicKey;
      const custody = JITOSOL_CUSTODY;

      const [longPda] = trader.derivePositionPda(owner, custody, Side.Long);
      const [shortPda] = trader.derivePositionPda(owner, custody, Side.Short);

      expect(longPda.equals(shortPda)).toBe(false);
    });

    it('transfer authority PDA is deterministic', () => {
      const [a] = findTransferAuthorityPda();
      const [b] = findTransferAuthorityPda();
      expect(a.equals(b)).toBe(true);
    });
  });

  describe('instruction discriminators', () => {
    it('open long discriminator is 8 bytes', () => {
      expect(IX_OPEN_LONG.length).toBe(8);
    });

    it('open short discriminator is 8 bytes', () => {
      expect(IX_OPEN_SHORT.length).toBe(8);
    });

    it('close long discriminator is 8 bytes', () => {
      expect(IX_CLOSE_LONG.length).toBe(8);
    });

    it('close short discriminator is 8 bytes', () => {
      expect(IX_CLOSE_SHORT.length).toBe(8);
    });

    it('all discriminators are unique', () => {
      const set = new Set([
        IX_OPEN_LONG.toString('hex'),
        IX_OPEN_SHORT.toString('hex'),
        IX_CLOSE_LONG.toString('hex'),
        IX_CLOSE_SHORT.toString('hex'),
      ]);
      expect(set.size).toBe(4);
    });

    it('anchorDiscriminator produces consistent results', () => {
      const a = anchorDiscriminator('test_instruction');
      const b = anchorDiscriminator('test_instruction');
      expect(a.equals(b)).toBe(true);
    });

    it('different instruction names produce different discriminators', () => {
      const a = anchorDiscriminator('foo');
      const b = anchorDiscriminator('bar');
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('getPosition', () => {
    it('returns null when no position exists', async () => {
      const result = await trader.getPosition(
        Keypair.generate().publicKey,
        JITOSOL_CUSTODY
      );
      expect(result).toBeNull();
    });

    it('returns null when account data is empty', async () => {
      (connection.getAccountInfo as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: Buffer.alloc(0),
        executable: false,
        lamports: 0,
        owner: ADRENA_PROGRAM_ID,
      });

      const result = await trader.getPosition(
        Keypair.generate().publicKey,
        JITOSOL_CUSTODY
      );
      expect(result).toBeNull();
    });
  });

  describe('deserializePositionAccount', () => {
    function buildPositionBuffer(overrides?: {
      side?: number;
      price?: bigint;
      sizeUsd?: bigint;
      collateralUsd?: bigint;
      openTime?: bigint;
      owner?: PublicKey;
      custody?: PublicKey;
    }): Buffer {
      // 8 (anchor discriminator) + POSITION_ACCOUNT_SIZE
      const totalSize = 8 + POSITION_ACCOUNT_SIZE;
      const buf = Buffer.alloc(totalSize);

      // Anchor discriminator (first 8 bytes) — any value
      buf.writeUInt8(0xAA, 0);

      const offset = 8;

      // bump
      buf.writeUInt8(255, offset + 0);
      // side
      buf.writeUInt8(overrides?.side ?? 0, offset + 1);
      // take_profit_is_set
      buf.writeUInt8(1, offset + 2);
      // stop_loss_is_set
      buf.writeUInt8(0, offset + 3);
      // padding (4 bytes) — already zero

      // owner (32 bytes at offset+8)
      const ownerKey = overrides?.owner ?? Keypair.generate().publicKey;
      ownerKey.toBuffer().copy(buf, offset + 8);

      // pool (32 bytes at offset+40)
      MAIN_POOL.toBuffer().copy(buf, offset + 40);

      // custody (32 bytes at offset+72)
      const custodyKey = overrides?.custody ?? JITOSOL_CUSTODY;
      custodyKey.toBuffer().copy(buf, offset + 72);

      // collateral_custody (32 bytes at offset+104)
      USDC_CUSTODY.toBuffer().copy(buf, offset + 104);

      // open_time (i64 at offset+136)
      buf.writeBigInt64LE(overrides?.openTime ?? 1700000000n, offset + 136);
      // update_time (i64 at offset+144)
      buf.writeBigInt64LE(1700001000n, offset + 144);
      // price (u64 at offset+152) — 10 decimals, e.g. 100.0 = 1_000_000_000_000
      buf.writeBigUInt64LE(overrides?.price ?? 1000000000000n, offset + 152);
      // size_usd (u64 at offset+160) — 6 decimals, e.g. 1000.0 = 1_000_000_000
      buf.writeBigUInt64LE(overrides?.sizeUsd ?? 1000000000n, offset + 160);
      // borrow_size_usd (u64 at offset+168)
      buf.writeBigUInt64LE(500000000n, offset + 168);
      // collateral_usd (u64 at offset+176) — 6 decimals, e.g. 100.0 = 100_000_000
      buf.writeBigUInt64LE(overrides?.collateralUsd ?? 100000000n, offset + 176);
      // unrealized_interest_usd (u64 at offset+184)
      buf.writeBigUInt64LE(0n, offset + 184);
      // cumulative_interest_snapshot (u128 at offset+192 — two u64 LE)
      buf.writeBigUInt64LE(0n, offset + 192);
      buf.writeBigUInt64LE(0n, offset + 200);
      // locked_amount (u64 at offset+208)
      buf.writeBigUInt64LE(50000000n, offset + 208);
      // collateral_amount (u64 at offset+216)
      buf.writeBigUInt64LE(100000000n, offset + 216);
      // exit_fee_usd (u64 at offset+224)
      buf.writeBigUInt64LE(1000000n, offset + 224);
      // liquidation_fee_usd (u64 at offset+232)
      buf.writeBigUInt64LE(500000n, offset + 232);
      // id (u64 at offset+240)
      buf.writeBigUInt64LE(42n, offset + 240);

      return buf;
    }

    it('deserializes a long position correctly', () => {
      const owner = Keypair.generate().publicKey;
      const buf = buildPositionBuffer({
        side: 0,
        price: 1000000000000n, // 100.0 at 10 decimals
        sizeUsd: 1000000000n,  // 1000.0 at 6 decimals
        collateralUsd: 100000000n, // 100.0 at 6 decimals
        openTime: 1700000000n,
        owner,
        custody: JITOSOL_CUSTODY,
      });

      const raw = deserializePositionAccount(buf);

      expect(raw.side).toBe(Side.Long);
      expect(raw.owner.equals(owner)).toBe(true);
      expect(raw.custody.equals(JITOSOL_CUSTODY)).toBe(true);
      expect(raw.pool.equals(MAIN_POOL)).toBe(true);
      expect(Number(raw.price)).toBe(1000000000000);
      expect(Number(raw.sizeUsd)).toBe(1000000000);
      expect(Number(raw.collateralUsd)).toBe(100000000);
      expect(Number(raw.openTime)).toBe(1700000000);
      expect(Number(raw.id)).toBe(42);
      expect(raw.takeProfitIsSet).toBe(true);
      expect(raw.stopLossIsSet).toBe(false);
    });

    it('deserializes a short position correctly', () => {
      const buf = buildPositionBuffer({ side: 1 });
      const raw = deserializePositionAccount(buf);
      expect(raw.side).toBe(Side.Short);
    });

    it('throws for too-small buffer', () => {
      const small = Buffer.alloc(10);
      expect(() => deserializePositionAccount(small)).toThrow(
        /Position account data too small/
      );
    });
  });

  describe('interface compliance', () => {
    it('implements AdrenaTrader — has openLong', () => {
      expect(typeof trader.openLong).toBe('function');
    });

    it('implements AdrenaTrader — has openShort', () => {
      expect(typeof trader.openShort).toBe('function');
    });

    it('implements AdrenaTrader — has closeLong', () => {
      expect(typeof trader.closeLong).toBe('function');
    });

    it('implements AdrenaTrader — has closeShort', () => {
      expect(typeof trader.closeShort).toBe('function');
    });

    it('implements AdrenaTrader — has getPosition', () => {
      expect(typeof trader.getPosition).toBe('function');
    });
  });
});
