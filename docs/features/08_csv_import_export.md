# CSV/Excel Import & Export

**Priority:** High  
**Dependencies:** xlsx library, 14_PRODUCT_DATA_FLOW.md  
**Status:** Not Started

---

## Overview

Import tables from CSV/Excel files and export tables to standard formats using existing `xlsx` library.

**User Story:**
- User uploads a CSV file with student data
- System auto-detects column types
- User maps CSV columns to table columns
- Data imported and table created
- User exports table as Excel file with formatting
- User downloads CSV for external analysis

**Impact:**
- Enables legacy data migration
- Supports bulk data entry
- Facilitates data sharing with external tools
- Reduces manual data entry time by 90%

---

## Database Schema

**No schema changes required.** Uses existing `tables` and `table_data` structures.

**Optional: Import History Table**

```sql
CREATE TABLE IF NOT EXISTS import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  format TEXT NOT NULL,  -- csv, xlsx
  
  rows_imported INTEGER NOT NULL,
  columns_imported INTEGER NOT NULL,
  
  status TEXT DEFAULT 'completed',  -- pending, processing, completed, failed
  error_message TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_import_history_user ON import_history(user_id);
CREATE INDEX idx_import_history_table ON import_history(table_id);
```

---

## API Contract

**POST /api/import/csv**

Request (multipart/form-data):

file: [Excel file]
sheet_name: "Sheet1"
table_name: "Imported Inventory"
skip_rows: 0
Response:
```json
{
  "data": {
    "table_id": "table-uuid",
    "rows_imported": 250,
    "columns_created": 8,
    "import_id": "import-uuid"
  }
}
```

**GET /api/tables/:id/export**

Query Params:
format=xlsx
include_formulas=true
include_hidden_columns=false

Response:
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="table-name.xlsx"
[Binary Excel file]

**GET /api/tables/:id/export?format=csv**

Response:
Content-Type: text/csv
Content-Disposition: attachment; filename="table-name.csv"
Name,Score,Grade
Alice,92,A
Bob,85,B

---

## Type Definitions

```typescript
interface CSVImportConfig {
  file: File;
  tableName: string;
  hasHeaders: boolean;
  delimiter?: ',' | ';' | '\t' | '|';
  columnMapping?: Record<string, string>;  // CSV col -> Table col
  skipRows?: number;
}

interface ExcelImportConfig {
  file: File;
  sheetName?: string;
  tableName: string;
  skipRows?: number;
  range?: string;  // e.g., "A1:D100"
}

interface ExportConfig {
  format: 'csv' | 'xlsx' | 'json';
  includeFormulas?: boolean;
  includeHiddenColumns?: boolean;
  includeMetadata?: boolean;
  dateFormat?: string;
}

interface ImportResult {
  table_id: string;
  rows_imported: number;
  columns_created: number;
  import_id: string;
  errors?: Array<{
    row: number;
    column: string;
    error: string;
  }>;
  warnings?: string[];
}

interface ColumnTypeDetection {
  columnName: string;
  detectedType: 'text' | 'number' | 'date' | 'boolean';
  confidence: number;
  samples: any[];
}
```

---

## Implementation Checklist

**CSV Import:**
- [ ] Install/verify `papaparse` library
- [ ] Create file upload component with drag-and-drop
- [ ] Implement CSV parsing with delimiter detection
- [ ] Auto-detect column types (number, date, text, boolean)
- [ ] Build column mapping interface (CSV → Table)
- [ ] Validate data types before import
- [ ] Handle special characters and encoding (UTF-8, Latin-1)
- [ ] Batch insert rows (chunks of 100)
- [ ] Show import progress bar
- [ ] Handle errors gracefully (row-level errors)

**Excel Import:**
- [ ] Use existing `xlsx` library (SheetJS)
- [ ] Parse Excel file and extract sheet names
- [ ] Sheet selector UI
- [ ] Handle merged cells
- [ ] Import formulas (store as computed columns)
- [ ] Type detection based on cell format
- [ ] Support multiple sheets (future: import as multiple tables)
- [ ] Handle large files (streaming)

**CSV Export:**
- [ ] Use `papaparse` for CSV generation
- [ ] Apply user column preferences (hidden columns)
- [ ] Format dates properly (ISO 8601)
- [ ] Handle special characters (escape quotes, commas)
- [ ] Add BOM for Excel compatibility
- [ ] Stream large exports (>10k rows)

**Excel Export:**
- [ ] Use `xlsx` library for Excel generation
- [ ] Apply cell formatting (bold headers, number formats)
- [ ] Include formulas if applicable
- [ ] Auto-size columns
- [ ] Add filters to header row
- [ ] Support multiple sheets (future)
- [ ] Freeze header row

**JSON Export:**
- [ ] Export as array of objects
- [ ] Include metadata (table name, created date, etc.)
- [ ] Pretty-print JSON (optional)

**UI Components:**
- [ ] File upload dropzone (react-dropzone)
- [ ] Import wizard (3 steps: Upload, Map, Confirm)
- [ ] Column type selector
- [ ] Preview table (first 10 rows)
- [ ] Export format selector (CSV/Excel/JSON)
- [ ] Download button with progress indicator
- [ ] Error display for failed imports

**Validation:**
- [ ] File size limits (10MB for CSV, 50MB for Excel)
- [ ] Row count limits (10,000 rows for free tier, unlimited for pro)
- [ ] Column count limits (50 columns)
- [ ] Data type validation per column
- [ ] Required field validation

**Performance:**
- [ ] Stream large files (don't load entire file in memory)
- [ ] Use Web Workers for parsing (avoid blocking UI)
- [ ] Batch database inserts (use transactions)
- [ ] Show progress indicators for long operations
- [ ] Cancel import functionality

**Error Handling:**
- [ ] Row-level error tracking (skip invalid rows)
- [ ] Show import summary (X rows succeeded, Y failed)
- [ ] Download error report (CSV with error descriptions)
- [ ] Rollback on critical errors

**Testing:**
- [ ] Test CSV import with various delimiters
- [ ] Test Excel import with formulas
- [ ] Test large file imports (100k+ rows)
- [ ] Test type detection accuracy
- [ ] Test export with hidden columns
- [ ] Test export with computed columns
- [ ] Test encoding issues (special characters)

---

**Estimated Effort:** 3 weeks  
**Dependencies:** xlsx library, papaparse library
