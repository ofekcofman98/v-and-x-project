'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/client/stores/use-auth-store';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

function AuthSlot() {
  const router = useRouter();
  const { status, user } = useAuthStore();

  if (status === 'loading') return null;

  if (status === 'unauthenticated') {
    return (
      <Link
        href="/login"
        className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Sign In
      </Link>
    );
  }

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground sm:inline-block">{user?.email}</span>
      <Button variant="outline" size="sm" onClick={handleLogOut}>
        Log Out
      </Button>
    </div>
  );
}

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
            <AuthSlot />
          </nav>
        </div>
      </div>
    </header>
  );
}
