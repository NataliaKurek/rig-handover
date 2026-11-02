import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './reader.js';
import type { Status } from './types.js';

export type StatusCounts = Record<Status, number>;

// Lines per status in runs/<night>.jsonl, parsed exactly as readNight does: bad lines are
// skipped, never thrown. null when the night's file cannot be read.
export function countStatuses(runsDir: string, night: string): StatusCounts | null {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const entry = parseLine(line);
    if (entry) counts[entry.status]++;
  }
  return counts;
}
