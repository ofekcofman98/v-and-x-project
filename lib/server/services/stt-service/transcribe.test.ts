import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.fn();

vi.mock('openai', () => ({
  default: class {
    audio = { transcriptions: { create: (...args: unknown[]) => createMock(...args) } };
  },
}));

import { transcribeChatAudio } from './transcribe';

describe('transcribeChatAudio', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it('returns an empty string for a known hallucination phrase', async () => {
    createMock.mockResolvedValue({ text: 'Thank you.' });

    const result = await transcribeChatAudio(new File([], 'audio.webm'), 'en');

    expect(result.text).toBe('');
    expect(typeof result.duration).toBe('number');
  });

  it('passes through a real transcript unchanged', async () => {
    createMock.mockResolvedValue({ text: 'Set the budget to 85 dollars.' });

    const result = await transcribeChatAudio(new File([], 'audio.webm'), 'en');

    expect(result.text).toBe('Set the budget to 85 dollars.');
  });
});
