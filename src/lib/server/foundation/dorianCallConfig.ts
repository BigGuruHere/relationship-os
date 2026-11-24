import { resolveOrigin, type RuntimeEnv } from '$lib/env';

export const dorianConsentVersion = 1;

export function foundationDorianAgent() {
	return process.env.RELISH_FOUNDATION_DORIAN === 'YES' && process.env.RELISH_FOUNDATION_DORIAN_TOOL_SECRET?.trim()
		? process.env.RELISH_FOUNDATION_DORIAN_AGENT_ID?.trim() || null
		: null;
}

// Browser and provider requests must both target the canonical deployment origin.
export function foundationDorianOriginAllowed(env: RuntimeEnv, url: URL) {
	return (env === 'dev' || env === 'prod') && url.origin === resolveOrigin(env);
}

export function foundationDorianAvailable(locals: App.Locals, url: URL) {
	return Boolean(locals.user && locals.sessionId &&
		foundationDorianOriginAllowed(locals.env, url) && foundationDorianAgent());
}

// Opt in on the shared inbound Dorian agent. Its ID must differ from the browser agent.
export function foundationDorianPhoneAgent() {
	const browserAgent = foundationDorianAgent();
	const phoneAgent = process.env.RELISH_FOUNDATION_DORIAN_PHONE_AGENT_ID?.trim();
	return browserAgent && phoneAgent && phoneAgent !== browserAgent ? phoneAgent : null;
}

export const dorianProcessingMessage = 'I’m still processing our last conversation. Please try again shortly.';
export const dorianProviderWindowMs = 2 * 60 * 60_000;
