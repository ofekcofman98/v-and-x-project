import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColumnType } from '@/lib/shared/types/column-types';

const createMock = vi.fn();

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: (...args: unknown[]) => createMock(...args) } };
  },
}));

const getTableColumnsForAgentMock = vi.fn();
const queryGridDataMock = vi.fn();
const getGridSummaryMock = vi.fn();

vi.mock('@/lib/server/services/ai-grid-tools', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/services/ai-grid-tools')>(
    '@/lib/server/services/ai-grid-tools'
  );
  return {
    ...actual,
    getTableColumnsForAgent: (...args: unknown[]) => getTableColumnsForAgentMock(...args),
    queryGridData: (...args: unknown[]) => queryGridDataMock(...args),
    getGridSummary: (...args: unknown[]) => getGridSummaryMock(...args),
  };
});

const cacheSetMock = vi.fn();
vi.mock('@/lib/server/cache/grid-agent-cache', () => ({
  pendingGridActionCache: { set: (...args: unknown[]) => cacheSetMock(...args), get: vi.fn(), evict: vi.fn() },
}));

import { runGridAgentTurn } from './grid-agent';

const TABLE_ID = 'table-1';
const USER_ID = 'user-1';

const columns = [
  { id: 'col-name', key: 'name', label: 'Name', type: ColumnType.TEXT, order: 0, access: null },
  { id: 'col-score', key: 'score', label: 'Score', type: ColumnType.NUMBER, order: 1, access: null },
];

function toolCallCompletion(name: string, args: Record<string, unknown>, id = 'call-1') {
  return {
    usage: { prompt_tokens: 10, completion_tokens: 5 },
    choices: [
      {
        message: {
          content: null,
          tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
        },
      },
    ],
  };
}

function answerCompletion(content: string) {
  return {
    usage: { prompt_tokens: 10, completion_tokens: 5 },
    choices: [{ message: { content, tool_calls: undefined } }],
  };
}

beforeEach(() => {
  createMock.mockReset();
  getTableColumnsForAgentMock.mockReset().mockResolvedValue(columns);
  queryGridDataMock.mockReset();
  getGridSummaryMock.mockReset();
  cacheSetMock.mockReset();
});

describe('runGridAgentTurn', () => {
  it('executes a read tool then returns a final answer with evidence', async () => {
    queryGridDataMock.mockResolvedValue({
      rows: [{ rowKey: 'row-1', representativeLabel: 'Dan Cohen', cells: { score: null } }],
    });

    createMock
      .mockResolvedValueOnce(
        toolCallCompletion('queryGridData', { filters: [{ columnKey: 'score', operator: 'isEmpty' }], limit: 50 })
      )
      .mockResolvedValueOnce(answerCompletion('Dan Cohen has no score.'));

    const result = await runGridAgentTurn({ userId: USER_ID, tableId: TABLE_ID, message: 'who has no score?' });

    expect('answer' in result && result.answer).toBe('Dan Cohen has no score.');
    expect('evidence' in result && result.evidence?.rows).toEqual([{ rowKey: 'row-1', representativeLabel: 'Dan Cohen' }]);
    expect(queryGridDataMock).toHaveBeenCalledTimes(1);
  });

  it('never executes updateCellsBatch — it caches a pendingAction and returns immediately', async () => {
    createMock.mockResolvedValueOnce(
      toolCallCompletion('updateCellsBatch', { updates: [{ rowKey: 'row-1', columnKey: 'score', value: 90 }] })
    );

    const result = await runGridAgentTurn({ userId: USER_ID, tableId: TABLE_ID, message: 'set score to 90 for row 1' });

    expect('pendingAction' in result).toBe(true);
    if ('pendingAction' in result) {
      expect(result.pendingAction.updates).toEqual([{ rowKey: 'row-1', columnKey: 'score', value: 90 }]);
    }
    expect(cacheSetMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledTimes(1); // the turn ends immediately, no further rounds
  });

  it('sends a correction message instead of executing on an unknown columnKey, without exceeding the round cap', async () => {
    createMock
      .mockResolvedValueOnce(
        toolCallCompletion('queryGridData', { filters: [{ columnKey: 'ghost', operator: 'isEmpty' }], limit: 50 })
      )
      .mockResolvedValueOnce(answerCompletion('There is no such column.'));

    const result = await runGridAgentTurn({ userId: USER_ID, tableId: TABLE_ID, message: 'who has no ghost?' });

    expect('answer' in result && result.answer).toBe('There is no such column.');
    expect(queryGridDataMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it('returns a graceful fallback answer if 3 rounds exhaust without a final answer', async () => {
    getGridSummaryMock.mockResolvedValue({ rowCount: 0, columns: [] });
    createMock
      .mockResolvedValueOnce(toolCallCompletion('getGridSummary', {}))
      .mockResolvedValueOnce(toolCallCompletion('getGridSummary', {}))
      .mockResolvedValueOnce(toolCallCompletion('getGridSummary', {}));

    const result = await runGridAgentTurn({ userId: USER_ID, tableId: TABLE_ID, message: 'loop forever' });

    expect('answer' in result && result.answer).toMatch(/rephrase/i);
    expect(createMock).toHaveBeenCalledTimes(3);
  });
});
