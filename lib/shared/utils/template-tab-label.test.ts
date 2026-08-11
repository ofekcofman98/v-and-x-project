import { describe, it, expect } from 'vitest';
import { deriveTemplateTabLabel } from './template-tab-label';

describe('deriveTemplateTabLabel', () => {
  it('strips the "{baseListName} - " prefix when present', () => {
    expect(deriveTemplateTabLabel('Class A1 - Grades', 'Class A1')).toBe('Grades');
  });

  it('falls back to the full table name when the prefix is absent', () => {
    expect(deriveTemplateTabLabel('Renamed Table', 'Class A1')).toBe('Renamed Table');
  });

  it('does not strip a partial or non-matching prefix', () => {
    expect(deriveTemplateTabLabel('Class A10 - Grades', 'Class A1')).toBe('Class A10 - Grades');
  });
});
