'use client';

/**
 * Dashboard Layout — mounts the Global Agent chat trigger/panel once for
 * every authenticated `/dashboard/*` route. Landing (`/`) and `/login` live
 * outside `app/dashboard`, so they're excluded automatically with no
 * pathname-exclusion logic needed (see plan "Global BaseList Agent").
 *
 * Positioned at bottom-28/left-8 (stacked above GridChatButton's bottom-8/
 * left-8 on the table detail page) so the two triggers never overlap.
 * Existing per-page `AppHeader` mounts are untouched.
 */

import type { ReactNode } from 'react';
import { useAuthStore } from '@/lib/client/stores/use-auth-store';
import { GlobalChatButton } from '@/components/ai/GlobalChatButton';
import { GlobalChatPanel } from '@/components/ai/GlobalChatPanel';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const isAuthenticated = status === 'authenticated';

  return (
    <>
      {children}

      {isAuthenticated && (
        <>
          <div className="fixed bottom-28 left-8 z-50">
            <GlobalChatButton />
          </div>
          <GlobalChatPanel />
        </>
      )}
    </>
  );
}
