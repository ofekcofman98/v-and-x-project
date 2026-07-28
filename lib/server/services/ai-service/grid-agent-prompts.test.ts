import { describe, it, expect } from 'vitest';
import { ColumnType } from '@/lib/shared/types/column-types';
import { buildSystemPrompt } from './grid-agent-prompts';

describe('buildSystemPrompt', () => {
  it('tells the model that queryGridData rows carry a representativeLabel identity field', () => {
    const prompt = buildSystemPrompt([
      { id: 'col-q1', key: 'q1', label: 'Q1', type: ColumnType.NUMBER, order: 0, access: null },
    ]);

    expect(prompt).toMatch(/representativeLabel/);
    expect(prompt).toMatch(/It is NOT one of the/);
    expect(prompt).toMatch(/do\s+not say the table has no name column/i);
  });

  it('still lists the table columns for filter/update validation guidance', () => {
    const prompt = buildSystemPrompt([
      { id: 'col-q1', key: 'q1', label: 'Q1', type: ColumnType.NUMBER, order: 0, access: null },
    ]);

    expect(prompt).toContain('- q1 ("Q1", type: NUMBER)');
  });

  it('instructs the model to resolve ambiguous follow-ups from conversation history instead of re-querying', () => {
    const prompt = buildSystemPrompt([]);

    expect(prompt).toMatch(/This chat has memory/);
    expect(prompt).toMatch(/top 3\s+students/);
    expect(prompt).toMatch(/do not call a tool again just to\s+re-fetch something you already have/);
    expect(prompt).toMatch(/never invent a columnKey/);
  });

  it('instructs the model to format multi-item answers as Markdown lists with bold names/metrics', () => {
    const prompt = buildSystemPrompt([]);

    expect(prompt).toMatch(/ALWAYS format it as a\s+Markdown list/);
    expect(prompt).toMatch(/\*\*Bold\*\* every entity\/row name/);
  });
});
