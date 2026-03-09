import { AppHeader } from '@/components/AppHeader';
import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <section className="container flex flex-col items-center justify-center gap-6 py-8 md:py-12 lg:py-24">
          <div className="flex max-w-[980px] flex-col items-center gap-4 text-center">
            <h1 className="text-3xl font-bold leading-tight tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
              Fill spreadsheets with your voice
            </h1>
            <p className="max-w-[750px] text-base text-muted-foreground sm:text-lg md:text-xl">
              VocalGrid lets you enter data hands-free using AI-powered voice commands. 
              Perfect for teachers, researchers, and anyone managing data entry tasks.
            </p>
          </div>
          
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link
              href="#"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 sm:h-11 sm:px-8"
            >
              Get Started
            </Link>
            <Link
              href="/demo/table"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-6 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 sm:h-11 sm:px-8"
            >
              View Demo
            </Link>
          </div>

          <div className="mt-8 w-full max-w-3xl rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="mb-4 text-xl font-semibold sm:text-2xl">How it works</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <span className="text-lg font-bold">1</span>
                </div>
                <h3 className="font-medium">Create a table</h3>
                <p className="text-sm text-muted-foreground">
                  Define your columns and add rows
                </p>
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <span className="text-lg font-bold">2</span>
                </div>
                <h3 className="font-medium">Speak your data</h3>
                <p className="text-sm text-muted-foreground">
                  Say names, numbers, or dates naturally
                </p>
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <span className="text-lg font-bold">3</span>
                </div>
                <h3 className="font-medium">Auto-fill cells</h3>
                <p className="text-sm text-muted-foreground">
                  AI matches and fills the right cells
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
