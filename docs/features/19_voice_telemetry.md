# Voice Pipeline Telemetry — Spec

**Feature:** 19 — Latency + Accuracy Instrumentation
**Priority:** Medium
**Dependencies:** `docs/05_VOICE_PIPELINE.md`, `docs/10_PERFORMANCE.md`, `docs/03_DATABASE.md`, `.claude/rules/voice-pipeline.md`, `.claude/rules/database.md`
**Status:** Planned
**Last Updated:** 2026-08-22

---

## Table of Contents

1. [Problem](#1-problem)
2. [Goal](#2-goal)
3. [Constraints From The Existing System](#3-constraints-from-the-existing-system)
4. [Already Available (Reuse, Do Not Rebuild)](#4-already-available-reuse-do-not-rebuild)
5. [New Scope 1: Schema + Migration](#5-new-scope-1-schema--migration)
6. [New Scope 2: Server Capture + Ingest](#6-new-scope-2-server-capture--ingest)
7. [New Scope 3: Client Capture](#7-new-scope-3-client-capture)
8. [Data Contract](#8-data-contract)
9. [Out of Scope](#9-out-of-scope)
10. [Acceptance Criteria](#10-acceptance-criteria)
11. [Implementation Order](#11-implementation-order)
12. [Notes for Reviewers](#12-notes-for-reviewers)

---

## 1. Problem

VocalGrid measures a narrower span than "user speaks → row lands in the DB", and none of it survives a page reload.

- Server (`pipeline.ts`) starts its clock after the audio blob is already uploaded and parsed; it logs `transcriptionDuration` / `parsingDuration` / `totalDuration` to `console.log` via `logPerformanceStats` and nowhere else.
- Client (`use-voice-pipeline.ts`) starts its clock in `handleAudioReady`, i.e. after `MediaRecorder.onstop` — the recording itself is excluded — and stops when the parsed result arrives, i.e. before the cell is actually written.
- `trackVoiceMetrics` console-logs and optionally calls `window.gtag`, which is not wired into this app.

The two segments most likely to hide a regression — recording duration, and confirm→DB-write — are unmeasured entirely, and there is no durable record to compute a P50/P95 against or to correlate what the browser heard, what Whisper heard, and what finally got written.

## 2. Goal

Persist one row per voice interaction, keyed by a `request_id` threaded from mic-open to DB-write-ack, carrying every stage boundary as a timestamp, precomputed durations, and — behind a default-off flag — the transcripts/values needed to audit accuracy. Purely additive: existing console logging is untouched.

---

## 3. Constraints From The Existing System

1. **There is no existing `request_id`.** Nothing in `pipeline.ts` or elsewhere emits one today. **Decision: generate it client-side (`crypto.randomUUID()`) at capture start and thread it through the upload, the API response, and the cell-write mutation.**

2. **The confirm step does not write to the DB — and usually does not happen at all.** `confirmEntry` (`ui-store.ts`) only flips `recordingState` to `'committing'` then `'idle'`; it performs no mutation. On the high-confidence path, `use-voice-action-handler.ts` calls `updateCell(...)` immediately, before any confirm UI exists — so for most successful interactions `confirm_shown_at` / `confirm_received_at` are genuinely null, and `db_write_ack_at` precedes any user interaction. The confirm dialog appears only on the ambiguous / no-match / low-confidence branches. **Decision: add a `confirmation_route: 'auto' | 'confirmed' | 'batch' | 'abandoned'` column so null confirm timestamps are legible instead of ambiguous with an abandoned confirm.** This spec does not change the guardrail logic itself — only observes it.

3. **There is no TanStack mutation for cell writes.** Cell writes go through a Zustand store (`table-cell-store.ts`) with optimistic update + raw `fetch` (`PATCH /api/tables/:id/cells`, and a batch equivalent). **Decision: `updateCell` / `updateCellsBatch` accept an optional `requestId` so the store can mark the ack; when omitted (e.g. manual grid edits via `DataTableCell.tsx`) no telemetry row is affected.**

4. **Two symmetric upload sites, not one.** Push-to-talk (`use-voice-pipeline.ts`) and VAD/continuous (`use-continuous-voice.ts`) each build their own FormData inline via a raw `fetch` — there is no shared API wrapper. **Decision: every client-side capture point below is implemented in both hooks**; this is the primary source of "works in one mode only" bugs for this feature.

5. **The Web Speech API is already wired in, display-only.** `use-speech-shadow.ts` exposes an interim transcript (`SpeechRecognition.onresult`) purely as a provisional UI hint; it is never uploaded or persisted today. **Decision: reuse it as-is for `web_stt_transcript`, read from `useUIStore(s => s.provisionalFeedback.interimTranscript)` at flush time — no change to the shadow hook itself.**

6. **`matchAsync` returns no timing and no cache-hit flag.** The tier is only implicit in `matchType`; a cache hit is visible only as a console log. **Decision: time matching at its call sites in `pipeline.ts`, not inside the matcher** — changing the matcher is out of scope.

7. **The existing feature-flag idiom defaults ON** (`transcription.ts`: `process.env.ENABLE_X !== 'false'`). **Decision: the accuracy flag here inverts it and defaults OFF** (`=== 'true'`), since these fields carry raw transcript content and should be opt-in.

8. **Whisper call boundaries already exist.** `transcribeAudio` receives `startTime` from its caller and already returns `transcriptionDuration` — no new instrumentation needed inside `transcription.ts` itself, only around its call site.

---

## 4. Already Available (Reuse, Do Not Rebuild)

- `transcribeAudio`'s existing `transcriptionDuration` return value (`transcription.ts`) — do not re-time Whisper independently; wrap its call site instead.
- `matchAsync`'s `MatchResult.matchType` (`lib/shared/matching/types.ts`) — the source of `matching_tier_used`; values are `exact | phonetic | fuzzy | semantic | none` (there is no `vector` value — the level-4 vector matcher reports `'semantic'`).
- `use-speech-shadow.ts`'s interim transcript state — the source of `web_stt_transcript`.
- The Prisma singleton (`lib/prisma.ts`) and the existing migration convention (`prisma/migrations/<timestamp>_<snake_case_name>/migration.sql`, generated via `prisma migrate dev`) — this is the repo's only DB-write path; see Constraint 3 in §3 of `docs/03_DATABASE.md` equivalents (`.claude/rules/database.md`: "All Supabase and Prisma calls must live exclusively in `lib/server/services/`").
- The `ENABLE_<FEATURE>` flag idiom (`transcription.ts`) — reused with an inverted default (§3.7).
- `getAuthenticatedUser()` (`lib/server/services/auth.ts`) — reused to authenticate the new ingest route rather than building new auth plumbing.

---

## 5. New Scope 1: Schema + Migration

**Status: planned.**

New Prisma model `VoiceInteraction`, mapped to `voice_interactions`, following the repo's existing conventions exactly (`@db.Uuid` ids, `@@map` / `@map` snake_case throughout, matching every other model in `prisma/schema.prisma`).

Columns — see §8 for the full Prisma block. Summary:

- `id`, `request_id` (unique), `created_at`.
- 12 nullable stage timestamps (`timestamptz`): `vad_start_at`, `recording_stop_at`, `upload_complete_at`, `transcription_start_at`, `transcription_end_at`, `llm_parse_start_at`, `llm_parse_end_at`, `matching_start_at`, `matching_end_at`, `confirm_shown_at`, `confirm_received_at`, `db_write_ack_at`.
- 6 precomputed integer-ms durations, derived and stored at write time (not left to be recomputed from timestamp diffs later): `recording_duration_ms`, `transcription_duration_ms`, `llm_parse_duration_ms`, `matching_duration_ms`, `confirm_wait_duration_ms`, `total_duration_ms` (`vad_start_at` → `db_write_ack_at`).
- `confirmation_route` (nullable text) — beyond the originally specified columns; see Constraint 2.
- 4 nullable accuracy/trace columns, feature-flagged off by default: `web_stt_transcript`, `whisper_transcript`, `matched_entity_value`, `matching_tier_used`.
- Indexes on `request_id` and `created_at`.

Generated via `npx prisma migrate dev --name add_voice_interactions` (Migrate uses `DIRECT_URL` per `prisma.config.ts`), producing `prisma/migrations/<timestamp>_add_voice_interactions/migration.sql`. No hand-written standalone `.sql` file — this is the only migration convention in the repo. If the database enforces RLS the way `20260718125500_enable_rls_policies` does for domain tables, add a matching policy in the same migration (this table has no direct client access, so a service-role-only or deny-all policy is the likely shape — confirm before writing it).

## 6. New Scope 2: Server Capture + Ingest

**Status: planned.**

- `lib/shared/types/voice-pipeline.ts` — add `requestId?: string` to `VoiceEntryPayload`; add `telemetry?: ServerTelemetrySpans` to `VoiceEntryResult` and `VoiceBatchResult`.
- `app/api/voice-entry/route.ts` — read `request_id` as a FormData field (not a header, so the `OPTIONS` CORS allow-list needs no change); pass through to the payload.
- `pipeline.ts` — record wall-clock start/end around: the `transcribeAudio` call, the LLM parse call (both the mid-row and the full-fallback branches), and the `matchAsync` calls (fast-path and LLM-fallback sites). Attach the resulting `telemetry` object to every returned result. Fast paths that skip matching entirely (mid-row, bare-value) legitimately leave matching spans null — this is not a bug to fix. `whisper_transcript` and `matched_entity_value` are populated only when the accuracy flag is on.
- **`performance-logging.ts` is not touched.** All existing `console.log`/`console.warn` calls stay exactly as they are — this is additive, not a replacement (per the accepted task's explicit requirement).
- New `lib/server/services/telemetry/voice-interaction-service.ts` — `recordVoiceInteraction(metrics)`: computes the 6 derived durations from whichever timestamps are present (missing spans → null, never a negative duration), then a single `prisma.voiceInteraction.create` (or `upsert` on `requestId` if a partial-then-final flush race is possible — see §12). **Never throws**; catches internally and `console.warn`s on failure.
- New `app/api/voice-telemetry/route.ts` — `POST`, Zod-validated body, `runtime = 'nodejs'`, standard `{ success, data }` / `{ success, error }` envelope. Authenticated via `getAuthenticatedUser()` so this is not an open write endpoint.
- New `lib/server/services/telemetry/config.ts` — `export const VOICE_ACCURACY_TELEMETRY_ENABLED = process.env.ENABLE_VOICE_ACCURACY_TELEMETRY === 'true';` (default off). Gates only the 4 accuracy/trace columns; latency capture is unconditional.

## 7. New Scope 3: Client Capture

**Status: planned.**

New `lib/client/hooks/voice/use-voice-telemetry.ts` (or an equivalent module-level collector — the `requestId` must survive across hooks that don't share a React tree position): a `Map<requestId, Partial<VoiceInteractionMetrics>>` with `begin`, `mark`, `merge` (for server-returned spans), and `flush`. `flush` fires a **fire-and-forget** `fetch('/api/voice-telemetry', …)` — not awaited by any user-facing code path, failure caught and warned, never thrown — so it can never delay the confirmation flow.

Capture points, in pipeline order, implemented symmetrically in both the push-to-talk hook (`use-voice-pipeline.ts` / `use-voice-entry.ts`) and the VAD hook (`use-continuous-voice.ts` / `use-vad.ts`) per Constraint 4:

| Field | Client capture point |
|---|---|
| `requestId` generation, `vad_start_at` | VAD: `use-vad.ts` `onSpeechStart` (after debounce). Push-to-talk: `use-voice-entry.ts` `mediaRecorder.start()`. |
| `recording_stop_at` | VAD: `use-vad.ts` chunk-emit (Blob built). Push-to-talk: `use-voice-entry.ts` `mediaRecorder.onstop`. |
| `upload_complete_at` | After the `fetch` to `/api/voice-entry` resolves, in both upload sites. This marks response-received, not upload-bytes-flushed — the browser cannot observe true upload completion without an XHR progress shim, and this spec does not add one. |
| Server spans (`transcription_*`, `llm_parse_*`, `matching_*`, `matching_tier_used`, `whisper_transcript`) | Merged from `data.telemetry` in the same response used for `upload_complete_at`. |
| `web_stt_transcript` | Read from `useUIStore(s => s.provisionalFeedback.interimTranscript)` at flush time. |
| `confirm_shown_at` | The `setPendingConfirmation` call sites in `use-voice-action-handler.ts` and `use-voice-batch-handler.ts`. |
| `confirm_received_at` | `confirmEntry` (`ui-store.ts`) and `confirmBatch` (`use-voice-batch-handler.ts`). |
| `db_write_ack_at`, flush | After `response.ok` in `table-cell-store.ts`'s `updateCell` / `updateCellsBatch`, before optimistic state settles. This is also where `confirmation_route` is finalized: `'auto'` (direct write, no confirm shown), `'confirmed'` (single-entry confirm), `'batch'` (batch confirm). |
| Flush on abandon | `cancelEntry` (`ui-store.ts`) and the client-side error catches in both upload hooks → `confirmation_route: 'abandoned'`, `db_write_ack_at` left null. |

`requestId` threading: generated at capture start, sent as a FormData field on the `/api/voice-entry` upload (both sites), returned unchanged in the response, then passed as an optional argument into `updateCell` / `updateCellsBatch` so the write-ack can be correlated. Manual grid edits continue to call these functions without a `requestId` and are unaffected — no telemetry row is produced for them.

---

## 8. Data Contract

```prisma
// prisma/schema.prisma
model VoiceInteraction {
  id                       String    @id @default(uuid()) @db.Uuid
  requestId                String    @unique @map("request_id")
  createdAt                DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  vadStartAt               DateTime? @map("vad_start_at")           @db.Timestamptz(6)
  recordingStopAt          DateTime? @map("recording_stop_at")      @db.Timestamptz(6)
  uploadCompleteAt         DateTime? @map("upload_complete_at")     @db.Timestamptz(6)
  transcriptionStartAt     DateTime? @map("transcription_start_at") @db.Timestamptz(6)
  transcriptionEndAt       DateTime? @map("transcription_end_at")   @db.Timestamptz(6)
  llmParseStartAt          DateTime? @map("llm_parse_start_at")     @db.Timestamptz(6)
  llmParseEndAt            DateTime? @map("llm_parse_end_at")       @db.Timestamptz(6)
  matchingStartAt          DateTime? @map("matching_start_at")      @db.Timestamptz(6)
  matchingEndAt            DateTime? @map("matching_end_at")        @db.Timestamptz(6)
  confirmShownAt            DateTime? @map("confirm_shown_at")      @db.Timestamptz(6)
  confirmReceivedAt         DateTime? @map("confirm_received_at")   @db.Timestamptz(6)
  dbWriteAckAt              DateTime? @map("db_write_ack_at")       @db.Timestamptz(6)

  recordingDurationMs       Int?      @map("recording_duration_ms")
  transcriptionDurationMs   Int?      @map("transcription_duration_ms")
  llmParseDurationMs        Int?      @map("llm_parse_duration_ms")
  matchingDurationMs        Int?      @map("matching_duration_ms")
  confirmWaitDurationMs     Int?      @map("confirm_wait_duration_ms")
  totalDurationMs           Int?      @map("total_duration_ms")

  confirmationRoute         String?   @map("confirmation_route")
  webSttTranscript          String?   @map("web_stt_transcript")
  whisperTranscript         String?   @map("whisper_transcript")
  matchedEntityValue        String?   @map("matched_entity_value")
  matchingTierUsed          String?   @map("matching_tier_used")

  @@index([requestId])
  @@index([createdAt])
  @@map("voice_interactions")
}
```

```ts
// lib/shared/types/voice-telemetry.ts
export type MatchingTier = 'exact' | 'phonetic' | 'fuzzy' | 'semantic' | 'none';
export type ConfirmationRoute = 'auto' | 'confirmed' | 'batch' | 'abandoned';

export interface VoiceInteractionMetrics {
  requestId: string; // only required field — built incrementally
  vadStartAt?: string;
  recordingStopAt?: string;
  uploadCompleteAt?: string;
  transcriptionStartAt?: string;
  transcriptionEndAt?: string;
  llmParseStartAt?: string;
  llmParseEndAt?: string;
  matchingStartAt?: string;
  matchingEndAt?: string;
  confirmShownAt?: string;
  confirmReceivedAt?: string;
  dbWriteAckAt?: string;
  confirmationRoute?: ConfirmationRoute;
  webSttTranscript?: string;
  whisperTranscript?: string;
  matchedEntityValue?: string;
  matchingTierUsed?: MatchingTier;
}

// Subset returned to the client on the /api/voice-entry response
export interface ServerTelemetrySpans {
  transcriptionStartAt?: string;
  transcriptionEndAt?: string;
  llmParseStartAt?: string;
  llmParseEndAt?: string;
  matchingStartAt?: string;
  matchingEndAt?: string;
  matchingTierUsed?: MatchingTier;
  whisperTranscript?: string;
  matchedEntityValue?: string;
}
```

---

## 9. Out of Scope

- No dashboard, no analytics service integration, no Google Analytics/`gtag` wiring.
- No changes to the confirm-before-write guardrail logic itself — only timestamp capture around it.
- No changes to matching tier logic — only capture of which tier was used.
- No refactor or removal of `performance-logging.ts` or any existing `console.log`/`trackVoiceMetrics` call.
- Repairing the pre-existing drift in `docs/10_PERFORMANCE.md` (§4.5/§6.3 reference `lib/cache/`, `lib/matching/matcher.ts`, `match()`, `matchOptimized`, a `MatchingMetrics` class — none of which exist at those paths; actual code lives at `lib/server/cache/`, `lib/server/matching/`, `matchAsync`. §8.1–8.4 describe `gtag`/RUM/`BudgetTracker` that are not implemented) — flagged for a separate decision, not fixed silently as part of this feature.
- True upload-bytes-complete timing (would require an XHR progress shim) — `upload_complete_at` is response-received, documented as such in §7.

---

## 10. Acceptance Criteria

- [ ] `voice_interactions` exists via a real Prisma migration under `prisma/migrations/`, matching the schema in §8, with `@@map`/`@map` snake_case throughout.
- [ ] A high-confidence ("auto") single-entry voice write produces exactly one row with `confirmation_route = 'auto'`, null confirm timestamps, non-null `total_duration_ms` spanning mic-open to write-ack.
- [ ] A low-confidence/ambiguous entry that the user confirms produces a row with `confirmation_route = 'confirmed'` and a non-null `confirm_wait_duration_ms`.
- [ ] A cancelled entry produces a row with `confirmation_route = 'abandoned'` and `db_write_ack_at` null.
- [ ] A batch commit produces `confirmation_route = 'batch'`.
- [ ] With `ENABLE_VOICE_ACCURACY_TELEMETRY` unset, all four accuracy columns are null on every row while latency columns are populated normally.
- [ ] With the flag set to `'true'`, `web_stt_transcript`, `whisper_transcript`, `matched_entity_value`, `matching_tier_used` are populated.
- [ ] Both push-to-talk and continuous/VAD modes produce complete rows independently (Constraint 4).
- [ ] Existing `[Performance]` / `[VoiceEntryService]` console output is unchanged.
- [ ] A Prisma write failure never throws into the confirmation flow — it is caught and logged as a warning.
- [ ] Manual (non-voice) grid cell edits continue to work and produce no telemetry row.

---

## 11. Implementation Order

1. Schema + migration (§5) — nothing else depends on runtime behavior, but the Prisma client types are needed by every later step.
2. Shared types + flag (§8, `lib/shared/types/voice-telemetry.ts`, `lib/server/services/telemetry/config.ts`).
3. Server capture + ingest route (§6) — `pipeline.ts` span capture, `voice-interaction-service.ts`, `/api/voice-telemetry`.
4. Client capture (§7) — collector, then the capture points in both push-to-talk and VAD hooks, then the `requestId` threading into `table-cell-store.ts`.
5. Tests — service-layer duration arithmetic and never-throws behavior; collector flush semantics; route validation; flag on/off behavior.
6. `docs/10_PERFORMANCE.md` §8.5 pointer (see `docs/10_PERFORMANCE.md` for the short summary linking back here).

---

## 12. Notes for Reviewers

The most important thing to check in review is Constraint 2: this feature does **not** assume every voice entry goes through a visible confirmation step. Most don't. `confirmation_route` exists specifically so a null `confirm_shown_at`/`confirm_received_at` pair reads as "auto-committed, no confirmation needed" rather than "confirmation UI shown but never observed" — those are very different signals for the accuracy side of this work and must not be conflated.

The `upsert`-vs-`create` decision in `voice-interaction-service.ts` needs one explicit choice at implementation time: if flush only ever happens once per interaction (at db-write-ack, cancel, or a terminal error), `create` is sufficient and simpler. If a partial row is ever flushed early (e.g. on `confirm_shown_at` for observability of in-flight interactions) and then updated later, `upsert` on `requestId` is required instead. The plan assumes single-flush; revisit this if that assumption changes.

---

*End of Voice Pipeline Telemetry Spec*
