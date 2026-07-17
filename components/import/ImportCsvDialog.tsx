'use client';

import { useRef, useState } from 'react';
import Papa from 'papaparse';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

interface ImportCsvDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function ImportCsvDialog({ isOpen, onClose, onImported }: ImportCsvDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [tableName, setTableName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const reset = () => {
    setFileName(null);
    setParsed(null);
    setTableName('');
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setFileName(file.name);
    if (!tableName) {
      setTableName(file.name.replace(/\.csv$/i, ''));
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        if (headers.length === 0 || results.data.length === 0) {
          setParseError('CSV file has no data rows or headers.');
          setParsed(null);
          return;
        }
        setParsed({ headers, rows: results.data });
      },
      error: (err) => {
        setParseError(err.message);
        setParsed(null);
      },
    });
  };

  const handleImport = async () => {
    if (!parsed || !tableName.trim()) return;

    setIsImporting(true);
    try {
      const response = await fetch('/api/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableName: tableName.trim(),
          headers: parsed.headers,
          rows: parsed.rows,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error?.[0] ?? `HTTP ${response.status}`);
      }

      toast({
        title: 'Import successful',
        description: `Imported ${data.data.rowsImported} rows into "${tableName}".`,
      });
      reset();
      onImported();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast({ title: 'Import failed', description: msg, variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isImporting) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to create a new table. Column types are detected automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="csv-file-input">
              CSV file
            </label>
            <Input
              id="csv-file-input"
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
            />
            {parseError && <p className="text-sm text-red-600">{parseError}</p>}
          </div>

          {parsed && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="import-table-name">
                  Table name
                </label>
                <Input
                  id="import-table-name"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="Table name"
                />
              </div>

              <div className="text-sm text-muted-foreground">
                Detected {parsed.headers.length} column{parsed.headers.length !== 1 ? 's' : ''},{' '}
                {parsed.rows.length} row{parsed.rows.length !== 1 ? 's' : ''} in {fileName}.
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      {parsed.headers.map((h) => (
                        <th key={h} className="px-2 py-1 text-left font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t">
                        {parsed.headers.map((h) => (
                          <td key={h} className="px-2 py-1 truncate max-w-[10rem]">
                            {row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isImporting}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!parsed || !tableName.trim() || isImporting}
          >
            {isImporting ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
