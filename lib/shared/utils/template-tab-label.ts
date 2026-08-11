/**
 * Derives the workspace template tab's display label from a Table name.
 * applyTemplateToBaseList (lib/server/services/base-list-service.ts) names
 * generated Tables `${baseList.name} - ${template.name}`; the tab bar wants
 * just the template portion. Falls back to the full name when the prefix
 * isn't present (e.g. the user has since renamed the Table).
 * Implements: docs/features/16_master_detail_workspace.md §4
 */
export function deriveTemplateTabLabel(tableName: string, baseListName: string): string {
  const prefix = `${baseListName} - `;
  return tableName.startsWith(prefix) ? tableName.slice(prefix.length) : tableName;
}
