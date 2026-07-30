'use client';

/**
 * EmailInviteRow
 * Shared "invite by email" control — email input + role select + Add button.
 * Resolves the email to a userId via GET /api/users/lookup, then hands the
 * resolved id off to the caller (which performs the actual add-member call).
 * Reused by WorkbenchMembersDialog and GroupMembersDialog.
 * Implements: docs/features/12_groups_workbenches.md §8 Phase 4
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, UserPlus } from 'lucide-react';

const ROLE_OPTIONS = ['VIEWER', 'EDITOR', 'ADMIN', 'OWNER'] as const;

export interface EmailInviteRowProps {
  onInvite: (userId: string, role: string) => Promise<void>;
}

export function EmailInviteRow({ onInvite }: EmailInviteRowProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('VIEWER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!email.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/lookup?email=${encodeURIComponent(email.trim())}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'No user found with that email' }));
        throw new Error(Array.isArray(data.error) ? data.error.join(', ') : data.error || 'No user found with that email');
      }
      const { data } = await response.json();
      await onInvite(data.id, role);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Input
          type="email"
          placeholder="collaborator@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="text-sm border border-slate-200 rounded-md px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={handleAdd} disabled={!email.trim() || isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
