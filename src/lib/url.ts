// src/lib/url.ts
// PURPOSE:
// - Build absolute URLs using a provided origin
// - Avoid manual string concat bugs
//
// Usage example on server:
//   const origin = event.locals.appOrigin; // set in hooks
//   const link = absoluteUrlFromOrigin(origin, '/api/auth/magic-link', { token });

export function absoluteUrlFromOrigin(
    origin: string,
    pathname: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    const url = new URL(pathname, origin);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined) continue;
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }
  