import { describe, expect, it } from 'vitest';
import { countStatuses } from '../src/digest/counts.js';

describe('countStatuses', () => {
  it('counts lines per status for 2026-10-28, skipping the bad line', () => {
    expect(countStatuses('runs', '2026-10-28')).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('counts 2026-10-27', () => {
    expect(countStatuses('runs', '2026-10-27')).toEqual({ ok: 7, retry: 0, fail: 0 });
  });

  it('returns null for a night with no file', () => {
    expect(countStatuses('runs', '1999-01-01')).toBeNull();
  });
});
