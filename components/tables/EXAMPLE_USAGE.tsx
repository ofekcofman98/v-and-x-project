/**
 * Example Usage: Dynamic Table Creator
 * 
 * This shows how to integrate the DynamicTableCreator into your app.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DynamicTableCreator } from '@/components/tables/DynamicTableCreator';
import { useTableStore } from '@/lib/stores/table-store';
import { Plus } from 'lucide-react';

export function TablesPage() {
  const router = useRouter();
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const { tables, isLoading, fetchTables } = useTableStore();

  // Load tables on mount
  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Tables</h1>
        <Button onClick={() => setIsCreatingTable(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Table
        </Button>
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

      {/* Dynamic Table Creator */}
      <DynamicTableCreator
        open={isCreatingTable}
        onClose={() => setIsCreatingTable(false)}
        onSuccess={(tableId) => {
          setIsCreatingTable(false);
          fetchTables();
          router.push(`/dashboard/tables/${tableId}`);
        }}
      />
    </div>
  );
}
