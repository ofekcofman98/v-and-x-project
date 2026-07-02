'use client';

/**
 * Create BaseList Wizard - Root Component
 * 3-step wizard for creating new BaseLists
 * Implements: docs/14_PRODUCT_DATA_FLOW.md §3.1
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { useBaseListStore } from '@/lib/client/stores/base-list-store';
import { ColumnType } from '@/lib/shared/types/column-types';
import { Step1Info } from './Step1Info';
import { Step2Schema } from './Step2Schema';
import { Step3DataEntry } from './Step3DataEntry';
import { createBaseListSchema, type CreateBaseListFormData } from './types';

interface CreateListWizardProps {
  open: boolean;
  onClose: () => void;
}

export function CreateListWizard({ open, onClose }: CreateListWizardProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { fetchLists } = useBaseListStore();

  const form = useForm<CreateBaseListFormData>({
    resolver: zodResolver(createBaseListSchema),
    defaultValues: {
      name: '',
      description: '',
      columns: [
        {
          id: 'name',
          label: 'Name',
          type: ColumnType.TEXT,
          validation: { required: true },
        },
      ],
      entities: [],
    },
  });

  const handleNext = async () => {
    let fieldsToValidate: (keyof CreateBaseListFormData)[] = [];

    if (step === 1) {
      fieldsToValidate = ['name', 'description'];
    } else if (step === 2) {
      fieldsToValidate = ['columns'];
    }

    const isValid = await form.trigger(fieldsToValidate);
    
    if (isValid) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleClose = () => {
    form.reset();
    setStep(1);
    onClose();
  };

  const onSubmit = async (data: CreateBaseListFormData) => {
    setIsSubmitting(true);

    try {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        schema: {
          columns: data.columns.map((col) => ({
            id: col.id,
            label: col.label,
            type: col.type,
            validation: col.validation,
          })),
        },
        entities: data.entities
          .filter((entity) => {
            return Object.values(entity.values).some(
              (val) => val !== '' && val !== null && val !== undefined
            );
          })
          .map((entity) => ({
            values: entity.values,
          })),
      };

      const response = await fetch('/api/base-lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create list' }));
        throw new Error(errorData.error || 'Failed to create list');
      }

      toast({
        title: 'Success!',
        description: `"${data.name}" has been created successfully.`,
      });

      await fetchLists();
      handleClose();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return 'General Information';
      case 2:
        return 'Define Schema';
      case 3:
        return 'Add Data (Optional)';
      default:
        return '';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 1:
        return 'Start by naming your list and adding a description';
      case 2:
        return 'Define the columns that describe your entities';
      case 3:
        return 'Add initial entities to your list';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Create New Base List - Step {step} of 3
          </DialogTitle>
          <DialogDescription>{getStepDescription()}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((stepNum) => (
            <div
              key={stepNum}
              className={`flex-1 h-2 rounded-full transition-colors ${
                stepNum <= step ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="space-y-6 pb-4">
            {step === 1 && <Step1Info form={form} />}
            {step === 2 && <Step2Schema form={form} />}
            {step === 3 && <Step3DataEntry form={form} />}
          </div>
        </form>

        <DialogFooter className="mt-6 pt-4 border-t">
          <div className="flex gap-2 w-full justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>

            <div className="flex gap-2">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                >
                  Back
                </Button>
              )}

              {step < 3 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create List'}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
