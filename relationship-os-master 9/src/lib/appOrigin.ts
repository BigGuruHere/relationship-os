// src/lib/appOrigin.ts
// PURPOSE: Simple origin accessor for code paths where locals are not available
// COMMENT: Server should prefer locals.appOrigin - this is a safe fallback only

import { dev } from '$app/environment';

export function getAppOriginLoose(): string {
  // IT: allow a single APP_ORIGIN to override for workers or scripts
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN;
  if (dev) return 'http://localhost:5173';
  return 'https://app.relish.live';
}
