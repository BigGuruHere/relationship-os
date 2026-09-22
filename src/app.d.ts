// src/app.d.ts
declare global {
	namespace App {
	  interface Locals {
		env: import('$lib/env').RuntimeEnv;
		appOrigin: string;
		sessionCookie: import('$lib/cookies').CookieConfig;
		user?: { id: string; email?: string; role?: 'owner' | 'guest' };
		contextSpaceId?: string; // Stage 8.6 active custody context
		contextDomainKey: string; // Stage 8.9 route-owned application domain
		sessionId?: string; // used by logout
	  }
	}
  }
  export {};
  
