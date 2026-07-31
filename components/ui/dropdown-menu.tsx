/**
 * DropdownMenu Component (shadcn/ui style)
 * "..." row/header actions menu — matches select.tsx's z-index/background/hover
 * conventions so both primitives look consistent across the app.
 */

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/shared/utils/cn';

/**
 * `DropdownMenuPrimitive.Root` is modal by default — it applies its own body
 * pointer-events lock/focus-scope, the same mechanism `Dialog` uses. Every
 * menu in this app exists only to trigger a follow-up action (usually opening
 * a Dialog), never to itself hold modal focus — so when an item opens a
 * Dialog while this menu is unmounting, the two ref-counted body locks race
 * and one can be left stuck (`pointer-events: none` never cleared on
 * <body>). Defaulting to non-modal removes this menu's lock entirely,
 * eliminating the conflict at the source rather than papering over its timing.
 */
const DropdownMenu = ({ modal = false, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) => (
  <DropdownMenuPrimitive.Root modal={modal} {...props} />
);
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'relative z-[200] min-w-[10rem] overflow-hidden rounded-md border border-slate-200 bg-white p-1 text-slate-900 shadow-md',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  Omit<React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>, 'onSelect'> & {
    destructive?: boolean;
    onClick?: (event: Event) => void;
  }
>(({ className, destructive, onClick, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    onSelect={(event) => {
      // A menu item that opens a Dialog/Popover races Radix's own dismiss/focus
      // cleanup for this menu, leaving `pointer-events: none` stuck on <body>
      // (a known Radix issue: https://github.com/radix-ui/primitives/issues/1912).
      // Deferring the action to the next tick lets this menu fully unmount first.
      event.preventDefault();
      if (onClick) setTimeout(() => onClick(event), 0);
    }}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
      'focus:bg-slate-100 focus:text-slate-900 hover:bg-slate-100',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      destructive && 'text-destructive focus:bg-destructive/10 hover:bg-destructive/10',
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
