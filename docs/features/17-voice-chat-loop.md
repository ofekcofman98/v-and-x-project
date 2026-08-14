# Voice Chat Loop (Input + Output) — Spec

**Feature:** 17 — Voice Chat Loop
**Priority:** Medium (POC)
**Dependencies:** `docs/05_VOICE_PIPELINE.md`, `docs/features/03_ai_table_agent.md`, `docs/features/15_realtime_voice_feedback.md`, `.claude/rules/architecture.md`, `.claude/rules/voice-pipeline.md`
**Status:** Spec — Not Started
**Last Updated:** 2026-08-14

---

## Table of Contents

1. [Problem](#1-problem)
2. [Goal](#2-goal)
3. [Constraints From The Existing System](#3-constraints-from-the-existing-system)
4. [Already Available (Reuse, Do Not Rebuild)](#4-already-available-reuse-do-not-rebuild)
5. [New Scope 1: Voice Input → Chat](#5-new-scope-1-voice-input--chat)
6. [New Scope 2: Voice Output](#6-new-scope-2-voice-output)
7. [Data Contract](#7-data-contract)
8. [Out of Scope](#8-out-of-scope)
9. [Acceptance Criteria](#9-acceptance-criteria)
10. [Implementation Order](#10-implementation-order)
11. [Notes for Reviewers](#11-notes-for-reviewers)

---

## 1. Problem

Grid Agent and Global Agent chats (`components/ai/GridChatPanel.tsx`,
`components/ai/GlobalChatPanel.tsx`) are text-only. VocalGrid already has a proven voice
INPUT pipeline (VAD → Whisper STT → hallucination filtering), but it only feeds structured
cell entry (`voice-entry-service`), never the agent chat panels. There is no voice OUTPUT
anywhere in the app.

## 2. Goal

Close the loop: let a user speak a question into `GridChatPanel` / `GlobalChatPanel`, and
hear the agent's answer spoken back. This is a conversational round-trip, not just
dictation.

---

## 3. Constraints From The Existing System

These correct two assumptions in the original ask and are load-bearing for the design below.

1. **`POST /api/transcribe` has no context priming today.** `app/api/transcribe/route.ts`
   calls `whisper-1` with `response_format: 'json'`, no `prompt`, no `temperature`, and no
   segment filtering — it is a bare passthrough, unlike
   `lib/server/services/voice-entry-service/transcription.ts:53-117`, which is the module
   that actually builds the vocabulary prompt (`buildWhisperPrompt` →
   `lib/server/stt/context-prompt.ts`) and is only reachable through
   `POST /api/voice-entry`. Entity-vocabulary priming is also the wrong tool here: chat
   questions are free-form prose ("who scored above 60?"), not `Entity, value` dictation, so
   biasing the decoder toward row labels would hurt more than it helps. **Decision: reuse
   `/api/transcribe` as its own endpoint for chat, unmodified in shape, but add
   `temperature: 0` and server-side hallucination filtering to it (§5).**

2. **The hallucination filter is a server-zone module and needs data `/api/transcribe`
   doesn't currently produce.** `lib/server/services/voice-entry-service/hallucination.ts`
   exports `isWhisperHallucination`/`isDegenerateRepetition`; per
   `.claude/rules/architecture.md` a client hook can never import from `lib/server/`, so
   filtering must happen inside the route, not in the browser. Its prompt-echo branch needs
   `audioDurationSec` (only present under `response_format: 'verbose_json'`) and
   `promptEntities` (only populated when a vocabulary prompt was sent). Since chat sends no
   vocabulary prompt (point 1), the prompt-echo branch is structurally inapplicable —
   **`/api/transcribe` calls the filter with no `opts`** (blacklist + repetition-loop checks
   only) and stays on `response_format: 'json'`.

3. **`useVAD` (`lib/client/hooks/voice/use-vad.ts`) is a continuous chunker, not a
   press-and-transcribe-once hook.** Its rAF loop can call `onSpeechEnd` multiple times per
   session (silence flush, `maxChunkMs`/`hardMaxChunkMs` overflow splitting). Chat input is
   a single click-to-start / click-or-silence-to-stop interaction — no new capture hook is
   needed, but the consuming code must handle multiple `onSpeechEnd` chunks by **appending**
   each transcribed chunk to the input field, and must call `stopVAD()` on mic-off instead of
   only relying on silence.

4. **`GridChatPanel.tsx` and `GlobalChatPanel.tsx` already duplicate the input/submit/render
   shape** (message list, `Textarea` + `Button` row, `SheetHeader`). Per the DRY rule
   (`.claude/rules/architecture.md`, "extract at second repetition"), the mic button and the
   speak-on-answer behavior must be one shared hook + one shared component consumed by both
   panels — not implemented twice.

5. **No audio playback exists anywhere in the codebase today**, and no TTS call exists
   either. The `openai` SDK is already an approved, installed dependency
   (`lib/server/services/voice-entry-service/openai-client.ts`), so `audio.speech.create` is
   available with no new library approval needed.

6. **Session-scoped, not globally-persisted, UI state has a precedent.**
   `docs/features/15_realtime_voice_feedback.md` §3.2 excludes transient voice state from
   `ui-store.ts`'s `partialize` allowlist so it doesn't leak into `localStorage`. The mute
   toggle here follows the same pattern.

---

## 4. Already Available (Reuse, Do Not Rebuild)

- `useVAD` hook (`lib/client/hooks/voice/use-vad.ts`) — audio capture, RMS-based
  silence/speech detection, trailing padding, overflow chunking.
- `POST /api/transcribe` (`app/api/transcribe/route.ts`) — Whisper call, rate-limited per
  `x-user-id`. Reused as-is for chat; hardened per §3.1–3.2, §5.
- `isWhisperHallucination` / `isDegenerateRepetition`
  (`lib/server/services/voice-entry-service/hallucination.ts`) — blacklist + repetition-loop
  guard, applied server-side inside the route (see §5).
- `GridChatPanel` / `GlobalChatPanel` — existing chat UI, message stores
  (`grid-chat-store.ts`, `global-chat-store.ts`), and agent-call mutations
  (`use-grid-agent.ts`, `use-global-agent.ts`).
- `openai` client singleton pattern (`voice-entry-service/openai-client.ts`) — mirrored for
  the new TTS service.

---

## 5. New Scope 1: Voice Input → Chat

- **`app/api/transcribe/route.ts`** — add `temperature: 0` to the Whisper call and run the
  transcript through `isWhisperHallucination(transcript)` /
  `isDegenerateRepetition(transcript)` (no `opts`, per §3.2) before responding. A filtered
  transcript returns `{ text: '' }` (200, not an error) — the caller treats empty text as
  "nothing to add."
- **`lib/client/hooks/voice/use-chat-voice-input.ts`** (new, client zone) — wraps `useVAD`
  with a longer `silenceDurationMs` (chat questions run longer than single dictated
  values). Exposes `{ isRecording, start, stop, onChunkTranscribed }`. On each
  `onSpeechEnd` blob, POSTs to `/api/transcribe` and appends the returned (non-empty) text
  to the caller-supplied input setter — never auto-sends. This hook only knows about audio
  → text; it has no opinion on chat submission, per `.claude/rules/voice-pipeline.md`'s
  lifecycle-ownership rule.
- **`components/ai/ChatMicButton.tsx`** (new) — thin presentational button (idle/recording
  states) driving `useChatVoiceInput`; takes `{ onTranscript: (text: string) => void }`.
  Mounted in both `GridChatPanel.tsx` and `GlobalChatPanel.tsx`'s input row, next to the
  existing `Textarea`.
- Transcribed text is appended to `input` (Grid) / `raw` (Global via `useMentionInput`'s
  existing `handleChange` path) — user reviews/edits before pressing Send, identical to
  typed text from that point on.

## 6. New Scope 2: Voice Output

- **`lib/server/services/tts-service/speak.ts`** (new, server zone) — calls
  `openai.audio.speech.create({ model: 'tts-1', voice: 'alloy', input: text })`, returns the
  raw audio buffer. Text is truncated to `MAX_SPEAK_CHARS` (500) at the last sentence
  boundary under the cap before the call — a pure helper
  (`lib/shared/utils/truncate-at-sentence.ts`) unit-tested the same way as
  `vad-chunking.ts`.
- **`app/api/speak/route.ts`** (new) — thin route: Zod-validates the body against
  `SpeakRequestSchema` (§7), delegates to `tts-service/speak.ts`, returns the audio as the
  response body (`Content-Type: audio/mpeg`) with an `X-TTS-Cached: false` header (no
  caching in this POC — see §7 for why the shape differs from the original ask).
- **`lib/client/hooks/voice/use-speak-response.ts`** (new, client zone) — call on the turn
  the agent's answer is appended to the message store: fetches `/api/speak`, builds an
  object URL from the response blob, plays it via `new Audio(url)`, revokes the URL on
  `ended`/unmount. Single-flight: starts by pausing/discarding any in-flight playback before
  starting new audio, so overlapping responses never play concurrently. On fetch failure or
  a non-2xx response: catch, no-op — text response is already rendered and unaffected.
- **Mute toggle** — `voiceOutputEnabled: boolean` (default `true`) added to
  `lib/client/stores/ui-store.ts`, excluded from `partialize` (§3.6) — resets to on each
  session, not persisted across reloads. Toggle control rendered in both panels'
  `SheetHeader`, next to the existing title.

---

## 7. Data Contract

```ts
// lib/shared/types/tts.ts
interface SpeakRequest {
  text: string; // truncated server-side to MAX_SPEAK_CHARS (500) at a sentence boundary
}
```

The original ask's `SpeakResponse` (`{ audioUrl: string; cached: boolean }`) is JSON, but
"returns audio stream/blob" is a binary body — the two are incompatible as one response.
This spec resolves it as: **the response body is the raw `audio/mpeg` stream itself**, with
`cached` surfaced as the `X-TTS-Cached` response header (`'true' | 'false'`) instead of a
JSON field. Rationale: nothing in this stack persists generated audio to storage (no bucket,
no CDN) to hand back a durable `audioUrl` — the client only ever needs one playable object
URL for one immediate playback, which `URL.createObjectURL(blob)` already gives it locally.
Caching itself (`X-TTS-Cached`) is out of scope for this POC and the header always reads
`false`; it's reserved so a future cache layer doesn't require a response-shape change.

`MAX_SPEAK_CHARS = 500` — a named constant in `lib/shared/utils/truncate-at-sentence.ts`,
per the no-magic-numbers rule (`.claude/rules/typescript.md`).

---

## 8. Out of Scope

- Barge-in / interrupting TTS playback mid-speech.
- Telephony integration (Twilio etc.).
- Streaming TTS (full response only, not token-by-token audio).
- Multi-language voice selection.

---

## 9. Acceptance Criteria

- [ ] User can click mic in Grid/Global chat, speak, see transcribed text in input.
- [ ] User can submit as normal (voice text behaves identically to typed text).
- [ ] Agent response auto-plays as audio within ~2s of text response completing.
- [ ] TTS failure does not break or delay the text response.
- [ ] Mute toggle works and persists for the session.

---

## 10. Implementation Order

Each step is independently shippable:

1. `/api/transcribe` hardening (§5, temperature + hallucination guard) — no client change,
   verify via existing hallucination test patterns (`hallucination.test.ts`).
2. `use-chat-voice-input.ts` + `ChatMicButton.tsx`, wired into both panels — voice input
   works end-to-end with no output half yet.
3. `truncate-at-sentence.ts` (+ unit test) → `tts-service/speak.ts` → `/api/speak` →
   `use-speak-response.ts` — voice output, independent of step 2.
4. `voiceOutputEnabled` toggle in `ui-store.ts` + `SheetHeader` control in both panels.

---

## 11. Notes for Reviewers

This is a scoped POC to demonstrate voice-loop architecture (STT→Agent→TTS), not a
production-grade voice UX. Barge-in and streaming are known next steps, intentionally
deferred.

---

*End of Voice Chat Loop Spec*
