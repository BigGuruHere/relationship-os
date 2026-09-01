// src/app.d.ts
declare global {
	namespace App {
	  interface Locals {
		env: import('$lib/env').RuntimeEnv;
		appOrigin: string;
		sessionCookie: import('$lib/cookies').CookieConfig;
		user?: { id: string; email?: string; role?: 'owner' | 'guest' };
		contextSpaceId?: string; // Stage 8.6 active custody context
		sessionId?: string; // used by logout
	  }
	}
  }
  export {};
  