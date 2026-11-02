import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('readNight', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.badLines).toBe(1);
  });

  it('counts retries and keeps the last error', () => {
    const rows = readNight('runs', '2026-10-28')!.rows;
    const refresh = rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(refresh).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503', owner: 'rook' });
    expect(rows.find((r) => r.job === 'notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps a row whose owner is null, and the offset in times', () => {
    const row = readNight('runs', '2026-10-28')!.rows.find((r) => r.job === 'digest/render')!;
    expect(row.owner).toBeNull();
    expect(row.firstAt).toBe('2026-10-29T05:41:09+01:00');
  });

  it('returns null for a missing night and an empty night for an empty file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toBeNull();
    expect(readNight(dir, '2026-01-01')).toEqual({ rows: [], badLines: 0 });
  });
});
