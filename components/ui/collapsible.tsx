/**
 * Collapsible Component (shadcn/ui style)
 * Thin re-export of Radix Collapsible — used by the workspace sidebar's
 * "Unassigned Lists" bucket. docs/features/16_master_detail_workspace.md §3
 */

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';

const Collapsible = CollapsiblePrimitive.Root;
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
