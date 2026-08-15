import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColumnType } from '@/lib/shared/types/column-types';

const createMock = vi.fn();

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: (...args: unknown[]) => createMock(...args) } };
  },
}));

const resolveMentionContextMock = vi.fn();
vi.mock('@/lib/server/services/ai-service/shared/context', () => ({
  resolveMentionContext: (...args: unknown[]) => resolveMentionContextMock(...args),
}));

const tableFindManyMock = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: { table: { findMany: (...args: unknown[]) => tableFindManyMock(...args) } },
}));

const getTableColumnsForAgentMock = vi.fn();
const queryGridDataMock = vi.fn();
const getGridSummaryMock = vi.fn();

vi.mock('@/lib/server/services/ai-service/tools/grid-tools', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/services/ai-service/tools/grid-tools')>(
    '@/lib/server/services/ai-service/tools/grid-tools'
  );
  return {
    ...actual,
    getTableColumnsForAgent: (...args: unknown[]) => getTableColumnsForAgentMock(...args),
    queryGridData: (...args: unknown[]) => queryGridDataMock(...args),
    getGridSummary: (...args: unknown[]) => getGridSummaryMock(...args),
  };
});

const cacheSetMock = vi.fn();
vi.mock('@/lib/server/cache/global-agent-cache', () => ({
  pendingGlobalActionCache: { set: (...args: unknown[]) => cacheSetMock(...args), get: vi.fn(), evict: vi.fn() },
}));

import { runGlobalAgentTurn } from './agent';

const USER_ID = 'user-1';
const ORG_IDS: string[] = [];
const MENTION = { type: 'baseList' as const, id: '3ab0c2e0-1234-4abc-89ab-1234567890ab' };
const TABLE_1 = '3ab0c2e0-1234-4abc-89ab-1234567890a1';
const TABLE_2 = '3ab0c2e0-1234-4abc-89ab-1234567890a2';

const scoreColumns = [{ id: 'col-score', key: 'score', label: 'Score', type: ColumnType.NUMBER, order: 0, access: null }];
const attendanceColumns = [
  { id: 'col-attendance', key: 'attendance', label: 'Attendance', type: ColumnType.NUMBER, order: 0, access: null },
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
  resolveMentionContextMock.mockReset().mockResolvedValue([{ mention: MENTION, baseListId: 'bl-1', name: 'ClassA1', columns: [], entityCount: 2 }]);
  tableFindManyMock.mockReset().mockResolvedValue([
    { id: TABLE_1, name: 'Exam2' },
    { id: TABLE_2, name: 'Attendance' },
  ]);
  getTableColumnsForAgentMock.mockReset().mockImplementation(async (tableId: string) =>
    tableId === TABLE_1 ? scoreColumns : attendanceColumns
  );
  queryGridDataMock.mockReset();
  getGridSummaryMock.mockReset();
  cacheSetMock.mockReset();
});

describe('runGlobalAgentTurn', () => {
  it('resolves the mention, fetches every linked table, and answers using tool results', async () => {
    queryGridDataMock.mockResolvedValue({
      rows: [{ rowKey: 'row-1', representativeLabel: 'Dan Cohen', cells: { score: 85 } }],
    });

    createMock
      .mockResolvedValueOnce(
        toolCallCompletion('queryGridData', { tableId: TABLE_1, filters: [{ columnKey: 'score', operator: 'gt', value: 60 }], limit: 50 })
      )
      .mockResolvedValueOnce(answerCompletion('Dan Cohen scored above 60.'));

    const result = await runGlobalAgentTurn({
      userId: USER_ID,
      organizationIds: ORG_IDS,
      mention: MENTION,
      message: 'who scored above 60?',
    });

    expect('answer' in result && result.answer).toBe('Dan Cohen scored above 60.');
    expect(queryGridDataMock).toHaveBeenCalledWith(TABLE_1, USER_ID, { filters: [{ columnKey: 'score', operator: 'gt', value: 60 }], limit: 50 });
    expect('evidence' in result && result.evidence?.rows).toEqual([
      { rowKey: 'row-1', representativeLabel: 'Dan Cohen', tableId: TABLE_1 },
    ]);
  });

  it('routes tool calls to different tables across rounds for cross-table questions', async () => {
    queryGridDataMock
      .mockResolvedValueOnce({ rows: [{ rowKey: 'row-1', representativeLabel: 'Dan Cohen', cells: { score: 85 } }] })
      .mockResolvedValueOnce({ rows: [{ rowKey: 'row-1', representativeLabel: 'Dan Cohen', cells: { attendance: 70 } }] });

    createMock
      .mockResolvedValueOnce(toolCallCompletion('queryGridData', { tableId: TABLE_1, filters: [], limit: 50 }, 'call-1'))
      .mockResolvedValueOnce(toolCallCompletion('queryGridData', { tableId: TABLE_2, filters: [], limit: 50 }, 'call-2'))
      .mockResolvedValueOnce(answerCompletion('Dan Cohen: score 85, attendance 70.'));

    const result = await runGlobalAgentTurn({
      userId: USER_ID,
      organizationIds: ORG_IDS,
      mention: MENTION,
      message: 'combine exam and attendance for Dan Cohen',
    });

    expect('answer' in result && result.answer).toBe('Dan Cohen: score 85, attendance 70.');
    expect(queryGridDataMock).toHaveBeenNthCalledWith(1, TABLE_1, USER_ID, expect.anything());
    expect(queryGridDataMock).toHaveBeenNthCalledWith(2, TABLE_2, USER_ID, expect.anything());
  });

  it('never executes updateCellsBatch — it caches a pendingAction (tagged with tableId) and returns immediately', async () => {
    createMock.mockResolvedValueOnce(
      toolCallCompletion('updateCellsBatch', {
        tableId: TABLE_1,
        updates: [{ rowKey: 'row-1', columnKey: 'score', value: 90 }],
      })
    );

    const result = await runGlobalAgentTurn({
      userId: USER_ID,
      organizationIds: ORG_IDS,
      mention: MENTION,
      message: 'set score to 90 for row 1 in Exam2',
    });

    expect('pendingAction' in result).toBe(true);
    if ('pendingAction' in result) {
      expect(result.pendingAction.updates).toEqual([{ rowKey: 'row-1', columnKey: 'score', value: 90, tableId: TABLE_1 }]);
    }
    expect(cacheSetMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('sends a correction message instead of executing on an unknown tableId, without exceeding the round cap', async () => {
    createMock
      .mockResolvedValueOnce(toolCallCompletion('queryGridData', { tableId: 'ghost-table', filters: [], limit: 50 }))
      .mockResolvedValueOnce(answerCompletion('That table does not exist.'));

    const result = await runGlobalAgentTurn({
      userId: USER_ID,
      organizationIds: ORG_IDS,
      mention: MENTION,
      message: 'query a fake table',
    });

    expect('answer' in result && result.answer).toBe('That table does not exist.');
    expect(queryGridDataMock).not.toHaveBeenCalled();
  });

  it('sends a correction message for an unknown columnKey scoped to the right table', async () => {
    createMock
      .mockResolvedValueOnce(
        toolCallCompletion('queryGridData', { tableId: TABLE_1, filters: [{ columnKey: 'ghost', operator: 'isEmpty' }], limit: 50 })
      )
      .mockResolvedValueOnce(answerCompletion('There is no such column.'));

    const result = await runGlobalAgentTurn({
      userId: USER_ID,
      organizationIds: ORG_IDS,
      mention: MENTION,
      message: 'who has no ghost?',
    });

    expect('answer' in result && result.answer).toBe('There is no such column.');
    expect(queryGridDataMock).not.toHaveBeenCalled();
  });

  it('returns a graceful "no linked tables" answer without calling the LLM', async () => {
    tableFindManyMock.mockResolvedValue([]);

    const result = await runGlobalAgentTurn({
      userId: USER_ID,
      organizationIds: ORG_IDS,
      mention: MENTION,
      message: 'anything',
    });

    expect('answer' in result && result.answer).toMatch(/no linked tables/i);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('returns a graceful fallback answer if 3 rounds exhaust without a final answer', async () => {
    getGridSummaryMock.mockResolvedValue({ rowCount: 0, columns: [] });
    createMock
      .mockResolvedValueOnce(toolCallCompletion('getGridSummary', { tableId: TABLE_1 }))
      .mockResolvedValueOnce(toolCallCompletion('getGridSummary', { tableId: TABLE_1 }))
      .mockResolvedValueOnce(toolCallCompletion('getGridSummary', { tableId: TABLE_1 }));

    const result = await runGlobalAgentTurn({
      userId: USER_ID,
      organizationIds: ORG_IDS,
      mention: MENTION,
      message: 'loop forever',
    });

    expect('answer' in result && result.answer).toMatch(/rephrase/i);
    expect(createMock).toHaveBeenCalledTimes(3);
  });
});
