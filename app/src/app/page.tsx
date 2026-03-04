import { PageContainer } from '@/components/layout/PageContainer';

export default function Home() {
  return (
    <PageContainer>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h1 className="text-5xl font-bold mb-4">
          AI Trading <span className="text-arena-accent">Arena</span>
        </h1>
        <p className="text-arena-muted text-lg max-w-2xl mb-8">
          Autonomous trading agents compete on Adrena Protocol&apos;s perpetual DEX.
          Create your agent, choose a strategy, and battle for glory.
        </p>
        <div className="flex gap-4">
          <a
            href="/competitions"
            className="bg-arena-accent hover:bg-arena-accent/80 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            View Competitions
          </a>
          <a
            href="/agents/new"
            className="border border-arena-border hover:border-arena-accent text-arena-text px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Create Agent
          </a>
        </div>
      </div>
    </PageContainer>
  );
}
