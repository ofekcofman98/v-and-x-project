import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColumnType } from '@/lib/shared/types/column-types';
import type { TableSchema } from '@/lib/shared/types/table-schema';
import type { VoiceEntryPayload } from '@/lib/shared/types/voice-pipeline';

const matchAsyncMock = vi.fn();
const createMock = vi.fn();

vi.mock('@/lib/server/matching/matcher', () => ({
  matchAsync: (...args: unknown[]) => matchAsyncMock(...args),
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

import { processVoiceEntryBatch, BatchSegmentationFailedError } from './batch-orchestrator';

const tableSchema: TableSchema = {
  columns: [
    { id: 'entity', label: 'Name', type: ColumnType.TEXT, isBaseColumn: true },
    { id: 'math', label: 'Math', type: ColumnType.NUMBER },
    { id: 'english', label: 'English', type: ColumnType.NUMBER },
    { id: 'science', label: 'Science', type: ColumnType.NUMBER },
  ],
  rows: [
    { id: 'row-dan', label: 'Dan Cohen' },
    { id: 'row-noa', label: 'Noa Levi' },
    { id: 'row-yossi', label: 'Yossi Mizrahi' },
  ],
};

const timings = { transcriptionDuration: 100, totalStartTime: Date.now() - 200 };

beforeEach(() => {
  matchAsyncMock.mockReset();
  createMock.mockReset();
});

describe('processVoiceEntryBatch — column-first', () => {
  const payload: VoiceEntryPayload = {
    tableSchema,
    activeCell: { rowKey: 'row-dan', tableColumnId: 'math' },
    navigationMode: 'column-first',
    tableId: 'table-1',
  };

  it('resolves each entity+value pair via the matcher, one write per row, same column', async () => {
    matchAsyncMock
      .mockResolvedValueOnce({ matched: 'Dan Cohen', confidence: 0.95, matchType: 'exact' })
      .mockResolvedValueOnce({ matched: 'Noa Levi', confidence: 0.95, matchType: 'exact' })
      .mockResolvedValueOnce({ matched: 'Yossi Mizrahi', confidence: 0.95, matchType: 'exact' });

    const result = await processVoiceEntryBatch('Dan 85, Noa 90, Yossi 78', payload, timings);

    expect(result.isBatch).toBe(true);
    expect(result.pathTaken).toBe('BATCH_LOCAL_SEGMENTATION');
    expect(result.overflowCount).toBe(0);
    expect(result.writes).toHaveLength(3);
    expect(result.writes.every((w) => w.tableColumnId === 'math')).toBe(true);
    expect(result.writes.map((w) => w.rowKey)).toEqual(['row-dan', 'row-noa', 'row-yossi']);
    expect(matchAsyncMock).toHaveBeenCalledTimes(3);
  });

  it('falls back to LLM segmentation when local segmentation is ambiguous', async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              entries: [
                { entityText: 'Dan', rawValue: '85' },
                { entityText: 'Noa', rawValue: '90' },
              ],
            }),
          },
        },
      ],
    });
    matchAsyncMock
      .mockResolvedValueOnce({ matched: 'Dan Cohen', confidence: 0.95, matchType: 'exact' })
      .mockResolvedValueOnce({ matched: 'Noa Levi', confidence: 0.95, matchType: 'exact' });

    // "Dan, 85, Noa, 90" is ambiguous for local comma-splitting (see
    // batch-segmentation.test.ts), so this exercises the LLM fallback path.
    const result = await processVoiceEntryBatch('Dan, 85, Noa, 90', payload, timings);

    expect(result.pathTaken).toBe('BATCH_LLM_SEGMENTATION');
    expect(result.writes).toHaveLength(2);
  });

  it('throws BatchSegmentationFailedError when both local and LLM segmentation fail', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ entries: [] }) } }],
    });

    await expect(processVoiceEntryBatch('Dan, 85, Noa, 90', payload, timings)).rejects.toThrow(
      BatchSegmentationFailedError
    );
  });
});

describe('processVoiceEntryBatch — row-first', () => {
  const payload: VoiceEntryPayload = {
    tableSchema,
    activeCell: { rowKey: 'row-dan', tableColumnId: 'math' },
    navigationMode: 'row-first',
    tableId: 'table-1',
  };

  it('maps bare values to the next editable columns in the current row, never calling the matcher', async () => {
    const result = await processVoiceEntryBatch('85, 90, 78', payload, timings);

    expect(result.pathTaken).toBe('BATCH_LOCAL_SEGMENTATION');
    expect(result.overflowCount).toBe(0);
    expect(result.writes.map((w) => w.tableColumnId)).toEqual(['math', 'english', 'science']);
    expect(result.writes.every((w) => w.rowKey === 'row-dan')).toBe(true);
    expect(matchAsyncMock).not.toHaveBeenCalled();
  });

  it('parks overflow values past the end of the row rather than spilling into the next row', async () => {
    const midRowPayload: VoiceEntryPayload = {
      ...payload,
      activeCell: { rowKey: 'row-dan', tableColumnId: 'english' },
    };

    const result = await processVoiceEntryBatch('90, 78', midRowPayload, timings);

    expect(result.writes.map((w) => w.tableColumnId)).toEqual(['english', 'science']);
    expect(result.overflowCount).toBe(0);
  });

  it('reports overflowCount when there are more values than remaining columns', async () => {
    const lastColumnPayload: VoiceEntryPayload = {
      ...payload,
      activeCell: { rowKey: 'row-dan', tableColumnId: 'science' },
    };

    const result = await processVoiceEntryBatch('78, 99', lastColumnPayload, timings);

    expect(result.writes.map((w) => w.tableColumnId)).toEqual(['science']);
    expect(result.overflowCount).toBe(1);
  });
});
