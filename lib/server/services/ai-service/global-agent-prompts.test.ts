import { describe, it, expect } from 'vitest';
import { ColumnType } from '@/lib/shared/types/column-types';
import { buildGlobalSystemPrompt } from './global-agent-prompts';

describe('buildGlobalSystemPrompt', () => {
  it('lists every linked table with its tableId and columns', () => {
    const prompt = buildGlobalSystemPrompt('ClassA1', [
      { tableId: 'table-1', name: 'Exam2', columns: [{ id: 'c1', key: 'q1', label: 'Q1', type: ColumnType.NUMBER, order: 0, access: null }] },
      { tableId: 'table-2', name: 'Attendance', columns: [{ id: 'c2', key: 'present', label: 'Present', type: ColumnType.BOOLEAN, order: 0, access: null }] },
    ]);

    expect(prompt).toContain('Table "Exam2" (tableId: table-1)');
    expect(prompt).toContain('  - q1 ("Q1", type: NUMBER)');
    expect(prompt).toContain('Table "Attendance" (tableId: table-2)');
    expect(prompt).toContain('  - present ("Present", type: BOOLEAN)');
  });

  it('requires a tableId argument on every tool call', () => {
    const prompt = buildGlobalSystemPrompt('ClassA1', []);
    expect(prompt).toMatch(/Every tool call requires a "tableId" argument/);
  });

  it('instructs the model to join cross-table results by rowKey', () => {
    const prompt = buildGlobalSystemPrompt('ClassA1', []);
    expect(prompt).toMatch(/join on "rowKey"/);
  });

  it('tells the model that queryGridData rows carry a representativeLabel identity field', () => {
    const prompt = buildGlobalSystemPrompt('ClassA1', []);
    expect(prompt).toMatch(/representativeLabel/);
    expect(prompt).toMatch(/do\s+not say a table has no name column/i);
  });

  it('instructs the model to format multi-item answers as Markdown lists with bold names/metrics', () => {
    const prompt = buildGlobalSystemPrompt('ClassA1', []);
    expect(prompt).toMatch(/ALWAYS format it as a\s+Markdown list/);
    expect(prompt).toMatch(/\*\*Bold\*\* every entity\/row name/);
  });
});
