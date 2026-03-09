import Link from 'next/link';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center px-4 sm:px-6 lg:px-8">
        <div className="flex flex-1 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-lg font-bold text-primary-foreground">V</span>
            </div>
            <span className="hidden font-bold sm:inline-block">
              VocalGrid
            </span>
          </Link>

          <nav className="flex items-center space-x-2 sm:space-x-4">
            <Link
              href="/"
              className="text-sm font-medium text-foreground/60 transition-colors hover:text-foreground/80"
            >
              Tables
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
