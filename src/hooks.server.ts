// src/hooks.server.ts
// PURPOSE:
// - Infer runtime env from Host header and expose on locals
// - Provide env-aware appOrigin and sessionCookie config on locals
// - Parse session cookie using env-aware name and attach user id to locals
// SECURITY:
// - Do not expose email on locals - encrypted email must only be decrypted on
//   specific server routes that need it, and then passed as a redacted string.
// NOTES:
// - Keep tenant scoping rules elsewhere - this only prepares locals
// - All IT code is commented and uses normal hyphens

import type { Handle } from '@sveltejs/kit';
import { inferEnvFromHost, resolveOrigin } from '$lib/env';
import { sessionCookieConfig } from '$lib/cookies';
import { readSessionToken, getSessionFromCookie } from '$lib/auth';
import { runWithWorkspaceCustody } from '$lib/server/core/contextSpace';
import { prisma } from '$lib/db';
import {
  contextDomainForPathname,
  contextSelectionCookieName,
  resolveContextSpaceForDomain
} from '$lib/server/core/contextDomain';

export const handle: Handle = async ({ event, resolve }) => {
  // 1 - infer environment from Host header
  const hostHeader = event.request.headers.get('host') ?? '';
  const runtimeEnv = inferEnvFromHost(hostHeader);

  // 2 - compute absolute origin and cookie config for this env
  const appOrigin = resolveOrigin(runtimeEnv);
  const cookieCfg = sessionCookieConfig(runtimeEnv);

  // 3 - expose on locals for downstream server routes and loads
  event.locals.env = runtimeEnv;
  event.locals.appOrigin = appOrigin;
  event.locals.sessionCookie = cookieCfg;

  // 4 - parse session using env-aware cookie name from locals
  // - readSessionToken uses locals.sessionCookie.name
  const signedCookie = readSessionToken(event.cookies, event.locals);

  // IT - initialize locals.user to undefined and only attach id on success
  event.locals.user = undefined;
  event.locals.contextSpaceId = undefined;
  event.locals.contextDomainKey = contextDomainForPathname(event.url.pathname);

  // optional: keep a session id for logout - set after DB lookup in getSessionFromCookie
  let sessionId: string | undefined;

  if (signedCookie) {
    const result = await getSessionFromCookie(signedCookie);
    if (result) {
      // IT - attach only the user id - do not attach email here
      event.locals.user = { id: result.user.id };
      // SECURITY: The cookie is only a preference. The resolver rechecks owner and route domain.
      const preferredContextSpaceId = event.cookies.get(contextSelectionCookieName(event.locals.contextDomainKey));
      const resolvedContext = await resolveContextSpaceForDomain(prisma, {
        ownerUserId: result.user.id,
        domainKey: event.locals.contextDomainKey,
        preferredContextSpaceId
      });
      event.locals.contextSpaceId = resolvedContext?.id;
      sessionId = result.session.id;
    }
  }

  // 5 - store sessionId if available so logout can destroy it
  // - type is optional on Locals, so this is safe to set when present
  // - App.Locals declares this optional session id.
  event.locals.sessionId = sessionId;

  // 6 - continue to route handling inside the resolved owner + application-domain custody context.
  if (event.locals.user?.id && event.locals.contextSpaceId) {
    return runWithWorkspaceCustody({ userId: event.locals.user.id, contextSpaceId: event.locals.contextSpaceId }, () => resolve(event));
  }
  return resolve(event);
};
