'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { ColumnAccess, OrgRole } from '@/lib/shared/types/column-access';

const ASSIGNABLE_ROLES: OrgRole[] = ['ADMIN', 'EDITOR', 'VIEWER'];

interface ColumnAccessModalProps {
  columnLabel: string;
  access: ColumnAccess | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Persists the new access rule. Callers on an existing table/list do a
   * live PATCH here; builder callers (unsaved columns) just update local state.
   */
  onSubmit: (access: ColumnAccess) => Promise<void> | void;
}

export function ColumnAccessModal({
  columnLabel,
  access,
  open,
  onOpenChange,
  onSubmit,
}: ColumnAccessModalProps) {
  const { toast } = useToast();
  const [visibility, setVisibility] = useState<'public' | 'private'>(access?.visibility ?? 'public');
  const [allowedRoles, setAllowedRoles] = useState<Set<OrgRole>>(new Set(access?.allowedRoles ?? []));
  const [isSaving, setIsSaving] = useState(false);

  const toggleRole = (role: OrgRole) => {
    setAllowedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const nextAccess: ColumnAccess = {
        visibility,
        allowedRoles: Array.from(allowedRoles),
      };

      await onSubmit(nextAccess);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not update column access.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Column access: {columnLabel}</DialogTitle>
          <DialogDescription>
            Control which organization roles can see and edit this column.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={visibility === 'public' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setVisibility('public')}
            >
              Public
            </Button>
            <Button
              type="button"
              variant={visibility === 'private' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setVisibility('private')}
            >
              Private
            </Button>
          </div>

          {visibility === 'private' && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Allowed roles</p>
              {ASSIGNABLE_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={allowedRoles.has(role)}
                    onChange={() => toggleRole(role)}
                  />
                  {role}
                </label>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
