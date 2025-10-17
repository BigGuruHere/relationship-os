// src/lib/env.ts
// PURPOSE:
// - Map incoming hostnames to a runtime env
// - Resolve the correct absolute origin for that env
// - Provide a simple entry point to get an origin from a Host header
//
// Envs:
// - local: localhost and anything that is not your known hosts
// - dev:    dev.relish.live
// - prod:   app.relish.live
//
// Notes:
// - You can override defaults with APP_ORIGIN_LOCAL, APP_ORIGIN_DEV, APP_ORIGIN_PROD
// - Keep this file server only if you add secrets later

export type RuntimeEnv = 'local' | 'dev' | 'prod';

// Canonical origins per env - adjust if your dev port differs
const DEFAULT_ORIGINS: Record<RuntimeEnv, string> = {
  local: 'http://localhost:5173',
  dev: 'https://dev.relish.live',
  prod: 'https://app.relish.live'
};

// Decide env from a hostname string
export function inferEnvFromHost(hostname: string): RuntimeEnv {
  const host = (hostname || '').toLowerCase();
  if (host === 'app.relish.live') return 'prod';
  if (host === 'dev.relish.live') return 'dev';
  // Treat anything else as local
  return 'local';
}

// Resolve the absolute origin for a given env with validation
export function resolveOrigin(env: RuntimeEnv): string {
  const fromEnv =
    env === 'prod'
      ? process.env.APP_ORIGIN_PROD
      : env === 'dev'
      ? process.env.APP_ORIGIN_DEV
      : process.env.APP_ORIGIN_LOCAL;

  const raw = (fromEnv ?? DEFAULT_ORIGINS[env]).trim();

  try {
    const u = new URL(raw);
    // Strip trailing slash for consistent joins
    return u.toString().replace(/\/$/, '');
  } catch {
    // Fail safe - return the default for that env
    return DEFAULT_ORIGINS[env];
  }
}

// Convenience - get origin directly from an HTTP Host header value
export function getOriginFromHostHeader(hostHeader: string | null): string {
  const env = inferEnvFromHost(hostHeader ?? '');
  return resolveOrigin(env);
}
