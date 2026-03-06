import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-arena-dark flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h2 className="text-6xl font-bold text-arena-accent mb-4">404</h2>
        <p className="text-xl text-white mb-2">Page Not Found</p>
        <p className="text-gray-400 mb-6">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <Link href="/" className="bg-arena-accent hover:bg-arena-accent/80 text-white px-6 py-3 rounded-lg font-semibold transition-colors inline-block">
          Back to Arena
        </Link>
      </div>
    </div>
  );
}
