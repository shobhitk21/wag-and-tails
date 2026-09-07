/* Frees the API port when a previous instance is still holding it.

   `npm run kill-port -w backend`  (or with an explicit port: `... -- 4001`)

   Written in Node rather than as a shell one-liner because the incantation is
   different on every platform — netstat/taskkill on Windows, lsof/kill
   elsewhere — and the one command anyone here already has is node. */
import { execSync } from 'node:child_process';

const port = Number(process.argv[2] || process.env.PORT || 4000);

function pidsOnPort() {
  if (process.platform === 'win32') {
    /* netstat lists every socket on the port; only LISTENING is the server —
       the rest are its connections and killing their owners would take out
       whatever happens to be talking to it. */
    const out = execSync(`netstat -ano -p TCP | findstr ":${port} "`, { encoding: 'utf8' })
      .split('\n')
      .filter((line) => /LISTENING/i.test(line));
    return [...new Set(out.map((line) => line.trim().split(/\s+/).pop()).filter(Boolean))];
  }
  const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' });
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

let pids = [];
try {
  pids = pidsOnPort();
} catch {
  /* Both netstat|findstr and lsof exit non-zero when nothing matches. */
}

if (!pids.length) {
  console.log(`[kill-port] Nothing is listening on ${port}.`);
  process.exit(0);
}

for (const pid of pids) {
  try {
    if (process.platform === 'win32') execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    else process.kill(Number(pid), 'SIGKILL');
    console.log(`[kill-port] Stopped process ${pid} on port ${port}.`);
  } catch (err) {
    console.error(`[kill-port] Could not stop ${pid}: ${err.message}`);
  }
}
