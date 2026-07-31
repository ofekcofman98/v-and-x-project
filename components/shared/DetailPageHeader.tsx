/**
 * DetailPageHeader
 * Memo-wrapped shell that groups all static header content for any detail page
 * (Tables, Base-Lists, etc.). Collapsing this subtree into a single React.memo
 * boundary means React only runs one prop comparison when interactive state
 * changes (cell clicks, dialog toggles) trigger reconciliation in the parent.
 */

import React from 'react';
import Link from 'next/link';
import { Trash2, MoreVertical } from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { RelationCard } from '@/components/shared/RelationCard';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export interface StatCardConfig {
  title: string;
  value: string;
}

export interface HeaderMenuAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

export interface RelationCardConfig {
  title: string;
  linkHref: string;
  linkLabel: string;
  description?: string | null;
}

export interface DetailPageHeaderProps {
  name: string;
  description?: string | null;
  /** Omit when this header renders inline (e.g. the Library page's master-detail pane) — no back link is shown. */
  backHref?: string;
  backLabel?: string;
  deleteAriaLabel: string;
  /** Pre-built stat card descriptors — values must be pre-formatted strings */
  statCards: StatCardConfig[];
  /** Stable callback (useCallback at call-site) to open the delete dialog */
  onDeleteClick: () => void;
  /** Optional linked-entity card rendered below the stat row */
  relationCard?: RelationCardConfig | null;
  /** Optional secondary actions, rendered as one "..." menu next to delete — keeps the header to a single action affordance instead of a growing button row. */
  moreActions?: HeaderMenuAction[];
}

export const DetailPageHeader = React.memo(function DetailPageHeader({
  name,
  description,
  backHref,
  backLabel,
  deleteAriaLabel,
  statCards,
  onDeleteClick,
  relationCard,
  moreActions,
}: DetailPageHeaderProps) {
  return (
    <>
      {/* Title row + action buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
          {description && (
            <p className="text-muted-foreground mt-2">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {moreActions && moreActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="More actions"
                  className="inline-flex items-center justify-center rounded-md h-10 w-10 text-slate-400 hover:text-foreground hover:bg-muted transition-colors"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {moreActions.map((action) => (
                  <DropdownMenuItem key={action.label} onClick={action.onClick} destructive={action.destructive}>
                    {action.icon}
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <button
            onClick={onDeleteClick}
            aria-label={deleteAriaLabel}
            className="inline-flex items-center justify-center rounded-md h-10 w-10 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          {backHref && (
            <Link
              href={backHref}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-300 bg-transparent hover:bg-gray-100 h-10 px-4 py-2"
            >
              <svg
                className="h-4 w-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              {backLabel}
            </Link>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {statCards.map((card) => (
          <StatCard key={card.title} title={card.title} value={card.value} />
        ))}
      </div>

      {/* Optional linked-entity card */}
      {relationCard && (
        <div className="grid gap-4 sm:grid-cols-3">
          <RelationCard
            title={relationCard.title}
            linkHref={relationCard.linkHref}
            linkLabel={relationCard.linkLabel}
            description={relationCard.description}
          />
        </div>
      )}
    </>
  );
});
