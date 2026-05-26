# AI Table Creator Agent

**Priority:** Medium  
**Dependencies:** OpenAI API, 14_PRODUCT_DATA_FLOW.md  
**Status:** Not Started

---

## Overview

Natural language prompt-to-table creation using GPT-4 for schema inference and optional data generation.

**User Story:**
- User types: "Create a table for tracking student exam scores with name, ID, and grade columns"
- AI generates table schema with appropriate column types
- User reviews and edits schema before confirming
- Optional: AI can generate sample data for testing
- Table created with one click

**Impact:**
- Reduces table creation time from 5 minutes to 30 seconds
- Lowers barrier to entry for non-technical users
- Enables rapid prototyping and experimentation

---

## Database Schema

**No schema changes required.** Uses existing `tables` structure.

**Optional: Prompt History Table**

```sql
CREATE TABLE IF NOT EXISTS ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  prompt TEXT NOT NULL,
  response JSONB NOT NULL,  -- Generated schema
  accepted BOOLEAN DEFAULT FALSE,
  
  model TEXT DEFAULT 'gpt-4o-mini',
  tokens_used INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT ai_prompts_prompt_not_empty CHECK (length(trim(prompt)) > 0)
);

CREATE INDEX idx_ai_prompts_user_id ON ai_prompts(user_id);
CREATE INDEX idx_ai_prompts_created_at ON ai_prompts(created_at DESC);
```

---

## API Contract

**POST /api/ai/generate-table-schema**

Request:
```json
{
  "prompt": "Create a table for tracking student exam scores with name, ID, and grade columns",
  "generate_sample_data": false,
  "sample_row_count": 5,
  "base_list_id": null
}
```

Response:
```json
{
  "data": {
    "table_name": "Student Exam Scores",
    "description": "Track student performance on exams",
    "schema": {
      "columns": [
        { "id": "student_name", "label": "Student Name", "type": "text" },
        { "id": "student_id", "label": "Student ID", "type": "text" },
        { "id": "exam_grade", "label": "Exam Grade", "type": "number" }
      ]
    },
    "sample_data": [
      { "student_name": "Alice Johnson", "student_id": "001", "exam_grade": "92" },
      { "student_name": "Bob Smith", "student_id": "002", "exam_grade": "85" }
    ],
    "confidence": 0.95,
    "prompt_id": "prompt-uuid"
  }
}
```

**OpenAI Prompt Structure:**

```typescript
const systemPrompt = `You are a table schema generator. Given a user's natural language description, generate a valid table schema with appropriate column types.

Rules:
- Return ONLY valid JSON
- Include at least 1 column
- Column types: text, number, date, boolean
- Use snake_case for column IDs
- Use Title Case for column labels
- Infer appropriate data types from context
- If sample data requested, generate realistic examples

Output format:
{
  "table_name": "string",
  "description": "string",
  "schema": {
    "columns": [
      { "id": "string", "label": "string", "type": "text|number|date|boolean" }
    ]
  },
  "sample_data": [
    { "column_id": "value", ... }
  ]
}`;

const userPrompt = `Create a table schema for: ${prompt}`;
```

---

## Type Definitions

```typescript
interface AITableGenerationRequest {
  prompt: string;
  generate_sample_data?: boolean;
  sample_row_count?: number;
  base_list_id?: string;  // Optional: generate from existing BaseList
}

interface AITableGenerationResponse {
  table_name: string;
  description?: string;
  schema: {
    columns: Array<{
      id: string;
      label: string;
      type: 'text' | 'number' | 'date' | 'boolean';
      validation?: Record<string, any>;
    }>;
  };
  sample_data?: Array<Record<string, string>>;
  confidence: number;
  prompt_id: string;
}

interface AIPromptHistory {
  id: string;
  user_id: string;
  prompt: string;
  response: AITableGenerationResponse;
  accepted: boolean;
  model: string;
  tokens_used: number;
  created_at: string;
}

interface SchemaValidationError {
  field: string;
  message: string;
  suggestion?: string;
}
```

---

## Implementation Checklist

**AI Integration:**
- [ ] Set up OpenAI API client
- [ ] Create GPT-4 prompt template for schema generation
- [ ] Implement structured output parsing (JSON mode)
- [ ] Add validation layer for AI-generated schemas
- [ ] Implement retry logic for malformed responses (max 3 retries)
- [ ] Add fallback to GPT-4o-mini for cost optimization
- [ ] Handle API errors gracefully

**API Route:**
- [ ] POST `/api/ai/generate-table-schema`
- [ ] Validate prompt input (min 10 chars, max 500 chars)
- [ ] Rate limiting (5 requests/minute per user)
- [ ] Call OpenAI API with schema generation prompt
- [ ] Parse and validate JSON response
- [ ] Return sanitized schema
- [ ] Log prompt and response to database

**UI Components:**
- [ ] AI prompt input modal with example prompts
- [ ] "Generate with AI" button in table creator
- [ ] Schema preview/edit interface
- [ ] Sample data preview table
- [ ] Confidence score indicator
- [ ] Accept/Regenerate/Edit actions
- [ ] Loading spinner during generation
- [ ] Error handling UI

**Prompt Engineering:**
- [ ] Design system prompt for table schema inference
- [ ] Include 5-10 examples of well-formed schemas
- [ ] Handle edge cases (ambiguous prompts, invalid types)
- [ ] Add JSON schema validation
- [ ] Test with various prompt styles (formal, casual, technical)

**Validation:**
- [ ] Validate AI response matches expected schema
- [ ] Check for required fields (table_name, columns)
- [ ] Validate column types are allowed values
- [ ] Ensure column IDs are unique
- [ ] Check for SQL injection patterns in generated IDs

**Cost Management:**
- [ ] Track API usage per user
- [ ] Implement monthly usage quotas (free: 10, pro: 100, enterprise: unlimited)
- [ ] Cache similar prompts (fuzzy matching)
- [ ] Monitor token consumption
- [ ] Estimate cost before API call
- [ ] Show remaining quota in UI

**Testing:**
- [ ] Test with various prompt types (simple, complex, ambiguous)
- [ ] Test sample data generation
- [ ] Test error handling (API timeout, malformed response)
- [ ] Test rate limiting
- [ ] Load test: 100 concurrent requests
- [ ] Test with non-English prompts (future)

**Analytics:**
- [ ] Track prompt acceptance rate
- [ ] Track most common prompt patterns
- [ ] Monitor schema quality (user edits after generation)
- [ ] A/B test different system prompts

---

**Estimated Effort:** 3 weeks  
**Dependencies:** OpenAI API key, Usage tracking system