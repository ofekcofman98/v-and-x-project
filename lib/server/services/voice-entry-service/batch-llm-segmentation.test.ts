import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.fn();

vi.mock('./openai-client', () => ({
  openai: {
    chat: {
      completions: {
        create: (...args: unknown[]) => createMock(...args),
      },
    },
  },
}));

import { segmentBareValuesViaLLM, segmentEntityValuePairsViaLLM } from './batch-llm-segmentation';

function mockCompletion(content: string): void {
  createMock.mockResolvedValueOnce({
    choices: [{ message: { content } }],
  });
}

beforeEach(() => {
  createMock.mockReset();
});

describe('segmentBareValuesViaLLM', () => {
  it('returns raw values from a valid completion', async () => {
    mockCompletion(JSON.stringify({ entries: [{ rawValue: '85' }, { rawValue: '90' }] }));

    const result = await segmentBareValuesViaLLM('eighty five ninety');

    expect(result).toEqual(['85', '90']);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('retries once on invalid schema, then succeeds', async () => {
    mockCompletion(JSON.stringify({ entries: [] })); // fails min(1)
    mockCompletion(JSON.stringify({ entries: [{ rawValue: '85' }] }));

    const result = await segmentBareValuesViaLLM('eighty five');

    expect(result).toEqual(['85']);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting the retry', async () => {
    mockCompletion(JSON.stringify({ entries: [] }));
    mockCompletion(JSON.stringify({ entries: [] }));

    await expect(segmentBareValuesViaLLM('garbled')).rejects.toThrow();
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});

describe('segmentEntityValuePairsViaLLM', () => {
  it('returns entity/value pairs from a valid completion', async () => {
    mockCompletion(
      JSON.stringify({
        entries: [
          { entityText: 'Dan', rawValue: '85' },
          { entityText: 'Noa', rawValue: '90' },
        ],
      })
    );

    const result = await segmentEntityValuePairsViaLLM('Dan eighty five Noa ninety');

    expect(result).toEqual([
      { entityText: 'Dan', rawValue: '85' },
      { entityText: 'Noa', rawValue: '90' },
    ]);
  });

  it('throws after exhausting the retry on repeated invalid schema', async () => {
    mockCompletion(JSON.stringify({ entries: [{ entityText: '' }] }));
    mockCompletion(JSON.stringify({ entries: [{ entityText: '' }] }));

    await expect(segmentEntityValuePairsViaLLM('garbled')).rejects.toThrow();
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});
