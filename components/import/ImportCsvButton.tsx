'use client';

import { useRef, useState } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { ColumnDef, RowData } from '@/components/shared-table/types';
import { Upload } from 'lucide-react';

interface DetectedColumn {
  id: string;
  label: string;
  type: string;
}

export interface ParsedCsvImport {
  name: string;
  columns: ColumnDef[];
  rows: RowData[];
}

interface ImportCsvButtonProps {
  /** Called synchronously once the CSV is parsed and column types detected — no navigation involved. */
  onImported: (data: ParsedCsvImport) => void;
}

/**
 * Parses a CSV file client-side, asks the server to infer column types
 * (lib/server/parsers/column-type-detector.ts), then hands the resulting
 * columns/rows to the caller via `onImported` — the real SharedBuilderGrid
 * inside the DynamicListCreator dialog (opened by the caller) is the preview.
 */
export function ImportCsvButton({ onImported }: ImportCsvButtonProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    setIsProcessing(true);
    try {
      const { headers, rows } = await parseCsvFile(file);

      const response = await fetch('/api/import/csv/detect-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers, rows }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error?.[0] ?? `HTTP ${response.status}`);
      }

      const detectedColumns: DetectedColumn[] = data.data.columns;
      const columns: ColumnDef[] = detectedColumns.map((col) => ({
        id: col.id,
        name: col.label,
        type: col.type.toLowerCase() as ColumnDef['type'],
        metadata: { source: 'user_defined', locked: false },
      }));

      const gridRows: RowData[] = rows.map((row) => ({
        id: crypto.randomUUID(),
        values: row,
        metadata: { source: 'inline' },
      }));

      onImported({
        name: file.name.replace(/\.csv$/i, ''),
        columns,
        rows: gridRows,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast({ title: 'Import failed', description: msg, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="outline"
        disabled={isProcessing}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-4 h-4 mr-2" />
        {isProcessing ? 'Reading…' : 'Import CSV'}
      </Button>
    </>
  );
}

function parseCsvFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        if (headers.length === 0 || results.data.length === 0) {
          reject(new Error('CSV file has no data rows or headers.'));
          return;
        }
        resolve({ headers, rows: results.data });
      },
      error: (err) => reject(err),
    });
  });
}
