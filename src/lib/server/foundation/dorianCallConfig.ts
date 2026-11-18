import { resolveOrigin } from '$lib/env';

export const dorianConsentVersion = 1;

export function foundationDorianAgent() {
	return process.env.RELISH_FOUNDATION_DORIAN === 'YES' && process.env.RELISH_FOUNDATION_DORIAN_TOOL_SECRET?.trim()
		? process.env.RELISH_FOUNDATION_DORIAN_AGENT_ID?.trim() || null
		: null;
}

export function foundationDorianAvailable(locals: App.Locals, url: URL) {
	return Boolean(locals.env === 'dev' && locals.user && locals.sessionId &&
		url.origin === resolveOrigin('dev') && foundationDorianAgent());
}
