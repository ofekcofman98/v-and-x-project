/**
 * Example Usage: Table Creator Page Route
 * 
 * This shows how to integrate table creation using dedicated page routes.
 */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useTableStore } from '@/lib/client/stores/table-store';
import { Plus } from 'lucide-react';

export function TablesPage() {
  const { tables, isLoading, fetchTables } = useTableStore();

  // Load tables on mount
  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Tables</h1>
        <Link href="/dashboard/tables/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Table
          </Button>
        </Link>
      </div>

      {/* Table List */}
      {isLoading ? (
        <p>Loading tables...</p>
      ) : (
        <div className="grid gap-4">
          {tables.map((table) => (
            <div key={table.id} className="border rounded-lg p-4">
              <h3 className="font-semibold">{table.name}</h3>
              <p className="text-sm text-gray-500">
                {table.description || 'No description'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Note: Table creation now happens at /dashboard/tables/new route */}
      {/* The DynamicTableCreator component is rendered on that dedicated page */}
    </div>
  );
}
