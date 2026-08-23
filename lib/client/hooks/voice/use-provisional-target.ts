/**
 * useProvisionalTarget Hook
 * Combines the Web Speech shadow's growing interim transcript with the
 * client-side matcher chain to guess which row is being targeted, before
 * Whisper ever returns. This is the only hook that touches both the shadow
 * transcript and tableSchema — use-speech-shadow.ts stays table-agnostic.
 *
 * In row-first mode the active row is already fixed by the pointer
 * (mirrors the server's `isRowFirstMidRow` shortcut), so there is no row
 * to guess — but the value is still guessable from the raw transcript and
 * is published against that fixed row.
 *
 * The result is a pure display guess. It never writes a cell and is always
 * superseded by the confirmed (Whisper) result — see the reconciliation
 * rules. docs/features/15_realtime_voice_feedback.md §3.2, §4
 */

import { useEffect, useRef } from 'react';
import { useUIStore } from '@/lib/client/stores/ui-store';
import { ExactMatcher, PhoneticMatcher, FuzzyMatcher, MatcherChain } from '@/lib/shared/matching';
import { extractEntityQuick } from '@/lib/shared/utils/extract-entity-quick';
import type { TableSchema } from '@/lib/shared/types/table-schema';
import type { NavigationMode } from '@/lib/client/stores/ui-store';

// Debounce so the matcher doesn't re-run on every single interim event —
// Web Speech can fire several times per second while the browser refines
// its guess.
const DEBOUNCE_MS = 150;

// Lower than the server chain's 0.85 minConfidence: this result is
// provisional and purely additive display, so a looser bar is acceptable —
// a wrong guess self-corrects the moment the real result lands (§4 rule 1).
const PROVISIONAL_MIN_CONFIDENCE = 0.6;

export interface UseProvisionalTargetOptions {
  interimTranscript: string;
  tableSchema: TableSchema;
  navigationMode: NavigationMode;
  isActive: boolean;
}

export function useProvisionalTarget({
  interimTranscript,
  tableSchema,
  navigationMode,
  isActive,
}: UseProvisionalTargetOptions): void {
  const setProvisionalFeedback = useUIStore((s) => s.setProvisionalFeedback);
  const clearProvisionalFeedback = useUIStore((s) => s.clearProvisionalFeedback);

  // Built once — cheap, stateless, and identical to the server's Levels 1-3
  // (lib/server/matching/matcher.ts's createDefaultMatcherChain), just
  // without the cache/logging wrapper that keeps that module server-only.
  const chainRef = useRef<MatcherChain | null>(null);
  if (!chainRef.current) {
    chainRef.current = new MatcherChain()
      .addMatcher(new ExactMatcher())
      .addMatcher(new PhoneticMatcher())
      .addMatcher(new FuzzyMatcher(2));
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isActive || !interimTranscript) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      // Row-first: the row is already fixed by the pointer, mirroring the
      // server's isRowFirstMidRow shortcut — only the value needs guessing.
      // Read the active row from the store directly (not a hook
      // subscription) since this callback only ever fires while speech is
      // active, and subscribing would re-run the effect on every pointer
      // move for no benefit.
      if (navigationMode === 'row-first') {
        const activeRowKey = useUIStore.getState().activeCell?.rowKey ?? null;
        setProvisionalFeedback({
          interimTranscript,
          provisionalRowKey: activeRowKey,
          provisionalValue: interimTranscript.trim() || null,
        });
        return;
      }

      const extracted = extractEntityQuick(interimTranscript);
      if (!extracted) {
        setProvisionalFeedback({ interimTranscript });
        return;
      }

      const labels = tableSchema.rows.map((row) => row.label);
      const result = chainRef.current!.match(extracted.entity, labels, PROVISIONAL_MIN_CONFIDENCE);

      const matchedRow = result.matched
        ? tableSchema.rows.find((row) => row.label === result.matched)
        : null;

      setProvisionalFeedback({
        interimTranscript,
        provisionalRowKey: matchedRow?.id ?? null,
        provisionalValue: matchedRow ? String(extracted.value) : null,
      });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [interimTranscript, tableSchema, navigationMode, isActive, setProvisionalFeedback]);

  // Clear on deactivation (speech end / cell change / mode toggle handled by
  // the caller re-evaluating isActive) — reconciliation rule 4.
  useEffect(() => {
    if (!isActive) {
      clearProvisionalFeedback();
    }
  }, [isActive, clearProvisionalFeedback]);
}
