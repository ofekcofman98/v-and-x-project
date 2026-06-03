/**
 * Column Template Store - Manages ColumnTemplate state
 * Implements: docs/features/02_column_templates.md
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface ColumnTemplateDTO {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  is_public: boolean;
  usage_count: number;
  schema?: {
    columns: Array<{
      id: string;
      label: string;
      type: string;
      validation?: Record<string, unknown>;
    }>;
  };
  created_at?: string;
  updated_at?: string;
}

interface ColumnTemplateState {
  templates: ColumnTemplateDTO[];
  isLoading: boolean;
  error: string | null;

  fetchTemplates: () => Promise<void>;
  addTemplate: (template: ColumnTemplateDTO) => void;
  deleteTemplate: (id: string) => void;
  clearError: () => void;
}

export const useColumnTemplateStore = create<ColumnTemplateState>()(
  devtools(
    (set) => ({
      templates: [],
      isLoading: false,
      error: null,

      fetchTemplates: async () => {
        set({ isLoading: true, error: null });

        try {
          // TODO: Replace with real auth header once session is wired up
          const response = await fetch('/api/column-templates', {
            headers: { 'x-user-id': 'dev-user' },
          });

          if (!response.ok) {
            const errorData = await response
              .json()
              .catch(() => ({ error: 'Failed to fetch templates' }));
            throw new Error(
              errorData.error || `HTTP ${response.status}: Failed to fetch templates`
            );
          }

          const result = await response.json();
          const templates: ColumnTemplateDTO[] = result.data?.data ?? result.data ?? [];
          set({ templates, isLoading: false });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'An unknown error occurred';
          set({ error: errorMessage, isLoading: false });
        }
      },

      addTemplate: (template) =>
        set((state) => ({ templates: [template, ...state.templates] })),

      deleteTemplate: (id) =>
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        })),

      clearError: () => set({ error: null }),
    }),
    { name: 'ColumnTemplateStore' }
  )
);
