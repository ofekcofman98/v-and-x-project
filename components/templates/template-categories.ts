/**
 * Template category constants and helpers.
 * Shared by TemplateCard, TemplatesEmptyState, ApplyTemplateDialog, and the details page.
 */

export interface CategoryMeta {
  icon: string;
  pill: string;
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  education: { icon: '🎓', pill: 'bg-blue-50 text-blue-700' },
  hr:         { icon: '👔', pill: 'bg-purple-50 text-purple-700' },
  inventory:  { icon: '📦', pill: 'bg-amber-50 text-amber-700' },
  finance:    { icon: '💰', pill: 'bg-green-50 text-green-700' },
  healthcare: { icon: '🏥', pill: 'bg-red-50 text-red-700' },
  custom:     { icon: '⚙️',  pill: 'bg-gray-50 text-gray-700' },
};

export interface FilterTab {
  key: string;
  label: string;
}

export const FILTER_TABS: FilterTab[] = [
  { key: 'all',        label: 'All Templates' },
  { key: 'education',  label: '🎓 Education' },
  { key: 'hr',         label: '👔 HR' },
  { key: 'inventory',  label: '📦 Inventory' },
  { key: 'finance',    label: '💰 Finance' },
  { key: 'healthcare', label: '🏥 Healthcare' },
  { key: 'custom',     label: '⚙️ Custom' },
];

export function categoryIcon(category: string | null): string {
  return category ? (CATEGORY_META[category]?.icon ?? '📋') : '📋';
}

export function columnPillClass(category: string | null): string {
  return category
    ? (CATEGORY_META[category]?.pill ?? 'bg-muted text-muted-foreground')
    : 'bg-muted text-muted-foreground';
}
