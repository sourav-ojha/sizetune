import { describe, it, expect } from 'vitest';
import { targetFromSearch } from '../src/components/tool/query';

describe('size target from the page address (FEATURE-008 AC-4)', () => {
  it('reads max and min KB', () => {
    expect(targetFromSearch('?max=50&min=20')).toEqual({ maxKb: '50', minKb: '20' });
    expect(targetFromSearch('?max=35.5')).toEqual({ maxKb: '35.5' });
  });
  it('ignores anything that is not a plain positive number', () => {
    expect(targetFromSearch('?max=abc&min=-5')).toEqual({});
    expect(targetFromSearch('?max=1e9&min=0')).toEqual({});
    expect(targetFromSearch('?max=99999999')).toEqual({});
    expect(targetFromSearch('')).toEqual({});
  });
});
