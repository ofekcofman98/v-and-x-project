# Unified Voice Entry API - Performance Optimization

## Overview
Consolidated the transcription and parsing steps into a single API endpoint to eliminate one network round-trip, significantly reducing total latency.

## Architecture Changes

### Before (Two API Calls)
```
Client → /api/transcribe → Server (Whisper)
  ↓ (network round-trip #1)
Client receives transcript
  ↓
Client → /api/parse → Server (GPT-4o-mini)
  ↓ (network round-trip #2)
Client receives parsed result
```

**Total Time**: Network #1 + Whisper + Network #2 + GPT-4o-mini

### After (Single API Call)
```
Client → /api/voice-entry → Server (Whisper + GPT-4o-mini)
  ↓ (single network round-trip)
Client receives transcript + parsed result
```

**Total Time**: Network + Whisper + GPT-4o-mini

**Savings**: One full network round-trip (typically 50-200ms+)

## Implementation

### New API Route: `/api/voice-entry`

**Location**: `app/api/voice-entry/route.ts`

**Input (FormData)**:
- `audio`: Audio file (Blob, max 25MB)
- `tableSchema`: JSON string of the table schema
- `activeCell`: JSON string of the active cell position
- `navigationMode`: String ('column-first' or 'row-first')

**Output (JSON)**:
```typescript
{
  success: boolean;
  data?: {
    // Transcript from Whisper
    transcript: string;
    
    // Parsed result from GPT-4o-mini
    entity: string | null;
    entityMatch: EntityMatch | null;
    value: unknown;
    valueValid: boolean;
    action: 'UPDATE_CELL' | 'ERROR' | 'AMBIGUOUS';
    error?: string;
    alternatives?: Array<{ entity: string; confidence: number }>;
    reasoning?: string;
    
    // Performance metrics
    transcriptionDuration: number;
    parsingDuration: number;
    totalDuration: number;
    duration: number; // same as totalDuration
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

### Updated Frontend: `components/voice/VoiceButton.tsx`

**Changes**:
1. Removed `transcribeAudio()` and `submitParse()` functions
2. Added unified `processVoiceEntry()` function
3. Updated `handleAudioReady()` to call the single endpoint
4. Updated metrics tracking to use 'voice-entry' phase

**Key Function**:
```typescript
const processVoiceEntry = async (audioBlob: Blob) => {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('tableSchema', JSON.stringify(tableSchema));
  formData.append('activeCell', JSON.stringify(activeCell));
  formData.append('navigationMode', navigationMode);

  const response = await fetch('/api/voice-entry', {
    method: 'POST',
    body: formData,
  });
  
  // Process response + local fuzzy matching
};
```

### Updated Monitoring: `lib/monitoring/voice-metrics.ts`

**Changes**:
- Added 'voice-entry' to phase types
- Added latency budget for 'voice-entry': 2500ms (2.5 seconds)

**Latency Budgets**:
```typescript
const LATENCY_BUDGETS = {
  transcribe: 2000,      // 2 seconds (deprecated, kept for legacy)
  parse: 1000,           // 1 second (deprecated, kept for legacy)
  'voice-entry': 2500,   // 2.5 seconds (combined operation)
  total: 3500,           // 3.5 seconds (including client processing)
};
```

## Performance Benefits

### Expected Latency Reduction

**Typical Network Round-Trip Times**:
- Local: 10-20ms
- Good WiFi: 30-50ms
- Mobile 4G: 50-100ms
- Poor connection: 100-300ms+

**Example Calculation** (Good WiFi):
- **Before**: 50ms (network #1) + 1500ms (Whisper) + 50ms (network #2) + 800ms (GPT) = **2400ms**
- **After**: 50ms (network) + 1500ms (Whisper) + 800ms (GPT) = **2350ms**
- **Savings**: 50ms (2% improvement)

**Example Calculation** (Mobile 4G):
- **Before**: 100ms (network #1) + 1500ms (Whisper) + 100ms (network #2) + 800ms (GPT) = **2500ms**
- **After**: 100ms (network) + 1500ms (Whisper) + 800ms (GPT) = **2400ms**
- **Savings**: 100ms (4% improvement)

**Example Calculation** (Poor Connection):
- **Before**: 200ms (network #1) + 1500ms (Whisper) + 200ms (network #2) + 800ms (GPT) = **2700ms**
- **After**: 200ms (network) + 1500ms (Whisper) + 800ms (GPT) = **2500ms**
- **Savings**: 200ms (7.4% improvement)

### Additional Benefits

1. **Reduced Server Load**: Fewer HTTP connections and request handling overhead
2. **Simpler Client Code**: Single function instead of two sequential calls
3. **Better Error Handling**: Unified error handling for the entire pipeline
4. **Atomic Operations**: Either both steps succeed or both fail (no partial state)
5. **Cost Savings**: Fewer server resources for HTTP handling

## Backward Compatibility

### Legacy Endpoints (Still Available)
- `/api/transcribe` - Whisper transcription only
- `/api/parse` - GPT-4o-mini parsing only

These endpoints are still available but **deprecated** for voice entry. They can be used for:
- Testing individual components
- Non-voice workflows that only need one step
- Debugging and development

### Migration Path
No migration needed for existing users. The old endpoints continue to work, but new implementations should use `/api/voice-entry`.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Client (VoiceButton.tsx)                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. User records audio                                      │
│     ↓                                                       │
│  2. processVoiceEntry(audioBlob)                           │
│     ↓                                                       │
│  3. FormData with audio + tableSchema + activeCell         │
│     ↓                                                       │
│  4. POST /api/voice-entry                                  │
│     ↓                                                       │
└─────┼───────────────────────────────────────────────────────┘
      │
      │ Network Round-Trip
      │
┌─────▼───────────────────────────────────────────────────────┐
│ Server (voice-entry/route.ts)                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  5. Receive audio + metadata                               │
│     ↓                                                       │
│  6. Validate + extract FormData                            │
│     ↓                                                       │
│  7. Call OpenAI Whisper API (transcription)                │
│     ↓                                                       │
│  8. Call OpenAI GPT-4o-mini API (parsing)                  │
│     ↓                                                       │
│  9. Return combined result                                  │
│     ↓                                                       │
└─────┼───────────────────────────────────────────────────────┘
      │
      │ Network Round-Trip
      │
┌─────▼───────────────────────────────────────────────────────┐
│ Client (VoiceButton.tsx)                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  10. Receive transcript + parsed result                     │
│      ↓                                                      │
│  11. Perform local fuzzy matching                          │
│      ↓                                                      │
│  12. Auto-confirm or show dialog                           │
│      ↓                                                      │
│  13. Update UI state                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling

### Error Codes
- `OPENAI_KEY_MISSING`: OpenAI API key not configured
- `RATE_LIMIT_EXCEEDED`: Too many requests (10 per minute per user)
- `NO_AUDIO_FILE`: No audio file in request
- `FILE_TOO_LARGE`: Audio file exceeds 25MB limit
- `MISSING_PARAMS`: Missing tableSchema or activeCell
- `INVALID_PARAMS`: Invalid JSON format for parameters
- `STT_RATE_LIMIT`: OpenAI Whisper rate limit hit
- `INVALID_AUDIO`: Audio format not supported
- `CELL_NOT_FOUND`: Active cell not in schema
- `VOICE_ENTRY_FAILED`: Generic failure (catch-all)

### Client-Side Handling
All errors are caught in `handleAudioReady()` and trigger:
1. Metrics tracking with error details
2. UI state reset to 'error'
3. Console logging for debugging
4. Automatic reset to 'idle' after 3 seconds

## Performance Monitoring

### Metrics Tracked
```typescript
// Server-side logging
{
  transcript: string;
  transcriptionDuration: number;  // Whisper time
  parsingDuration: number;        // GPT-4o-mini time
  totalDuration: number;          // Combined server time
  result: ParsedResult;
}

// Client-side metrics
{
  phase: 'voice-entry';
  duration: number;               // Total request time (includes network)
  success: boolean;
  error?: string;
}
```

### Console Output Example
```
[VoiceEntry] Starting transcription...
[VoiceEntry] Transcription complete: { transcript: "alice eighty five", duration: 1523 }
[VoiceEntry] Starting parsing...
[VoiceEntry] Complete: {
  transcript: "alice eighty five",
  transcriptionDuration: 1523,
  parsingDuration: 782,
  totalDuration: 2305
}
[Performance] voice-entry: {
  phase: "voice-entry",
  duration: 2350,
  budget: 2500,
  exceeded: false,
  success: true
}
Local fuzzy match: {
  original: "alice",
  matched: "Alice Smith",
  confidence: 0.992
}
High confidence match, auto-confirming
```

## Testing

### Manual Testing
1. Open `/demo/table`
2. Select a cell
3. Record: "alice eighty five"
4. Check console for timing logs
5. Verify auto-confirmation or dialog display

### Performance Comparison
To compare old vs new approach, temporarily switch between:
- **Old**: Use `/api/transcribe` then `/api/parse` (need to revert code)
- **New**: Use `/api/voice-entry` (current implementation)

Measure:
- Total duration from audio blob to final result
- Network time (request time - server processing time)
- Server processing time (transcriptionDuration + parsingDuration)

## Limitations

1. **No Streaming**: Results are returned only after both steps complete
   - Future: Could implement streaming for transcript first, then parsed result
2. **Single Endpoint**: Both steps must succeed or fail together
   - Future: Could add retry logic for individual steps
3. **Larger Payloads**: Sending tableSchema + activeCell with audio increases request size
   - Impact: Minimal (~1-2KB of JSON vs MB of audio)

## Future Optimizations

1. **Parallel Processing**: If possible, start parsing before full transcription completes
2. **Streaming Responses**: Stream transcript first, then parsed result
3. **Caching**: Cache tableSchema on server to reduce request payload
4. **Connection Pooling**: Reuse HTTP/2 connections for faster requests
5. **Edge Functions**: Deploy to edge locations for reduced latency

## Related Files

- `app/api/voice-entry/route.ts` - Unified API endpoint
- `components/voice/VoiceButton.tsx` - Updated client component
- `lib/monitoring/voice-metrics.ts` - Updated metrics types
- `LOCAL_FUZZY_MATCHING.md` - Local fuzzy matching documentation
- `TESTING_GUIDE.md` - Testing instructions
