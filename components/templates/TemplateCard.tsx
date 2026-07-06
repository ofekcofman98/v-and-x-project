import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Globe, Lock, Trash2, Zap } from 'lucide-react';
import { cn } from '@/lib/shared/utils/cn';
import { categoryIcon, columnPillClass } from './template-categories';
import type { ColumnTemplateDTO } from '@/lib/client/stores/column-template-store';

interface TemplateCardProps {
  template: ColumnTemplateDTO;
  onDeleteClick: (id: string) => void;
  onApplyClick: (template: ColumnTemplateDTO) => void;
}

export function TemplateCard({ template, onDeleteClick, onApplyClick }: TemplateCardProps) {
  const columns = template.schema?.columns ?? [];
  const visibleColumns = columns.slice(0, 5);
  const overflow = columns.length - visibleColumns.length;
  const pillClass = columnPillClass(template.category);

  return (
    <Card className="group flex flex-col hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5" aria-hidden>
              {categoryIcon(template.category)}
            </span>
            <div className="min-w-0">
              <CardTitle className="text-base leading-tight">{template.name}</CardTitle>
              {template.description && (
                <CardDescription className="line-clamp-2 mt-0.5">
                  {template.description}
                </CardDescription>
              )}
            </div>
          </div>
          <button
            onClick={() => onDeleteClick(template.id)}
            aria-label={`Delete ${template.name}`}
            className="mt-0.5 shrink-0 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        <div className="space-y-1 mb-4">
          {visibleColumns.map((col) => (
            <div
              key={col.id}
              className={cn(
                'flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full w-fit',
                pillClass
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 shrink-0" />
              <span className="truncate max-w-[160px]">{col.label}</span>
              <span className="opacity-60 ml-0.5 capitalize">{col.type}</span>
            </div>
          ))}
          {overflow > 0 && (
            <p className="text-xs text-muted-foreground pl-2">+{overflow} more</p>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-slate-100">
          <span>{columns.length} column{columns.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-1">
            {template.is_public ? (
              <>
                <Globe className="h-3 w-3" />
                <span>Public</span>
              </>
            ) : (
              <>
                <Lock className="h-3 w-3" />
                <span>Private</span>
              </>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        <span className="flex-1 text-xs text-muted-foreground">
          Used by {template.usage_count} list{template.usage_count !== 1 ? 's' : ''}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
          onClick={() => onApplyClick(template)}
        >
          <Zap className="h-3.5 w-3.5" />
          Apply
        </Button>
        <Link
          href={`/dashboard/templates/${template.id}`}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 h-8 px-3 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          View
        </Link>
      </CardFooter>
    </Card>
  );
}
