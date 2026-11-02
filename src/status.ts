import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { countStatuses } from './digest/counts.js';
import { lastBeat, type Beat } from './heartbeat.js';

// One line per night on disk. Counts are null when the night's file cannot be read.
export type NightLine = {
  night: string;
  ok: number | null;
  retry: number | null;
  fail: number | null;
};

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightLine[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

function nightLine(runsDir: string, night: string): NightLine {
  const counts = countStatuses(runsDir, night);
  return { night, ok: counts?.ok ?? null, retry: counts?.retry ?? null, fail: counts?.fail ?? null };
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => nightLine(config.runsDir, night)),
  };
}
