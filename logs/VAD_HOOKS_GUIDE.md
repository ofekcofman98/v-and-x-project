# VAD Hooks - Developer Guide

## Overview

Two hooks work together to provide continuous voice input:

1. **`useVAD`** - Low-level voice activity detection
2. **`useContinuousVoice`** - High-level continuous flow with pipeline integration

## useVAD Hook

### Purpose
Detects when user starts and stops speaking using Web Audio API.

### Import
```typescript
import { useVAD } from '@/lib/hooks/use-vad';
import type { VADOptions, VADCallbacks } from '@/lib/hooks/use-vad';
```

### Basic Usage
```typescript
const { startVAD, stopVAD } = useVAD({
  speechThreshold: 15,      // Default: 15
  silenceThreshold: 8,      // Default: 8
  silenceDurationMs: 1200,  // Default: 1200
  speechDebounceMs: 150,    // Default: 150
  maxChunkMs: 15_000,       // Default: 15000
});

// Start listening
await startVAD({
  onSpeechStart: () => {
    console.log('User started speaking');
  },
  onSpeechEnd: (audioBlob: Blob) => {
    console.log('Speech ended, processing audio...');
    // Process the audio blob
  },
  onError: (error: Error) => {
    console.error('VAD error:', error);
  },
});

// Stop listening
stopVAD();
```

### Configuration Options

#### speechThreshold (number)
- **Default:** 15
- **Range:** 0-255
- **Description:** RMS level above which audio is considered speech
- **Tuning:**
  - Quiet office: 10
  - Normal environment: 15
  - Noisy environment: 25-30

#### silenceThreshold (number)
- **Default:** 8
- **Range:** 0-255
- **Description:** RMS level below which audio is considered silence
- **Must be:** Lower than speechThreshold

#### silenceDurationMs (number)
- **Default:** 1200
- **Description:** Milliseconds of silence before chunk is flushed
- **Tuning:**
  - Fast speakers: 800-1000
  - Normal pace: 1200
  - Slow speakers: 1500-2000

#### speechDebounceMs (number)
- **Default:** 150
- **Description:** Milliseconds of continuous speech before recording starts
- **Purpose:** Prevents false starts from brief noise spikes

#### maxChunkMs (number)
- **Default:** 15000
- **Description:** Maximum recording duration before force-flush
- **Purpose:** Prevents memory issues from very long recordings

### Lifecycle

```
┌─────────────────────────────────────────────────────┐
│ VAD Lifecycle                                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  startVAD()                                         │
│     ↓                                               │
│  Request microphone access                          │
│     ↓                                               │
│  Initialize AudioContext + AnalyserNode             │
│     ↓                                               │
│  Start tick loop (requestAnimationFrame)            │
│     ↓                                               │
│  ┌──────────────────────────────────┐              │
│  │  Monitoring (not speaking)       │              │
│  │  • Check RMS level each frame    │              │
│  │  • Wait for speech threshold     │ ◄────┐      │
│  └────────┬─────────────────────────┘      │      │
│           │ RMS > threshold for 150ms      │      │
│           ↓                                 │      │
│  ┌──────────────────────────────────┐      │      │
│  │  Recording (speaking)            │      │      │
│  │  • onSpeechStart() called        │      │      │
│  │  • MediaRecorder capturing       │      │      │
│  │  • Check RMS level each frame    │      │      │
│  │  • Wait for silence or max time  │      │      │
│  └────────┬─────────────────────────┘      │      │
│           │ RMS < threshold for 1200ms     │      │
│           │ OR 15s elapsed                 │      │
│           ↓                                 │      │
│  Flush chunk                                │      │
│     ↓                                       │      │
│  onSpeechEnd(audioBlob) called              │      │
│     ↓                                       │      │
│  Return to monitoring ─────────────────────┘      │
│                                                     │
│  stopVAD()                                          │
│     ↓                                               │
│  Cancel tick loop                                   │
│     ↓                                               │
│  Stop microphone stream                             │
│     ↓                                               │
│  Close AudioContext                                 │
│     ↓                                               │
│  Clean up all refs                                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## useContinuousVoice Hook

### Purpose
Integrates VAD with the voice pipeline for automatic continuous data entry.

### Import
```typescript
import { useContinuousVoice } from '@/lib/hooks/use-continuous-voice';
```

### Basic Usage
```typescript
const { startContinuous, stopContinuous } = useContinuousVoice({
  tableSchema: myTableSchema,
  onResult: (result: ParsedResult) => {
    console.log('Entry parsed:', result);
    // Handle confirmation UI
    setPendingConfirmation({
      entity: result.entity,
      value: result.value,
      confidence: result.entityMatch?.confidence || 0,
    });
  },
  onError: (error: Error) => {
    console.error('Continuous voice error:', error);
  },
});

// Start continuous mode
await startContinuous();

// Stop continuous mode
stopContinuous();
```

### Integration Points

#### 1. Reads from Zustand Store
```typescript
// VAD sensitivity (user preferences)
const vadSensitivity = useUIStore((s) => s.preferences.vadSensitivity);

// Recording state
const setRecordingState = useUIStore((s) => s.setRecordingState);

// Active cell context
const activeCell = useUIStore((s) => s.activeCell);
const navigationMode = useUIStore((s) => s.navigationMode);
```

#### 2. Uses Voice Pipeline API
```typescript
// POST to /api/voice-entry
const formData = new FormData();
formData.append('audio', audioBlob);
formData.append('tableSchema', JSON.stringify(tableSchema));
formData.append('activeCell', JSON.stringify(activeCell));
formData.append('navigationMode', navigationMode);

const response = await fetch('/api/voice-entry', {
  method: 'POST',
  body: formData,
});
```

#### 3. Recording State Transitions
```typescript
// States used by continuous voice:
'idle'       // Not recording
'listening'  // VAD active, waiting for speech
'processing' // Audio being transcribed/parsed
'confirming' // Waiting for user confirmation
```

### Error Handling

#### Consecutive Failures
```typescript
// Automatically stops after 3 consecutive errors
if (consecutiveFailuresRef.current >= 3) {
  stopContinuous();
  onError(new Error('VAD_CONSECUTIVE_FAILURES'));
}
```

#### Empty Transcripts
```typescript
// Silently ignores empty results and continues listening
if (!result.entity && !result.value) {
  setRecordingState('listening');
  return;
}
```

## Integration Example

### Component Usage
```typescript
'use client';

import { useState } from 'react';
import { useContinuousVoice } from '@/lib/hooks/use-continuous-voice';
import { useUIStore } from '@/lib/stores/ui-store';
import type { ParsedResult } from '@/lib/types/voice-pipeline';

export function ContinuousVoiceButton({ tableSchema }) {
  const continuousMode = useUIStore((s) => s.continuousMode);
  const setContinuousMode = useUIStore((s) => s.setContinuousMode);
  const setPendingConfirmation = useUIStore((s) => s.setPendingConfirmation);

  const { startContinuous, stopContinuous } = useContinuousVoice({
    tableSchema,
    onResult: (result: ParsedResult) => {
      setPendingConfirmation({
        entity: result.entity || '',
        value: result.value,
        confidence: result.entityMatch?.confidence || 0,
      });
    },
    onError: (error: Error) => {
      console.error('Continuous error:', error);
      setContinuousMode(false);
    },
  });

  const handleToggle = async () => {
    if (continuousMode) {
      stopContinuous();
      setContinuousMode(false);
    } else {
      await startContinuous();
      setContinuousMode(true);
    }
  };

  return (
    <button onClick={handleToggle}>
      {continuousMode ? 'Stop Continuous' : 'Start Continuous'}
    </button>
  );
}
```

## Tuning VAD Thresholds

### Testing in Different Environments

1. **Open browser console**
2. **Temporarily log RMS values:**
```typescript
const { startVAD, stopVAD } = useVAD({
  speechThreshold: 15,
  silenceThreshold: 8,
});

// Add logging in getRMS function (for testing only)
console.log('Current RMS:', rms);
```

3. **Observe values:**
   - Background noise RMS (silence)
   - Speech RMS (speaking)

4. **Adjust thresholds:**
   - Set `silenceThreshold` slightly above background noise
   - Set `speechThreshold` well above background noise
   - Ensure gap of at least 5-10 between thresholds

### Recommended Presets

```typescript
const ENVIRONMENTS = {
  quiet: {
    speechThreshold: 10,
    silenceThreshold: 5,
    silenceDurationMs: 1000,
  },
  normal: {
    speechThreshold: 15,
    silenceThreshold: 8,
    silenceDurationMs: 1200,
  },
  noisy: {
    speechThreshold: 25,
    silenceThreshold: 12,
    silenceDurationMs: 1500,
  },
};
```

## Resource Management

### Cleanup on Unmount
```typescript
useEffect(() => {
  return () => {
    stopContinuous();
  };
}, [stopContinuous]);
```

### Cleanup Checklist
Both hooks properly clean up:
- ✅ Cancel animation frame
- ✅ Stop MediaRecorder
- ✅ Stop MediaStream tracks
- ✅ Close AudioContext
- ✅ Null all refs

## Common Patterns

### Toggle Continuous Mode
```typescript
const toggleContinuous = async () => {
  if (continuousMode) {
    stopContinuous();
    setContinuousMode(false);
  } else {
    await startContinuous();
    setContinuousMode(true);
  }
};
```

### Exit on Escape Key
```typescript
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && continuousMode) {
      stopContinuous();
      setContinuousMode(false);
    }
  };
  
  window.addEventListener('keydown', handleEscape);
  return () => window.removeEventListener('keydown', handleEscape);
}, [continuousMode, stopContinuous, setContinuousMode]);
```

### Visual Feedback
```typescript
const recordingState = useUIStore((s) => s.recordingState);
const continuousMode = useUIStore((s) => s.continuousMode);

const isActivelyListening = continuousMode && recordingState === 'listening';

return (
  <div className={isActivelyListening ? 'border-green-500' : ''}>
    {isActivelyListening && '🎤 Listening...'}
  </div>
);
```
