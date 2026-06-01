'use client';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  } from '@/components/ui/alert-dialog';

  interface DeleteConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;       
    itemName: string;    
    isDeleting: boolean; 
  }

  export function DeleteConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    itemName,
    isDeleting,
  }: DeleteConfirmDialogProps) {
    return (
        <AlertDialog 
          open={isOpen} 
          onOpenChange={(open) => { 
            if (!open && !isDeleting) onClose(); 
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete{' '}
                <span className="font-medium text-slate-900">&ldquo;{itemName}&rdquo;</span>?{' '}
                This action cannot be undone and will permanently remove all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting} onClick={onClose}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onConfirm} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white">
                {isDeleting ? 'Deleting…' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
  }