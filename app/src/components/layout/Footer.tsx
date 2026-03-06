export function Footer() {
  return (
    <footer className="border-t border-arena-border bg-arena-card/50 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <p className="text-arena-muted text-sm">
            AI Trading Arena on Adrena Protocol
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://www.adrena.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-arena-muted hover:text-arena-text transition-colors text-sm"
            >
              Adrena
            </a>
            <a
              href="https://github.com/RECTOR-LABS/adrena-trading-arena"
              target="_blank"
              rel="noopener noreferrer"
              className="text-arena-muted hover:text-arena-text transition-colors text-sm"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
