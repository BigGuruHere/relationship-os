// src/lib/cookies.ts
// PURPOSE: Central cookie naming and flags per environment
// COMMENT: Align names with working agreement - rsid_dev in dev - rsid_prod in prod

import type { RuntimeEnv } from '$lib/env';

export type CookieConfig = {
  name: string;
  options: {
    httpOnly: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    secure: boolean;
    path: string;
    maxAge?: number;
    domain?: string; // host only when undefined
  };
};

// IT: build cookie config using env and default lifetime in days
export function sessionCookieConfig(env: RuntimeEnv, days = 30): CookieConfig {
  // IT: use explicit names per working agreement
  const name = env === 'prod' ? 'rsid_prod' : 'rsid_dev';

  return {
    name,
    options: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env === 'prod' || env === 'dev',
      path: '/',
      maxAge: days * 24 * 60 * 60
    }
  };
}
