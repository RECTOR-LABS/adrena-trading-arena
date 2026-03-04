'use client';

import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

export function WalletButton() {
  return (
    <WalletMultiButton
      style={{
        backgroundColor: '#e94560',
        borderRadius: '8px',
        fontSize: '14px',
        height: '40px',
      }}
    />
  );
}
