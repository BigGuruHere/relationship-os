// Stage 8.15.4.7g.1: supervise the web application and its opt-in LU worker.
// Both children inherit exactly this application's environment and DATABASE_URL.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const dev = process.argv.includes('--dev');
const isWorkerEnabled = process.env.RELISH_PHONE_AUTO_LU === 'YES';
const webArgs = dev
  ? [resolve('node_modules/vite/bin/vite.js'), 'dev', ...process.argv.slice(process.argv.indexOf('--dev') + 1).filter(a => a !== '--')]
  : [resolve('build/index.js')];
let stopping = false;
let worker = null;
let restartTimer = null;

// Keep the web service in its original process mode; it has priority on shutdown.
const web = spawn(process.execPath, webArgs, { stdio: 'inherit', env: process.env });

function launchWorker() {
  if (stopping || !isWorkerEnabled) return;
  // The same worker script is used locally and in Railway. No hardcoded DB URLs.
  worker = spawn(process.execPath, [
    '--import', 'tsx', resolve('scripts/process-stage8-15-4-7f-2-phone-queue.ts'), '--watch'
  ], { stdio: 'inherit', env: process.env });
  worker.on('error', err => {
    console.error('[Phone LU Supervisor] Worker start failed', err.code || err.name);
  });
  worker.on('exit', (code, signal) => {
    worker = null;
    if (!stopping) {
      console.error('[Phone LU Supervisor] Worker exited; retrying startup', { code, signal });
      restartTimer = setTimeout(launchWorker, 10000);
    }
  });
}

function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  if (restartTimer) clearTimeout(restartTimer);
  if (worker && !worker.killed) worker.kill(signal);
  if (!web.killed) web.kill(signal);
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
web.on('error', err => {
  console.error('[Relish Supervisor] Web start failed', err.code || err.name);
  stop();
  process.exitCode = 1;
});
web.on('exit', (code, signal) => {
  stop();
  process.exitCode = code ?? (signal ? 1 : 0);
});

if (isWorkerEnabled) {
  console.log('[Phone LU Supervisor] Auto worker enabled for this application environment');
  launchWorker();
} else {
  console.log('[Phone LU Supervisor] Auto worker disabled (RELISH_PHONE_AUTO_LU is not YES)');
}
