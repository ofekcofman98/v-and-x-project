import { Button } from '@/components/ui/button';
import { LayoutTemplate, Plus } from 'lucide-react';

interface TemplatesEmptyStateProps {
  onCreateClick: () => void;
  /** True when a category tab or search is active — adjusts copy and hides CTA. */
  hasFilter: boolean;
}

export function TemplatesEmptyState({ onCreateClick, hasFilter }: TemplatesEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="rounded-full bg-muted p-6 mb-4">
        <LayoutTemplate className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">
        {hasFilter ? 'No templates in this category' : 'No templates yet'}
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
        {hasFilter
          ? 'Try switching to "All Templates" or create a new one.'
          : 'Column templates let you reuse the same schema across multiple Base Lists, saving setup time.'}
      </p>
      {!hasFilter && (
        <Button onClick={onCreateClick}>
          <Plus className="w-4 h-4 mr-2" />
          Create Your First Template
        </Button>
      )}
    </div>
  );
}
