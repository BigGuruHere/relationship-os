// src/lib/server/agents/sensitiveAudit.ts
// PURPOSE: Keep unredacted transcripts and sensitive observations out of ordinary agent JSON audit columns.
// SECURITY: Sensitive audit values retain only structural metadata. Encrypted source or artifact fields hold the real content.

export type AgentAuditDataClass = 'standard' | 'sensitive';

export function normalizeAgentAuditDataClass(value: unknown): AgentAuditDataClass {
	return String(value ?? '')
		.trim()
		.toLowerCase() === 'sensitive'
		? 'sensitive'
		: 'standard';
}

function valueShape(value: unknown): Record<string, unknown> {
	if (value === null || value === undefined) return { type: 'null' };
	if (typeof value === 'string') return { type: 'string', chars: value.length };
	if (typeof value === 'number') return { type: 'number' };
	if (typeof value === 'boolean') return { type: 'boolean' };
	if (Array.isArray(value)) return { type: 'array', items: value.length };
	if (typeof value === 'object')
		return { type: 'object', fields: Object.keys(value as Record<string, unknown>).length };
	return { type: typeof value };
}

export function auditJson(value: unknown, dataClass: AgentAuditDataClass) {
	if (dataClass === 'standard') return value ?? {};
	return {
		redacted: true,
		dataClass: 'sensitive',
		shape: valueShape(value)
	};
}

export function safeAgentAuditError(error: unknown, dataClass: AgentAuditDataClass) {
	if (dataClass === 'sensitive')
		return 'Sensitive agent operation failed. See protected source evidence and server diagnostics.';
	return error instanceof Error ? error.message : String(error);
}
