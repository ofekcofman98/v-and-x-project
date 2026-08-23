import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColumnType } from '@/lib/shared/types/column-types';
import type { TableSchema } from '@/lib/shared/types/table-schema';
import type { VoiceEntryPayload } from '@/lib/shared/types/voice-pipeline';

const matchAsyncMock = vi.fn();
const transcribeAudioMock = vi.fn();
const createMock = vi.fn();

vi.mock('@/lib/server/matching/matcher', () => ({
  matchAsync: (...args: unknown[]) => matchAsyncMock(...args),
}));

vi.mock('./transcription', () => ({
  transcribeAudio: (...args: unknown[]) => transcribeAudioMock(...args),
}));

vi.mock('./openai-client', () => ({
  openai: {
    chat: {
      completions: {
        create: (...args: unknown[]) => createMock(...args),
      },
    },
  },
}));

import { processVoiceEntry } from './pipeline';
import { entityCache } from '@/lib/server/cache/entity-recognition-cache';

const tableSchema: TableSchema = {
  columns: [
    { id: 'entity', label: 'Name', type: ColumnType.TEXT, isBaseColumn: true },
    { id: 'present', label: 'Present', type: ColumnType.BOOLEAN },
  ],
  rows: [
    { id: 'row-dan', label: 'Dan Cohen' },
    { id: 'row-noa', label: 'Noa Levi' },
  ],
};

const audioFile = new File([new Uint8Array([1, 2, 3])], 'recording.webm');

beforeEach(() => {
  matchAsyncMock.mockReset();
  transcribeAudioMock.mockReset();
  createMock.mockReset();
  // The entity-recognition cache is a module-level singleton keyed by
  // transcript+tableId — clear it so a cache hit from one test's transcript
  // doesn't leak into the next test that reuses the same transcript.
  entityCache.clear();
});

describe('processVoiceEntry — bare boolean value not stolen by quick-extract', () => {
  const payload: VoiceEntryPayload = {
    tableSchema,
    activeCell: { rowKey: 'row-dan', tableColumnId: 'present' },
    navigationMode: 'column-first',
    tableId: 'table-1',
  };

  it('resolves "Not here" to false on the active row via the fast path, without an LLM call', async () => {
    transcribeAudioMock.mockResolvedValue({
      transcript: 'Not here',
      transcriptionDuration: 50,
      audioDurationSec: 1,
      promptEntities: [],
    });
    // extractEntityQuick splits "Not here" into entity:"Not" value:"here" —
    // simulate the matcher missing on that bogus entity guess so the gate
    // falls through to the bare-value path instead of the LLM fallback.
    matchAsyncMock.mockResolvedValue({ matched: null, confidence: 0, matchType: 'none' });

    const result = await processVoiceEntry(payload, audioFile);

    expect('isBatch' in result).toBe(false);
    if ('isBatch' in result) throw new Error('unreachable');

    expect(result.entity).toBe('Dan Cohen');
    expect(result.value).toBe(false);
    expect(result.valueValid).toBe(true);
    expect(result.action).toBe('UPDATE_CELL');
    expect(result.pathTaken).toBe('FAST_PATH');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('resolves a single-word "Here" to true on the active row via the fast path', async () => {
    transcribeAudioMock.mockResolvedValue({
      transcript: 'Here',
      transcriptionDuration: 50,
      audioDurationSec: 1,
      promptEntities: [],
    });

    const result = await processVoiceEntry(payload, audioFile);

    expect('isBatch' in result).toBe(false);
    if ('isBatch' in result) throw new Error('unreachable');

    expect(result.entity).toBe('Dan Cohen');
    expect(result.value).toBe(true);
    expect(result.valueValid).toBe(true);
    expect(result.pathTaken).toBe('FAST_PATH');
    expect(matchAsyncMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe('processVoiceEntry — entity+value boolean utterances still resolve via entity matching', () => {
  const payload: VoiceEntryPayload = {
    tableSchema,
    activeCell: { rowKey: 'row-dan', tableColumnId: 'present' },
    navigationMode: 'column-first',
    tableId: 'table-1',
  };

  it('"Dan, here" matches Dan\'s row (not the active row) when the entity resolves confidently', async () => {
    transcribeAudioMock.mockResolvedValue({
      transcript: 'Dan, here',
      transcriptionDuration: 50,
      audioDurationSec: 1,
      promptEntities: [],
    });
    matchAsyncMock.mockResolvedValue({ matched: 'Dan Cohen', confidence: 0.95, matchType: 'exact' });

    // Active cell is on Noa's row — proves the write follows the spoken
    // entity, not whatever row happened to be selected.
    const onNoaRow: VoiceEntryPayload = {
      ...payload,
      activeCell: { rowKey: 'row-noa', tableColumnId: 'present' },
    };

    const result = await processVoiceEntry(onNoaRow, audioFile);

    expect('isBatch' in result).toBe(false);
    if ('isBatch' in result) throw new Error('unreachable');

    expect(result.entity).toBe('Dan Cohen');
    expect(result.value).toBe(true);
    expect(result.valueValid).toBe(true);
    expect(result.pathTaken).toBe('FAST_PATH');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('"Dan, here" falls through to the LLM fallback (never silently attributed to the active row) when the entity match misses', async () => {
    transcribeAudioMock.mockResolvedValue({
      transcript: 'Dan, here',
      transcriptionDuration: 50,
      audioDurationSec: 1,
      promptEntities: [],
    });
    // Every matchAsync call (quick-extract's guess, and the LLM fallback's
    // own attempt) misses — simulates a name the matcher can't resolve.
    matchAsyncMock.mockResolvedValue({ matched: null, confidence: 0, matchType: 'none' });
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              entity: 'Dan',
              entityMatch: null,
              value: 'here',
              valueValid: true,
              action: 'UPDATE_CELL',
              reasoning: 'test',
            }),
          },
        },
      ],
    });

    const onNoaRow: VoiceEntryPayload = {
      ...payload,
      activeCell: { rowKey: 'row-noa', tableColumnId: 'present' },
    };

    const result = await processVoiceEntry(onNoaRow, audioFile);

    expect('isBatch' in result).toBe(false);
    if ('isBatch' in result) throw new Error('unreachable');

    // The bare-value fast path must NOT have hijacked this as a value for
    // the active (Noa) row — parseBoolean('Dan, here') is null, so it falls
    // through to the LLM fallback, which correctly reports AMBIGUOUS rather
    // than silently writing to Noa's row.
    expect(result.pathTaken).toBe('LLM_FALLBACK');
    expect(result.action).toBe('AMBIGUOUS');
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});
