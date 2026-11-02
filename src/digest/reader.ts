import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, Status } from './types.js';

type Entry = { at: string; job: string; status: Status; owner: string | null; error: string | null };

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

// Parse at the edge: a line that is not a valid entry is counted, never thrown.
function parseLine(line: string): Entry | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.at !== 'string' || Number.isNaN(Date.parse(o.at))) return null;
  if (typeof o.job !== 'string' || o.job === '') return null;
  if (typeof o.status !== 'string' || !STATUSES.includes(o.status)) return null;
  return {
    at: o.at,
    job: o.job,
    status: o.status as Status,
    owner: typeof o.owner === 'string' ? o.owner : null,
    error: typeof o.error === 'string' ? o.error : null,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  const byJob = new Map<string, Entry[]>();
  let badLines = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const entry = parseLine(line);
    if (!entry) {
      badLines++;
      continue;
    }
    byJob.set(entry.job, [...(byJob.get(entry.job) ?? []), entry]);
  }

  const rows: DigestRow[] = [...byJob.entries()].map(([job, all]) => {
    const entries = [...all].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const last = entries[entries.length - 1];
    const lastWithError = [...entries].reverse().find((e) => e.error !== null);
    return {
      job,
      owner: last.owner,
      runs: entries.length,
      retries: entries.filter((e) => e.status === 'retry').length,
      lastStatus: last.status,
      lastError: lastWithError?.error ?? null,
      firstAt: entries[0].at,
      lastAt: last.at,
    };
  });
  rows.sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows, badLines } satisfies Night;
};
