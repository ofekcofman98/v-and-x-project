'use client';

/**
 * CreateContainerDialog
 * Minimal name+description creation dialog shared by "New Workbench" and
 * "New Group" — both are simple containers with no schema to define, unlike
 * DynamicListCreator/DynamicTemplateCreator.
 * Implements: docs/features/12_groups_workbenches.md §5
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export interface CreateContainerDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (name: string, description?: string) => Promise<void>;
}

export function CreateContainerDialog({ open, title, onClose, onSubmit }: CreateContainerDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    setName('');
    setDescription('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(name.trim(), description.trim() || undefined);
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Give it a name so you can find it later.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="container-name">Name</Label>
            <Input
              id="container-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Classes"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="container-description">Description (optional)</Label>
            <Textarea
              id="container-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
