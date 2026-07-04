# VoiceButton Monolith Refactoring Log

**Goal:** Break down `components/voice/VoiceButton.tsx` (563 lines) into a clean, modular, and
performance-optimised structure using the Shell/Inner pattern and imperative store reads.

**Root Cause:** `VoiceButton` and its child hooks (`useVoiceActionHandler`, `useContinuousVoice`)
all subscribe to `useUIStore(s => s.activeCell)` via Zustand selectors. Every cell-selection
change triggers a full re-render + callback re-creation cascade through four layers of hooks,
even though the button's visual state is completely unaffected.

---

## Steps

| # | Description | Status | Files Touched |
|---|---|---|---|
| 1 | Extract `useVoiceErrorHandler` — deduplicate the two identical 60-line error-dispatch blocks | ✅ Done | `lib/client/hooks/use-voice-error-handler.ts` |
| 2 | Refactor `useVoiceActionHandler` — replace 3 store selectors with `getState()` calls | ✅ Done | `lib/client/hooks/use-voice-action-handler.ts` |
| 3 | Refactor `useContinuousVoice` — replace 2 store selectors with `getState()` calls | ✅ Done | `lib/client/hooks/use-continuous-voice.ts` |
| 4 | Create `useVoicePipeline` — orchestration hook absorbing all inline component logic | ✅ Done | `lib/client/hooks/use-voice-pipeline.ts` |
| 5 | Create `VoiceButtonInner` — memoized, purely declarative JSX renderer | ✅ Done | `components/voice/VoiceButtonInner.tsx` |
| 6 | Refactor `VoiceButton` into the Shell — thin wrapper deriving `hasActiveCell: boolean` | ✅ Done | `components/voice/VoiceButton.tsx` |

---

## Step 6 — Refactor `VoiceButton` into the Shell ✅ REFACTOR COMPLETE

**Date:** 2026-07-05

**Change:**
- Replaced the entire 406-line `VoiceButton.tsx` with a 35-line shell
- The shell has exactly one Zustand subscription: `s => s.activeCell !== null`
- Returns a boolean — Zustand only calls this subscriber when the value changes
  (null → true or true → null), which happens only when the user selects a cell
  for the first time or deselects all cells. Row-to-row navigation is invisible to it.
- Renders `<VoiceButtonInner tableId tableSchema hasActiveCell />` and nothing else
- Public API (`<VoiceButton tableId tableSchema />`) is unchanged — zero impact on call sites

**Final line count comparison:**

| File | Before | After |
|---|---|---|
| `VoiceButton.tsx` | 406 lines | 35 lines |
| `VoiceButtonInner.tsx` | — | 145 lines (new) |
| `use-voice-pipeline.ts` | — | 308 lines (new) |
| `use-voice-error-handler.ts` | — | 142 lines (new) |
| `use-voice-action-handler.ts` | 240 lines | 225 lines |
| `use-continuous-voice.ts` | 165 lines | 168 lines |

**Files modified:**
- `components/voice/VoiceButton.tsx`

---

## Step 5 — Create `VoiceButtonInner`

**Date:** 2026-07-05

**What it is:**
- A new `React.memo`-wrapped component at `components/voice/VoiceButtonInner.tsx`
- Receives exactly 3 props: `tableId: string`, `tableSchema: TableSchema`, `hasActiveCell: boolean`
- Calls `useVoicePipeline` and destructures its return values
- Contains zero business logic, zero store subscriptions, zero effects — only JSX
- JSX is taken verbatim from the old `VoiceButton` render block

**Re-render stability guarantee:**
- `tableId`: `string` primitive — stable
- `tableSchema`: stabilised by `useMemo` in `page.tsx`
- `hasActiveCell`: `boolean` — only changes on null ↔ non-null transition
- `React.memo` with default shallow equality means the component **never re-renders on
  row-to-row cell navigation**

**Files created:**
- `components/voice/VoiceButtonInner.tsx`

---

## Step 4 — Create `useVoicePipeline`

**Date:** 2026-07-05

**What moved out of VoiceButton into this hook:**
- All Zustand store subscriptions and action dispatchers
- `autoRestartTimerRef`, `stopContinuousRef`
- `resetToIdle` + `useVoiceErrorHandler` call
- `onEndOfTable` callback (now a stable `useCallback` with `[]` deps)
- `useVoiceActionHandler` call
- `processVoiceEntry` — now a proper `useCallback`, reads `activeCell` and
  `navigationMode` via `useUIStore.getState()` (no subscription)
- `handleAudioReady` — `useCallback`
- `handleVoiceError` — `useCallback`
- `useVoiceEntry` and `useContinuousVoice` hook calls
- `stopContinuousRef` sync effect
- Auto-restart effect (`recordingState === 'advancing'`)
- Escape key effect
- `handleToggle` — uses `hasActiveCell: boolean` prop for the guard instead of subscribing to `activeCell`
- All computed flags (`isListening`, `isProcessing`, etc.)
- `visualLevel` computation
- `tooltipText` derivation

**Reactive subscriptions inside this hook (only 2):**
- `recordingState` — drives all `isX` flags
- `continuousMode` — drives icon, Escape handler, `handleToggle`, tooltip

**Files created:**
- `lib/client/hooks/use-voice-pipeline.ts`

---

## Step 3 — Refactor `useContinuousVoice`

**Date:** 2026-07-05

**Problem:** Two reactive subscriptions caused `handleChunk` to be recreated on every
cell-selection change, which then caused `startContinuous` to receive a new `onSpeechEnd`
reference on every re-render — potentially interrupting the VAD audio pipeline mid-session:
- `activeCell` (line 32) — changes on every row/column click
- `navigationMode` (line 33) — changes on preference toggle

**Change:**
- Removed both subscriptions from the hook body
- `handleChunk` now calls `useUIStore.getState()` at the top of the async function to read
  `activeCell` and `navigationMode` fresh at call time
- `handleChunk` dep array shrinks from 7 items to 5 (removing `activeCell` and `navigationMode`)
- `vadSensitivity` subscription is intentionally kept — it must remain reactive because
  changes to VAD thresholds need to propagate to `useVAD` for pipeline reinitialization
- Removed `console.warn` (workspace rule)
- Fixed operator precedence bug: `!result.entity && !result.value` → `(!result.entity && !result.value)`

**Files modified:**
- `lib/client/hooks/use-continuous-voice.ts`

---

## Step 2 — Refactor `useVoiceActionHandler`

**Date:** 2026-07-05

**Problem:** Three Zustand selector subscriptions on volatile state caused `handleParsedResult`
to be recreated on every cell-selection change:
- `activeCell` (line 43) — changes on every row/column click
- `navigationMode` (line 44) — changes on preference toggle
- `continuousMode` (line 45) — changes on mode toggle

Because `handleParsedResult` had all three in its `useCallback` dep array, every cell click
cascaded into a new callback reference, which propagated into `useContinuousVoice.handleChunk`
and ultimately into the VAD loop.

**Change:**
- Removed the 3 reactive selectors from the hook body
- `handleParsedResult` now calls `useUIStore.getState()` at the top of the async function to
  read `activeCell` and `continuousMode` fresh at call time
- `calculateNextCell` now calls `useUIStore.getState()` inside the callback to read
  `navigationMode`, removing it from the `useCallback` dep array
- `handleParsedResult` dep array shrinks from 11 items to 9 (removing `activeCell` and `continuousMode`)
- `calculateNextCell` dep array shrinks from 4 items to 3 (removing `navigationMode`)
- Removed all `console.log` statements (workspace rule)

**Files modified:**
- `lib/client/hooks/use-voice-action-handler.ts`

**Date:** 2026-07-05

**Problem:** `handleAudioReady` (lines 122–221) and `handleVoiceError` (lines 226–305) inside
`VoiceButton` contain nearly identical error-dispatch logic: log the error, set recording state
to `'error'`, show a toast (variant depends on error type and recoverability), then reset to
`'idle'` after 2000 ms. This is a direct DRY violation.

**Change:**
- Created `lib/client/hooks/use-voice-error-handler.ts`
- The hook accepts `onResetToIdle: () => void` and exposes a single `dispatchError` function
- Reads `setRecordingState` and `setPendingConfirmation` from `useUIStore.getState()` — no
  new Zustand subscription introduced
- `VoiceButton` now calls `dispatchError` instead of the two duplicated blocks

**Files created:**
- `lib/client/hooks/use-voice-error-handler.ts`

**Files modified:**
- `components/voice/VoiceButton.tsx` — replaced duplicated error blocks with `dispatchError`
