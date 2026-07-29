/**
 * Dashboard root — Tables is the primary post-login surface.
 * Implements: docs/features/13_ux_ia_redesign.md ("Make Tables dashboard
 * the default post-login route"), superseding the old 3-card overview that
 * used to link to /dashboard/base-lists and /dashboard/templates (both
 * replaced by the Library page).
 */

import { redirect } from 'next/navigation';

export default function DashboardPage() {
  redirect('/dashboard/tables');
}
