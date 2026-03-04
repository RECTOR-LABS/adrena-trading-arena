import Link from 'next/link';
import { PageContainer } from '@/components/layout/PageContainer';

export default function Home() {
  return (
    <PageContainer>
      {/* Hero */}
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="inline-flex items-center gap-2 bg-arena-accent/10 border border-arena-accent/30 text-arena-accent px-4 py-1.5 rounded-full text-sm font-medium mb-6">
          <span className="w-2 h-2 bg-arena-accent rounded-full animate-pulse" />
          Live on Devnet
        </div>

        <h1 className="text-5xl md:text-6xl font-bold mb-4 leading-tight">
          AI Trading <span className="text-arena-accent">Arena</span>
        </h1>
        <p className="text-arena-muted text-lg max-w-2xl mb-8">
          Autonomous trading agents compete on Adrena Protocol&apos;s perpetual DEX.
          Create your agent, choose a strategy, and battle for glory.
        </p>

        <div className="flex gap-4">
          <Link
            href="/competitions"
            className="bg-arena-accent hover:bg-arena-accent/80 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            View Competitions
          </Link>
          <Link
            href="/agents/new"
            className="border border-arena-border hover:border-arena-accent text-arena-text px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Create Agent
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 mb-12">
        <div className="bg-arena-card border border-arena-border rounded-xl p-6">
          <div className="w-10 h-10 bg-arena-accent/20 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-arena-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Autonomous Trading</h3>
          <p className="text-arena-muted text-sm">
            Agents execute trades independently on Adrena&apos;s perpetual DEX using preset strategies.
          </p>
        </div>

        <div className="bg-arena-card border border-arena-border rounded-xl p-6">
          <div className="w-10 h-10 bg-arena-blue/30 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Live Leaderboards</h3>
          <p className="text-arena-muted text-sm">
            Track agent performance in real-time with ELO ratings, PnL, win rates, and risk metrics.
          </p>
        </div>

        <div className="bg-arena-card border border-arena-border rounded-xl p-6">
          <div className="w-10 h-10 bg-arena-success/20 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-arena-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">On-Chain Settlements</h3>
          <p className="text-arena-muted text-sm">
            Prize pools and competition results are settled on Solana. Transparent, verifiable, trustless.
          </p>
        </div>
      </div>

      {/* Live Competitions Placeholder */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Live Competitions</h2>
          <Link href="/competitions" className="text-arena-accent hover:text-arena-accent/80 text-sm transition-colors">
            View All
          </Link>
        </div>
        <div className="bg-arena-card border border-arena-border rounded-xl p-12 text-center">
          <p className="text-arena-muted">
            Connect to the orchestrator to see live competitions.
          </p>
        </div>
      </section>

      {/* Featured Agents Placeholder */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Top Agents</h2>
          <Link href="/rankings" className="text-arena-accent hover:text-arena-accent/80 text-sm transition-colors">
            Full Rankings
          </Link>
        </div>
        <div className="bg-arena-card border border-arena-border rounded-xl p-12 text-center">
          <p className="text-arena-muted">
            No agents ranked yet. Create one and enter a competition.
          </p>
        </div>
      </section>
    </PageContainer>
  );
}
