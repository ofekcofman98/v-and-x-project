import { AppHeader } from "../AppHeader";
import Link from 'next/link';

export function NotFoundState({ title, description, backLink, backLabel }: { title: string; description: string; backLink: string, backLabel: string }) {
    return (
      <>
        <AppHeader />
        <main className="flex flex-1 flex-col">
          <section className="container py-8 md:py-12">
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="rounded-full bg-red-50 p-6 mb-4">
                <svg
                  className="h-12 w-12 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                {description}
              </p>
              <Link
                href={backLink}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
              >
                {backLabel}
              </Link>
            </div>
          </section>
        </main>
      </>
    );
  }
