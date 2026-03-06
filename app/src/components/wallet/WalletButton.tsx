'use client';

import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

export function WalletButton() {
  return (
    <div className="[&_.wallet-adapter-button]:!bg-arena-accent [&_.wallet-adapter-button]:!rounded-lg [&_.wallet-adapter-button]:!text-sm [&_.wallet-adapter-button]:!h-10">
      <WalletMultiButton />
    </div>
  );
}
