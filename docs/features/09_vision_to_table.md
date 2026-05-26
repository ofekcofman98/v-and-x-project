# Vision-to-Table

**Priority:** Low (Future Innovation)  
**Dependencies:** GPT-4 Vision API, 14_PRODUCT_DATA_FLOW.md  
**Status:** Not Started

---

## Overview

Use GPT-4 Vision to extract table data from images of paper sheets, handwritten notes, or whiteboards.

**User Story:**
- Teacher takes a photo of a handwritten grade sheet
- Uploads image to VocalGrid
- GPT-4 Vision extracts table structure and data
- User reviews and corrects OCR errors
- Table created automatically with extracted data

**Impact:**
- Eliminates manual data entry from paper
- Supports handwritten content digitization
- Reduces time from 30 minutes to 2 minutes
- Enables mobile-first data capture

---

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS vision_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  image_url TEXT NOT NULL,
  image_size INTEGER NOT NULL,
  extracted_data JSONB NOT NULL,
  confidence_score REAL,
  
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  error_message TEXT,
  
  model TEXT DEFAULT 'gpt-4o',
  tokens_used INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT vision_imports_status_valid CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX idx_vision_imports_user ON vision_imports(user_id);
CREATE INDEX idx_vision_imports_status ON vision_imports(status);
CREATE INDEX idx_vision_imports_table ON vision_imports(table_id);

-- RLS Policy
ALTER TABLE vision_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own vision imports"
  ON vision_imports FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

---

## API Contract

**POST /api/vision/extract-table**

Request (multipart/form-data):
image: [Image file - JPG/PNG/HEIC]
enhance_ocr: true
language: "en"

Response:
```json
{
  "data": {
    "extraction_id": "vision-uuid",
    "status": "processing",
    "estimated_time_seconds": 15
  }
}
```

**GET /api/vision/:id**

Response:
```json
{
  "data": {
    "extraction_id": "vision-uuid",
    "status": "completed",
    "table_structure": {
      "columns": [
        { "id": "student_name", "label": "Student Name", "type": "text", "confidence": 0.95 },
        { "id": "score", "label": "Score", "type": "number", "confidence": 0.89 }
      ],
      "rows": [
        { "student_name": "Alice Johnson", "score": "92" },
        { "student_name": "Bob Smith", "score": "85" }
      ]
    },
    "confidence_score": 0.87,
    "warnings": ["Low confidence on row 3: handwriting unclear"],
    "raw_text": "Student Name | Score\nAlice Johnson | 92\nBob Smith | 85"
  }
}
```

**POST /api/vision/:id/confirm**

Request:
```json
{
  "table_name": "Scanned Grades",
  "corrections": {
    "rows": [
      {
        "index": 2,
        "column": "score",
        "corrected_value": "86"
      }
    ]
  }
}
```

Response:
```json
{
  "data": {
    "table_id": "table-uuid",
    "rows_imported": 30,
    "corrections_applied": 1
  }
}
```

**GPT-4 Vision Prompt Structure:**

```typescript
const systemPrompt = `You are a table extraction system. Analyze the image and extract structured table data.

Rules:
- Identify table headers and data rows
- Infer column types (text, number, date, boolean)
- Handle handwritten text
- Handle rotated or skewed images
- Return confidence scores per column and row
- Flag unclear or ambiguous cells

Output JSON format:
{
  "columns": [
    { "id": "string", "label": "string", "type": "text|number|date|boolean", "confidence": 0.0-1.0 }
  ],
  "rows": [
    { "column_id": "value", ... }
  ],
  "confidence_score": 0.0-1.0,
  "warnings": ["string"]
}`;

const visionRequest = {
  model: "gpt-4o",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: systemPrompt },
        { type: "image_url", image_url: { url: imageUrl } }
      ]
    }
  ],
  max_tokens: 2000
};
```

---

## Type Definitions

```typescript
interface VisionExtractionRequest {
  image: File;
  enhanceOCR?: boolean;
  language?: string;  // Default: 'en'
  detectRotation?: boolean;
}

interface VisionExtractionResult {
  extraction_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  table_structure?: {
    columns: Array<{
      id: string;
      label: string;
      type: string;
      confidence: number;
    }>;
    rows: Array<Record<string, string>>;
  };
  confidence_score?: number;
  warnings?: string[];
  raw_text?: string;  // For debugging
  error_message?: string;
}

interface VisionCorrection {
  rows?: Array<{
    index: number;
    column: string;
    corrected_value: string;
  }>;
  columns?: Array<{
    id: string;
    corrected_label?: string;
    corrected_type?: string;
  }>;
}

interface VisionImportHistory {
  id: string;
  user_id: string;
  image_url: string;
  image_size: number;
  extracted_data: VisionExtractionResult;
  confidence_score: number;
  table_id?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  model: string;
  tokens_used: number;
  created_at: string;
}
```

---

## Implementation Checklist

**GPT-4 Vision Integration:**
- [ ] Set up OpenAI Vision API client
- [ ] Design prompt for table extraction
- [ ] Include examples of well-formatted tables in prompt
- [ ] Handle image preprocessing (rotation, contrast adjustment)
- [ ] Implement retry logic for failed extractions (max 2 retries)
- [ ] Add timeout handling (30 seconds)

**Image Processing:**
- [ ] Upload image to Supabase Storage
- [ ] Compress/resize images (max 4MB for API)
- [ ] Support JPG, PNG, HEIC, WebP formats
- [ ] Detect and correct image rotation
- [ ] OCR enhancement with Tesseract.js (optional preprocessing)
- [ ] Handle low-quality images (show warning)

**API Routes:**
- [ ] POST `/api/vision/extract-table` - Upload and process image
- [ ] GET `/api/vision/:id` - Get extraction status/result
- [ ] POST `/api/vision/:id/confirm` - Confirm and create table
- [ ] DELETE `/api/vision/:id` - Cancel extraction
- [ ] GET `/api/vision/history` - List user's vision imports

**UI Components:**
- [ ] Image upload with camera capture (mobile)
- [ ] Image preview with zoom/rotate
- [ ] Extraction progress indicator
- [ ] Table preview with editable cells
- [ ] Confidence score visualization (colored cells)
- [ ] Row/cell correction interface
- [ ] Accept/Retry/Cancel actions
- [ ] Side-by-side view (image + extracted table)

**Validation:**
- [ ] Image format validation
- [ ] File size limits (10MB)
- [ ] Image quality check (resolution, clarity)
- [ ] Rate limiting (3 extractions/hour for free tier, 20/hour for pro)
- [ ] Minimum confidence threshold (0.6)

**Error Handling:**
- [ ] Low confidence warnings (< 0.7)
- [ ] Malformed table detection
- [ ] Handwriting clarity issues
- [ ] No table found in image
- [ ] Fallback to manual entry option

**Cost Management:**
- [ ] Track API usage per user
- [ ] Implement monthly usage quotas
- [ ] Cache similar images (perceptual hashing)
- [ ] Monitor token consumption
- [ ] Estimate cost before processing
- [ ] Show remaining quota in UI

**Quality Improvements:**
- [ ] Confidence-based highlighting (red < 0.6, yellow < 0.8, green >= 0.8)
- [ ] Suggest corrections based on common patterns
- [ ] Allow user to re-crop image before processing
- [ ] Support multiple images (batch processing)

**Testing:**
- [ ] Test with printed tables (high quality)
- [ ] Test with handwritten tables (low quality)
- [ ] Test with rotated images
- [ ] Test with poor lighting
- [ ] Test with non-English text
- [ ] Test with large tables (50+ rows)
- [ ] Performance test: process 100 images

**Future Enhancements:**
- [ ] Batch image processing (multiple pages)
- [ ] Video frame extraction (scan paper line-by-line)
- [ ] Multi-page document support (PDF to table)
- [ ] Handwriting training models (custom OCR)
- [ ] Live camera mode (real-time extraction)
- [ ] Support for complex tables (merged cells, nested headers)

---

**Estimated Effort:** 4 weeks  
**Dependencies:** OpenAI Vision API, Supabase Storage, Tesseract.js (optional)
