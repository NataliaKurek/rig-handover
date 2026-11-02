import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

const REAL_JOBS = ['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs'];

// A temp runs dir: runs/ is read-only, so every fixture night lives here.
function tempRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

const line = (at: string, job: string, status: string, owner: string | null = 'rook') =>
  JSON.stringify({ at, job, status, owner });

// Job names in the order they appear in the HTML. Each must be present.
function jobOrderInHtml(html: string, jobs: string[]): string[] {
  return jobs
    .map((job) => ({ job, at: html.indexOf(job) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.job);
}

describe('GET /digest/:night (page)', () => {
  it('renders 2026-10-28 with one table of the real jobs', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<table');
    for (const job of REAL_JOBS) expect(html).toContain(job);
  });

  it('returns 404 for a night with no file', async () => {
    const res = await createApp(config).request('/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('returns 404 for an invalid night', async () => {
    const res = await createApp(config).request('/digest/..%2Fsecret');
    expect(res.status).toBe(404);
  });

  it('says "nothing ran" for an empty night', async () => {
    const runsDir = tempRuns({ '2026-02-02.jsonl': '' });
    const res = await createApp({ ...config, runsDir }).request('/digest/2026-02-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('renders a night with a bad line, counting it without failing', async () => {
    const runsDir = tempRuns({
      '2026-03-03.jsonl': [
        line('2026-03-03T01:00:00+01:00', 'lane/sync', 'ok'),
        'this is not json',
        line('2026-03-03T02:00:00+01:00', 'notes/backup', 'fail', null),
      ].join('\n'),
    });
    const res = await createApp({ ...config, runsDir }).request('/digest/2026-03-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('lane/sync');
    expect(html).toContain('notes/backup');
  });

  it('shows a null owner as an em dash', async () => {
    const runsDir = tempRuns({
      '2026-04-04.jsonl': line('2026-04-04T01:00:00+01:00', 'digest/render', 'ok', null),
    });
    const res = await createApp({ ...config, runsDir }).request('/digest/2026-04-04');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('—');
  });

  it('sorts rows by job, whatever the order in the file', async () => {
    const runsDir = tempRuns({
      '2026-05-05.jsonl': [
        line('2026-05-05T01:00:00+01:00', 'zeta/last', 'ok'),
        line('2026-05-05T02:00:00+01:00', 'alpha/first', 'ok'),
        line('2026-05-05T03:00:00+01:00', 'mid/middle', 'retry'),
      ].join('\n'),
    });
    const html = await (await createApp({ ...config, runsDir }).request('/digest/2026-05-05')).text();
    expect(jobOrderInHtml(html, ['zeta/last', 'alpha/first', 'mid/middle'])).toEqual([
      'alpha/first',
      'mid/middle',
      'zeta/last',
    ]);
  });
});

describe('GET /api/digest/:night (JSON)', () => {
  it('returns { night, rows, badLines } for 2026-10-28', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { night: string; rows: DigestRow[]; badLines: number };
    expect(body.night).toBe('2026-10-28');
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(REAL_JOBS);
  });

  it('returns rows shaped as DigestRow, with a null owner kept as null', async () => {
    const body = (await (await createApp(config).request('/api/digest/2026-10-28')).json()) as {
      rows: DigestRow[];
    };
    const render = body.rows.find((r) => r.job === 'digest/render');
    expect(render).toMatchObject({ owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null });
    const refresh = body.rows.find((r) => r.job === 'fixtures/refresh');
    expect(refresh).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503', owner: 'rook' });
  });

  it('returns 404 JSON for a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('returns 404 JSON for an invalid night', async () => {
    const res = await createApp(config).request('/api/digest/not-a-night');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('returns empty rows for an empty night', async () => {
    const runsDir = tempRuns({ '2026-02-02.jsonl': '' });
    const res = await createApp({ ...config, runsDir }).request('/api/digest/2026-02-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-02-02', rows: [], badLines: 0 });
  });

  it('counts a bad line and still returns the other rows', async () => {
    const runsDir = tempRuns({
      '2026-03-03.jsonl': [
        line('2026-03-03T01:00:00+01:00', 'lane/sync', 'ok'),
        'this is not json',
        line('2026-03-03T02:00:00+01:00', 'notes/backup', 'fail', null),
      ].join('\n'),
    });
    const res = await createApp({ ...config, runsDir }).request('/api/digest/2026-03-03');
    const body = (await res.json()) as { badLines: number; rows: DigestRow[] };
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['lane/sync', 'notes/backup']);
  });

  it('sorts rows by job, whatever the order in the file', async () => {
    const runsDir = tempRuns({
      '2026-05-05.jsonl': [
        line('2026-05-05T01:00:00+01:00', 'zeta/last', 'ok'),
        line('2026-05-05T02:00:00+01:00', 'alpha/first', 'ok'),
        line('2026-05-05T03:00:00+01:00', 'mid/middle', 'retry'),
      ].join('\n'),
    });
    const body = (await (await createApp({ ...config, runsDir }).request('/api/digest/2026-05-05')).json()) as {
      rows: DigestRow[];
    };
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/first', 'mid/middle', 'zeta/last']);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order for 2026-10-28', async () => {
    const app = createApp(config);
    const html = await (await app.request('/digest/2026-10-28')).text();
    const body = (await (await app.request('/api/digest/2026-10-28')).json()) as { rows: DigestRow[] };
    const jsonJobs = body.rows.map((r) => r.job);
    expect(jobOrderInHtml(html, jsonJobs)).toEqual(jsonJobs);
  });
});
