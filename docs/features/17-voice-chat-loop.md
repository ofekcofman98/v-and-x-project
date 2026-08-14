# Voice Chat Loop (Input + Output) — Spec

**Feature:** 17 — Voice Chat Loop
**Priority:** Medium (POC)
**Dependencies:** `docs/05_VOICE_PIPELINE.md`, `docs/features/03_ai_table_agent.md`, `docs/features/15_realtime_voice_feedback.md`, `.claude/rules/architecture.md`, `.claude/rules/voice-pipeline.md`
**Status:** Implemented (revised after user testing)
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

3. **A press-to-record dictation button already exists, but it is the wrong shape for a
   hands-free chat conversation.** `components/ai/PromptDictationButton.tsx` +
   `lib/client/hooks/voice/use-voice-entry.ts` implement click-to-start /
   click-to-stop-only recording (no silence detection at all) with the transcript appended
   to the input for manual review-then-submit — correct for `SchemaAgentPromptBar.tsx`
   (dictating a long table description you want to edit before drafting), but user testing
   of the first cut of this feature confirmed it is the wrong interaction for a quick chat
   question: the mic never stopped on its own, and the user had to click Send by hand,
   breaking the "just talk" expectation. **Revised decision: `PromptDictationButton` is left
   untouched for the schema bar; the chat panels get a new, purpose-built
   `useChatVoiceLoop` (§5) that wraps `useVAD` — the same continuous-chunker hook
   `use-continuous-voice.ts` already uses for cell-fill — to auto-stop on silence and
   auto-submit.**

4. **`GridChatPanel.tsx` and `GlobalChatPanel.tsx` already duplicate the input/submit/render
   shape** (message list, `Textarea` + `Button` row, `SheetHeader`). Per the DRY rule
   (`.claude/rules/architecture.md`, "extract at second repetition"), the mic behavior must
   not be implemented twice — resolved by both panels consuming the same
   `useChatVoiceLoop` + `ChatMicButton` (§5), and the speak-on-answer hook (§6) is likewise
   one shared hook consumed by both panels.

5. **No audio playback exists anywhere in the codebase today**, and no TTS call exists
   either. The `openai` SDK is already an approved, installed dependency
   (`lib/server/services/voice-entry-service/openai-client.ts`), so `audio.speech.create` is
   available with no new library approval needed.

6. **Session-scoped, not globally-persisted, UI state has a precedent.**
   `docs/features/15_realtime_voice_feedback.md` §3.2 excludes transient voice state from
   `ui-store.ts`'s `partialize` allowlist so it doesn't leak into `localStorage`. The mute
   toggle here follows the same pattern.

7. **Barge-in being out of scope (§8) makes echo prevention free, not something that needs
   its own design.** With no requirement to let the user interrupt playback, the voice loop
   can be strictly half-duplex — the mic is fully torn down (`stopVAD()`) the instant a
   question is ready to submit, and only re-armed (fresh `startVAD()`) after the answer has
   finished playing. There is never a window where the mic is open while the agent's own
   TTS audio is playing, so it can never transcribe itself.

8. **The agent's answer text is not plain text — it's Markdown the chat prompt itself asks
   for.** `buildSystemPrompt` (`lib/server/services/ai-service/grid-agent-prompts.ts:94`)
   explicitly instructs "**Bold** every entity/row name" and to format multi-item answers as
   Markdown lists. `ReactMarkdown` renders that correctly in the chat bubble, but the first
   cut of this feature sent the raw string (e.g. `**Monica Geller**: 98 in Question 2`)
   straight to `tts-1`, which drops/garbles the bolded span — the entity name went missing
   from the spoken answer. **Revised decision: strip Markdown to plain text
   (`lib/shared/utils/strip-markdown.ts`, new) before truncation, inside
   `tts-service/speak.ts` (§6).**

---

## 4. Already Available (Reuse, Do Not Rebuild)

- `useVAD` (`lib/client/hooks/voice/use-vad.ts`) — silence/speech detection, overflow
  chunking, `volume` for UI feedback. Wrapped by `useChatVoiceLoop` (§5), exactly as
  `use-continuous-voice.ts` already wraps it for cell-fill — same shape, different endpoint
  and payload.
- `PromptDictationButton` / `useVoiceEntry` — left exactly as-is, still serving
  `SchemaAgentPromptBar.tsx` only (§3.3).
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

**Status: implemented (revised after user testing — see §3.3, §3.7).**

- **`app/api/transcribe/route.ts`** — `temperature: 0` + `isWhisperHallucination` /
  `isDegenerateRepetition` filtering (no `opts`, per §3.2) before responding. A filtered
  transcript returns `{ text: '' }` (200, not an error).
- **`lib/client/hooks/voice/use-chat-voice-loop.ts`** (new, client zone) — owns the whole
  turn state machine: `phase: 'idle' | 'listening' | 'transcribing' | 'answering' |
  'speaking'`. Wraps `useVAD` with `silenceDurationMs` raised to ~1100ms (a spoken question
  has longer natural pauses than a dictated cell value). On `onSpeechEnd`, POSTs the chunk
  to `/api/transcribe`; on a real silence flush (not a `maxChunkMs` overflow split — those
  accumulate instead, so a long question doesn't send as two halves) with non-empty text, it
  calls `stopVAD()` **before** calling the panel's `onSubmit(text)`, so the mic is fully
  closed while the agent answers and speaks (§3.7). Exposes `endTurn(speakPromise?)`, which
  the panel calls once its own mutation settles — `endTurn` awaits the panel's own
  `useSpeakResponse().speak(...)` promise (it does not call `speak` itself, so audio still
  plays for a typed question even when the voice loop isn't running) and then re-arms a
  fresh `startVAD()`, but only if the loop is still active.
- **`components/ai/ChatMicButton.tsx`** (new, presentational only — takes the loop object as
  a prop rather than owning the hook, since the panel needs `endTurn` from its own mutation
  callbacks). Mounted in both `GridChatPanel.tsx` and `GlobalChatPanel.tsx` in place of
  `PromptDictationButton`.
- Both panels' `handleSubmit` now takes an optional `overrideMessage` — the transcript is
  passed directly rather than read from `input`/`raw` state, since that state hasn't
  re-rendered yet when the voice turn fires. The turn mutation's `onSuccess` calls
  `voiceLoop.endTurn(voiceOutputEnabled ? speak(answerOrSummary) : undefined)`; `onError`
  (and, in Global Chat, the "no active `@BaseList` mention" early-bail) calls
  `voiceLoop.endTurn()` with nothing to speak — every exit path re-arms the mic, so a
  transcription or agent failure never silently ends the conversation.
- Voice text still lands visibly in the input before sending; it now sends itself the
  instant a real question is detected instead of waiting for a click.

## 6. New Scope 2: Voice Output

**Status: implemented.**

- **`lib/shared/utils/strip-markdown.ts`** (new) — strips bold/italic/code/heading markup
  and list markers to plain speakable text before truncation (§3.8 — fixes the "bolded
  entity name went missing from the spoken answer" defect). Unit-tested
  (`strip-markdown.test.ts`).
- **`lib/shared/utils/truncate-at-sentence.ts`** — pure helper, cuts text to
  `MAX_SPEAK_CHARS` (500) at the last sentence boundary under the cap, hard-cutting only
  when no boundary exists. Unit-tested (`truncate-at-sentence.test.ts`) the same way as
  `vad-chunking.ts`.
- **`lib/server/services/tts-service/speak.ts`** (server zone) — `synthesizeSpeech(text)`
  runs `stripMarkdown` then `truncateAtSentence` before calling
  `openai.audio.speech.create({ model: 'tts-1', voice: 'alloy', input })`, returns
  `{ audio: Buffer, contentType: 'audio/mpeg' }`.
- **`lib/shared/types/tts.ts`** — `SpeakRequestSchema` (Zod, §7).
- **`app/api/speak/route.ts`** — thin route: Zod-validates the body, delegates to
  `tts-service/speak.ts`, returns the audio as the response body
  (`Content-Type: audio/mpeg`, `X-TTS-Cached: false`) — see §7 for why the shape differs
  from the original ask's JSON `SpeakResponse`.
- **`lib/client/hooks/voice/use-speak-response.ts`** — `speak(text)` fetches `/api/speak`,
  builds an object URL from the response blob, plays it via `new Audio(url)`, revokes the
  URL on `ended`/unmount. Single-flight: `stop()` pauses/discards any in-flight playback
  before starting new audio. Both the fetch and the `audio.play()` promise are wrapped so a
  non-2xx response, a network failure, or an autoplay-policy rejection all silently no-op —
  the text response is already rendered and unaffected either way. **Revised:** `speak()`'s
  promise now resolves only once playback actually **ends** (or immediately, on any failure
  path), not as soon as `play()` is called — this is load-bearing for `useChatVoiceLoop`
  (§5), which awaits it before re-arming the mic; resolving at playback-start would have let
  the mic re-open mid-sentence and transcribe the agent's own voice.
- **`components/ai/VoiceOutputToggle.tsx`** (new, shared) — reads/writes
  `voiceOutputEnabled: boolean` (default `true`) on `lib/client/stores/ui-store.ts`,
  excluded from `partialize` (§3.6) so it resets to on each session rather than persisting
  across reloads. Mounted in both panels' `SheetHeader`, next to the existing title — one
  component, not duplicated, per §3.4.
- Both `GridChatPanel.tsx` and `GlobalChatPanel.tsx` call `speak(text)` right after
  `appendMessage` in their turn mutation's `onSuccess`, gated on `voiceOutputEnabled` — for
  both the plain-answer branch and the `pendingAction` summary branch, so a proposed write
  is announced the same way a read answer is.

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

- [x] User can click mic in Grid/Global chat, speak, see transcribed text in input.
- [x] The question sends itself once the user stops talking — no manual Send needed.
- [x] Agent response auto-plays as audio within ~2s of text response completing, including
      the full text (entity names bolded in the chat bubble are still spoken, not dropped).
- [x] TTS failure does not break or delay the text response.
- [x] Mute toggle works and re-arms the mic immediately (no wait for silent "playback").
- [x] After the agent finishes speaking, the mic re-arms automatically for a follow-up
      question, until the user presses the mic again to stop.
- [x] A voice question that can't be submitted (agent error, or — Global Chat only — no
      active `@BaseList` mention) still re-arms the mic rather than ending the conversation.

---

## 10. Implementation Order

1. `/api/transcribe` hardening (§5, temperature + hallucination guard). **Done.**
2. First cut: `PromptDictationButton` wired into both panels, append-only input.
   **Superseded** — replaced by step 5 below after user testing surfaced §3.3/§3.7's defects.
3. `truncate-at-sentence.ts` (+ unit test) → `tts-service/speak.ts` → `/api/speak` →
   `use-speak-response.ts` — voice output. **Done**, revised in step 5.
4. `voiceOutputEnabled` toggle in `ui-store.ts` + `VoiceOutputToggle.tsx`. **Done.**
5. **Fix pass** (§3.3, §3.7, §3.8): `strip-markdown.ts` (+ test) into `tts-service/speak.ts`;
   `use-speak-response.ts` resolves on playback-end; new `use-chat-voice-loop.ts` +
   `ChatMicButton.tsx` replacing `PromptDictationButton` in both chat panels; both panels'
   `handleSubmit` takes an override transcript and every mutation exit path calls
   `voiceLoop.endTurn(...)`. **Done.**

---

## 11. Notes for Reviewers

This is a scoped POC to demonstrate voice-loop architecture (STT→Agent→TTS), not a
production-grade voice UX. Barge-in and streaming are known next steps, intentionally
deferred.

---

*End of Voice Chat Loop Spec*
