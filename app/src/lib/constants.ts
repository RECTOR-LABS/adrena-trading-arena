export const ARENA_PROGRAM_ID = process.env.NEXT_PUBLIC_ARENA_PROGRAM_ID || 'PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6';
export const ADRENA_PROGRAM_ID = process.env.NEXT_PUBLIC_ADRENA_PROGRAM_ID || '13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet';
export const ORCHESTRATOR_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
export const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://api.devnet.solana.com';
export const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet') as 'devnet' | 'mainnet-beta';
