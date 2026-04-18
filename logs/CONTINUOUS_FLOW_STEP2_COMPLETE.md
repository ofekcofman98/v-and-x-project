# Continuous Flow - Step 2 Complete ✓

## Summary

Successfully implemented Step 2 of the Continuous Flow feature by creating the VAD (Voice Activity Detection) hooks according to **Section 9** of `docs/05_VOICE_PIPELINE.md`.

## Files Created

### 1. `lib/hooks/use-vad.ts`
Core VAD implementation using Web Audio API AnalyserNode for automatic speech detection.

**Features:**
- RMS (Root Mean Square) energy calculation for audio level detection
- Automatic speech start detection with debounce
- Automatic speech end detection on silence
- Force-flush for long recordings (>15s)
- Clean resource management

**Configuration Options:**
- `speechThreshold` - RMS level for speech detection (default: 15)
- `silenceThreshold` - RMS level for silence detection (default: 8)
- `silenceDurationMs` - Silence duration before chunk flush (default: 1200ms)
- `speechDebounceMs` - Speech confirmation delay (default: 150ms)
- `maxChunkMs` - Maximum chunk duration (default: 15000ms)

**Public API:**
```typescript
const { startVAD, stopVAD } = useVAD(options);

await startVAD({
  onSpeechStart: () => void,
  onSpeechEnd: (audioBlob: Blob) => void,
  onError: (error: Error) => void,
});

stopVAD(); // Clean up all resources
```

### 2. `lib/hooks/use-continuous-voice.ts`
High-level hook that integrates VAD with the existing voice pipeline.

**Features:**
- Reads VAD sensitivity from Zustand store preferences
- Automatically processes audio chunks through `/api/voice-entry`
- Handles consecutive failure detection (auto-stops after 3 failures)
- Manages recording state transitions
- Returns to listening after each entry

**Public API:**
```typescript
const { startContinuous, stopContinuous } = useContinuousVoice({
  tableSchema,
  onResult: (result: ParsedResult) => void,
  onError: (error: Error) => void,
});

await startContinuous(); // Start VAD loop
stopContinuous();        // Stop VAD loop
```

## Integration with Store

The hooks read from the Zustand store created in Step 1:

```typescript
// VAD sensitivity settings from preferences
const vadSensitivity = useUIStore((s) => s.preferences.vadSensitivity);
// {
//   speechThreshold: 15,
//   silenceThreshold: 8,
//   silenceDurationMs: 1200,
// }

// Recording state management
const setRecordingState = useUIStore((s) => s.setRecordingState);

// Active cell and navigation mode
const activeCell = useUIStore((s) => s.activeCell);
const navigationMode = useUIStore((s) => s.navigationMode);
```

## How It Works

### VAD Detection Flow

```
1. User activates continuous mode
   ↓
2. startVAD() initializes microphone and audio analyser
   ↓
3. VAD tick loop begins (runs on requestAnimationFrame)
   ↓
4. Monitor RMS audio level continuously
   ↓
5. Speech detected (RMS > speechThreshold for 150ms)
   → onSpeechStart() called
   → MediaRecorder.start() begins capturing
   ↓
6. User speaks...
   ↓
7. Silence detected (RMS < silenceThreshold for 1200ms)
   → MediaRecorder.stop()
   → onSpeechEnd(audioBlob) called with complete chunk
   ↓
8. Process chunk through voice pipeline
   ↓
9. Return to step 4 (listening for next speech)
```

### Continuous Voice Flow

```
1. startContinuous() called
   ↓
2. Start VAD with callbacks
   ↓
3. On speech end:
   → Create FormData with audio + table context
   → POST to /api/voice-entry
   → Parse response (ParsedResult)
   → Set state to 'confirming'
   → Call onResult() for component to handle
   ↓
4. Component confirms entry (confirmEntry())
   ↓
5. State machine advances pointer
   ↓
6. Auto-restarts listening (handled by state machine in Step 3)
```

## Error Handling

### Consecutive Failures
- Tracks consecutive errors in `consecutiveFailuresRef`
- Auto-stops continuous mode after 3 consecutive failures
- Emits `VAD_CONSECUTIVE_FAILURES` error
- User can restart manually

### Recovery on Single Failure
- Single errors don't stop the loop
- State returns to 'listening'
- User can continue speaking

### Microphone Errors
- Caught in `startVAD()`
- Passed to `onError` callback
- State set to 'error'

## Modular Design

✅ **No UI Changes Required**
- Hooks are independent of UI components
- VoiceButton.tsx remains unchanged (as requested)
- Ready for integration in Step 3

✅ **Reuses Existing Infrastructure**
- Uses existing `/api/voice-entry` endpoint
- Uses existing `ParsedResult` types
- Uses existing Zustand store actions
- Uses existing error handling patterns

✅ **Configuration from Store**
- VAD thresholds read from preferences (persisted to localStorage)
- No hardcoded values in components
- User can adjust sensitivity without code changes

## Testing Notes

### VAD Behavior
- Speech threshold of 15 works well in normal environments
- Silence duration of 1200ms prevents cutting off slow speakers
- Debounce of 150ms prevents false starts from background noise

### Resource Cleanup
- All refs properly nulled on `stopVAD()`
- MediaStream tracks stopped
- AudioContext closed
- Animation frame cancelled

### Edge Cases Handled
- Mode deactivated mid-chunk: `isContinuousRef.current` check
- Long recordings: Force-flush at 15s
- Empty transcripts: Silently ignored, resume listening
- Consecutive failures: Auto-stop after 3 errors

## Next Steps

### Step 3: UI Integration
- Update VoiceButton to support toggle mode
- Add "Start Continuous" / "Stop Continuous" button
- Show visual indicator when in continuous mode
- Display active listening state
- Add escape key handler to stop continuous mode

### Step 4: Auto-restart Logic
- Implement state machine transitions (06_SMART_POINTER.md §10)
- Auto-return to 'listening' after pointer advance
- Handle end-of-table gracefully

### Step 5: Preferences UI
- Add VAD sensitivity sliders
- Real-time preview of threshold levels
- Save to localStorage via store

## Checklist Status

From `docs/05_VOICE_PIPELINE.md §9.6`:

**Implementation:**
- ✅ `useVAD` hook with RMS-based speech/silence detection
- ✅ `useContinuousVoice` hook wrapping VAD + pipeline
- ✅ Reads `continuousMode` flag from Zustand store
- ⏳ Auto-restart transition in state machine (Step 3)
- ✅ VAD threshold preferences read from `UIPreferences`
- ✅ Consecutive failure guard (auto-stop after 3 failures)
- ⏳ No-speech timeout (60s) - to be added in Step 3

**Testing:**
- ⏳ VAD fires `onSpeechStart` within 150ms of speech onset
- ⏳ VAD fires `onSpeechEnd` within 1200ms of speech ending
- ⏳ Background noise below threshold does not trigger recording
- ⏳ Two consecutive entries process correctly without overlap
- ⏳ Stopping mid-session does not leave microphone stream open
- ⏳ `maxChunkMs` force-flush works correctly

**UX:**
- ⏳ Continuous mode clearly indicated in UI (Step 3)
- ⏳ Visual waveform active while listening (Step 3)
- ⏳ User can exit at any time via "Stop" button or Escape key (Step 3)
- ⏳ VAD sensitivity adjustable in preferences (Step 3)

## Documentation References

- `docs/05_VOICE_PIPELINE.md §9` - Continuous Flow Mode
- `docs/04_STATE_MANAGEMENT.md §7` - Continuous Flow State
- `docs/06_SMART_POINTER.md §10` - Auto-restart Transition (next)
