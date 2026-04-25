import { AppHeader } from "../AppHeader";
import { Button } from "../ui/button";

export function ErrorState({ title, error, onRetry }: { title: string;error: string; onRetry: () => void }) {
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
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-6">{error}</p>
              <Button onClick={onRetry}>Try Again</Button>
            </div>
          </section>
        </main>
      </>
    );
  }
