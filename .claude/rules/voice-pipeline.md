---
description: Voice pipeline architecture and hands-free readiness rules
globs: lib/client/hooks/use-voice-entry.ts, lib/client/hooks/use-vad.ts, lib/client/hooks/use-continuous-voice.ts, lib/client/hooks/**
---

# Voice Pipeline Rules

## Lifecycle Ownership

- All audio recording logic must be abstracted into `useVoiceEntry` (`lib/client/hooks/use-voice-entry.ts`).
- VAD (voice activity detection) logic lives in `useVad` (`lib/client/hooks/use-vad.ts`).
- Continuous listening mode is managed by `useContinuousVoice` (`lib/client/hooks/use-continuous-voice.ts`).
- None of this logic may live inline in a component.

## Hands-Free Support

- Design hooks to support both **hold-to-talk** and **continuous-listening** (VAD/silence detection) modes.
- The mode switch must be a configuration input to the hook — not a separate code path.

## Processing States

The UI must react to exactly these states (no others):

| State | Meaning |
|---|---|
| `idle` | No recording, no pending action |
| `listening` | Actively capturing audio |
| `processing` | Audio sent to Whisper/GPT, awaiting result |
| `confirming` | Result received, awaiting user confirmation |
| `error` | Something failed — show actionable feedback |

## Smart Pointer (Cell Advancement)

- The logic to advance the active cell (`advancePointer`) lives in `lib/client/navigation/` and must be decoupled from recording logic.
- `advancePointer` is triggered by a **successful data mutation** — never by the recording ending.
- The voice hook does not know about grid cells or pointer state.
