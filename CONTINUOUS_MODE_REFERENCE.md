# Continuous Mode - Developer Quick Reference

## State Access Patterns

### Read State (Selectors)

```typescript
import { useUIStore } from '@/lib/stores/ui-store';

// Is continuous mode enabled?
const continuousMode = useUIStore((s) => s.continuousMode);

// Get VAD sensitivity settings
const vadSensitivity = useUIStore((s) => s.preferences.vadSensitivity);

// Get individual VAD settings
const speechThreshold = useUIStore((s) => s.preferences.vadSensitivity.speechThreshold);
const silenceThreshold = useUIStore((s) => s.preferences.vadSensitivity.silenceThreshold);
const silenceDurationMs = useUIStore((s) => s.preferences.vadSensitivity.silenceDurationMs);

// Derived state: Is actively listening in continuous mode?
const isActivelyListening = useUIStore(
  (s) => s.continuousMode && s.recordingState === 'listening'
);

// All preferences
const preferences = useUIStore((s) => s.preferences);
```

### Update State (Actions)

```typescript
import { useUIStore } from '@/lib/stores/ui-store';

// Get action functions
const setContinuousMode = useUIStore((s) => s.setContinuousMode);
const updatePreferences = useUIStore((s) => s.updatePreferences);

// Toggle continuous mode
setContinuousMode(true);   // Start
setContinuousMode(false);  // Stop

// Update VAD sensitivity (partial update)
updatePreferences({
  vadSensitivity: {
    speechThreshold: 20,
    silenceThreshold: 10,
    silenceDurationMs: 1500,
  },
});

// Update other preferences
updatePreferences({
  theme: 'dark',
  fontSize: 'large',
});
```

## Default Values

### VAD Sensitivity Defaults
```typescript
{
  speechThreshold: 15,      // RMS level 0-255 for speech detection
  silenceThreshold: 8,      // RMS level 0-255 for silence detection
  silenceDurationMs: 1200   // Milliseconds of silence before flush
}
```

### All Preferences Defaults
```typescript
{
  theme: 'system',
  fontSize: 'medium',
  showConfidenceScores: true,
  autoAdvanceDelay: 2000,
  voiceFeedbackEnabled: false,
  vadSensitivity: {
    speechThreshold: 15,
    silenceThreshold: 8,
    silenceDurationMs: 1200,
  }
}
```

## Persistence Behavior

### What Persists (localStorage)
- ✅ `preferences.vadSensitivity` - VAD thresholds
- ✅ `preferences.theme` - UI theme
- ✅ `preferences.fontSize` - Font size
- ✅ `preferences.showConfidenceScores` - Show/hide scores
- ✅ `preferences.autoAdvanceDelay` - Delay in ms
- ✅ `preferences.voiceFeedbackEnabled` - Voice feedback
- ✅ `navigationMode` - Column-first or row-first

### What Does NOT Persist
- ❌ `continuousMode` - **Security: Never auto-activate microphone**
- ❌ `activeCell` - Transient selection state
- ❌ `recordingState` - Transient recording state
- ❌ `pendingConfirmation` - Transient confirmation state

## Type Definitions

```typescript
// VAD Sensitivity
export interface VADSensitivity {
  speechThreshold: number;    // 0-255
  silenceThreshold: number;   // 0-255
  silenceDurationMs: number;  // milliseconds
}

// User Preferences
export interface UIPreferences {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  showConfidenceScores: boolean;
  autoAdvanceDelay: number;
  voiceFeedbackEnabled: boolean;
  vadSensitivity: VADSensitivity;
}
```

## Component Integration Examples

### Toggle Button Component
```typescript
'use client';

import { useUIStore } from '@/lib/stores/ui-store';

export function ContinuousModeToggle() {
  const continuousMode = useUIStore((s) => s.continuousMode);
  const setContinuousMode = useUIStore((s) => s.setContinuousMode);
  
  return (
    <button
      onClick={() => setContinuousMode(!continuousMode)}
      className={continuousMode ? 'bg-green-500' : 'bg-gray-300'}
    >
      {continuousMode ? 'Stop Continuous' : 'Start Continuous'}
    </button>
  );
}
```

### VAD Sensitivity Slider
```typescript
'use client';

import { useUIStore } from '@/lib/stores/ui-store';

export function VADSensitivityControl() {
  const vadSensitivity = useUIStore((s) => s.preferences.vadSensitivity);
  const updatePreferences = useUIStore((s) => s.updatePreferences);
  
  return (
    <div>
      <label>
        Speech Threshold: {vadSensitivity.speechThreshold}
        <input
          type="range"
          min="0"
          max="255"
          value={vadSensitivity.speechThreshold}
          onChange={(e) =>
            updatePreferences({
              vadSensitivity: {
                ...vadSensitivity,
                speechThreshold: Number(e.target.value),
              },
            })
          }
        />
      </label>
    </div>
  );
}
```

### Read-Only Display
```typescript
'use client';

import { useUIStore } from '@/lib/stores/ui-store';

export function ContinuousModeStatus() {
  const isActivelyListening = useUIStore(
    (s) => s.continuousMode && s.recordingState === 'listening'
  );
  
  if (!isActivelyListening) return null;
  
  return (
    <div className="bg-green-100 p-2 rounded">
      🎤 Listening in continuous mode...
    </div>
  );
}
```

## DevTools

The store is integrated with Redux DevTools for debugging:

1. Install Redux DevTools browser extension
2. Open DevTools → Redux tab
3. Select "UIStore" from dropdown
4. Watch state changes in real-time

## Testing Helpers

### Check if continuous mode resets correctly
```typescript
import { useUIStore } from '@/lib/stores/ui-store';

const { setContinuousMode, resetUI, continuousMode } = useUIStore.getState();

// Set to true
setContinuousMode(true);
console.log(continuousMode); // true

// Reset should clear it
resetUI();
console.log(continuousMode); // false
```

### Verify persistence
```typescript
import { useUIStore } from '@/lib/stores/ui-store';

// Update VAD settings
const { updatePreferences } = useUIStore.getState();
updatePreferences({
  vadSensitivity: {
    speechThreshold: 25,
    silenceThreshold: 12,
    silenceDurationMs: 1500,
  },
});

// Reload page and check localStorage
localStorage.getItem('vocalgrid-ui-preferences');
// Should contain the updated vadSensitivity
```

## Common Patterns

### Hook for continuous mode state
```typescript
export function useContinuousMode() {
  const continuousMode = useUIStore((s) => s.continuousMode);
  const setContinuousMode = useUIStore((s) => s.setContinuousMode);
  const recordingState = useUIStore((s) => s.recordingState);
  
  const isActivelyListening = continuousMode && recordingState === 'listening';
  
  return {
    continuousMode,
    setContinuousMode,
    isActivelyListening,
  };
}
```

### Hook for VAD preferences
```typescript
export function useVADPreferences() {
  const vadSensitivity = useUIStore((s) => s.preferences.vadSensitivity);
  const updatePreferences = useUIStore((s) => s.updatePreferences);
  
  const updateVAD = (newSettings: Partial<VADSensitivity>) => {
    updatePreferences({
      vadSensitivity: { ...vadSensitivity, ...newSettings },
    });
  };
  
  return {
    vadSensitivity,
    updateVAD,
  };
}
```
