// PURPOSE: helpers to send and consume magic links for passwordless sign in.
// SECURITY: session cookie is httpOnly - we never expose secrets to the browser.
// All IT code is commented and uses hyphens only.

import { createMagicToken } from '$lib/server/tokens';
import { prisma } from '$lib/db';
import { redirect } from '@sveltejs/kit';

// IT: your existing session util - adjust import to match your project
import { createSessionCookie } from '$lib/server/session';

const APP_ORIGIN = process.env.APP_ORIGIN || 'https://yourapp.com';

// IT: compose and "send" a magic link - you wire the actual SMS or email here
export async function sendMagicLink(args: { userId: string; to: string }) {
  // 1. create a short lived token
  const { token, expiresAt } = await createMagicToken({ userId: args.userId, ttlMinutes: 30 });

  // 2. link the user will click
  const link = `${APP_ORIGIN}/auth/magic?token=${encodeURIComponent(token)}`;

  // 3. TODO: integrate your SMS or email provider here
  // For now, we store it in a debug table or log it
  await prisma.log.create({
    data: { level: 'info', message: `Magic link for ${args.to}: ${link} (expires ${expiresAt.toISOString()})` }
  });
}
