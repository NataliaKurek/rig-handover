export type Status = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log. Times keep the offset from the log.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: Status;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Night = {
  rows: DigestRow[]; // sorted by job
  badLines: number;
};

// null when runs/<night>.jsonl does not exist; an empty file gives { rows: [], badLines: 0 }.
export type ReadNight = (runsDir: string, night: string) => Night | null;
