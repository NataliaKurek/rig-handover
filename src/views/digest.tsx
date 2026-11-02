import type { DigestRow, Night } from '../digest/types.js';

const dash = (v: string | null) => v ?? '—';

// A row is marked when it has retried three times or more, or when its last run failed.
const isMarked = (row: DigestRow) => row.retries >= 3 || row.lastStatus === 'fail';

export function DigestPage({ night, digest }: { night: string; digest: Night }) {
  return (
    <>
      <h1>digest · {night}</h1>
      {digest.badLines > 0 ? (
        <p class="warn">
          {digest.badLines} bad {digest.badLines === 1 ? 'line' : 'lines'} not counted
        </p>
      ) : null}
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => (
              <tr class={isMarked(row) ? 'warn' : undefined}>
                <td>{row.job}</td>
                <td>{dash(row.owner)}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>{row.lastStatus}</td>
                <td>{dash(row.lastError)}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
