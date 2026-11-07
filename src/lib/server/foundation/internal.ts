// Internal transaction capability. Only policy.ts and provisioning.ts may establish scope.
// This is an application-code boundary, not protection from a compromised DB credential.
import { AsyncLocalStorage } from 'node:async_hooks';
import type { FoundationOperation } from './policy';
import { Prisma } from '@prisma/client';

type Boundary = {
	ownerUserId: string;
	vaultId?: string;
	mode:
		| 'EXCHANGE'
		| 'EXCHANGE_LOOKUP'
		| 'EXCHANGE_BUDGET'
		| 'RESOLVE'
		| 'PROVISION'
		| 'PUBLIC_CAPTURE'
		| 'PRIVACY_CONTROL'
		| 'PRIVACY_REVIEW'
		| 'PRIVACY_ERASE'
		| FoundationOperation;
	capturePrefix?: string;
};
const boundary = new AsyncLocalStorage<{ scope: Boundary; active: boolean }>();
export function runFoundationBoundary<T>(scope: Boundary, fn: () => Promise<T>): Promise<T> {
	// Await inside the scope: Prisma queries are lazy thenables.
	const entry = { scope: Object.freeze({ ...scope }), active: true };
	return boundary.run(entry, async () => {
		try {
			return await fn();
		} finally {
			entry.active = false;
		}
	});
}
export class FoundationDenied extends Error {
	constructor() {
		super('Foundation resource unavailable.');
		this.name = 'FoundationDenied';
	}
}
const models = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));
const reads = new Set(['findUnique', 'findFirst', 'findMany', 'count']);
const domainModels = new Set([
	'FoundationSubject',
	'FoundationMembership',
	'FoundationPerspective'
]);

// Public intake has no private subject reader, updates, statements or analysis capability.
function captureOperationAllowed(model: string, op: string, args: any, prefix?: string) {
	if (!prefix) return false;
	if (op === 'create') {
		if (model === 'FoundationSubject') return args.data.kind === 'PERSON' && !args.data.selfUserId;
		if (model === 'FoundationSource')
			return (
				args.data.kind === 'CONTACT_EXCHANGE' &&
				typeof args.data.ingestKey === 'string' &&
				args.data.ingestKey.startsWith(prefix)
			);
		if (model === 'FoundationSourceVersion')
			return (
				args.data.version === 1 &&
				args.data.recordedByKind === 'VISITOR' &&
				args.data.processingAdmission === 'STORED_ONLY'
			);
		return ['FoundationEvidenceSegment', 'FoundationEvidenceSubject'].includes(model);
	}
	if (model === 'FoundationSource' && ['findFirst', 'count'].includes(op)) {
		const key = args.where?.ingestKey;
		const scoped = typeof key === 'string' ? key.startsWith(prefix) : key?.startsWith === prefix;
		return (
			scoped &&
			args.where?.kind === 'CONTACT_EXCHANGE' &&
			(op === 'count' || (args.select && Object.keys(args.select).every((k) => k === 'id')))
		);
	}
	// Retry comparison can read only the MAC of the exact receipt, never any source payload.
	return (
		model === 'FoundationSourceVersion' &&
		op === 'findFirst' &&
		typeof args.where?.sourceId === 'string' &&
		args.where.version === 1 &&
		args.select &&
		Object.keys(args.select).every((k) => k === 'contentMac')
	);
}

// Each evidence operation has a fixed set of delegates and append-only writes.
const sourceModels = [
	'FoundationSource',
	'FoundationSourceVersion',
	'FoundationEvidenceSegment',
	'FoundationEvidenceSubject'
];
const statementModels = [
	'FoundationStatement',
	'FoundationStatementVersion',
	'FoundationStatementSubject',
	'FoundationSupport'
];
function evidenceOperationAllowed(mode: Boundary['mode'], model: string, op: string) {
	if (mode === 'READ_NOTES')
		return reads.has(op) && [...sourceModels, 'FoundationSubject'].includes(model);
	if (mode === 'READ_SEGMENT')
		return reads.has(op) && [...sourceModels, 'FoundationSubject'].includes(model);
	if (mode === 'RECORD_EVIDENCE')
		return (
			(reads.has(op) && ['FoundationSubject', ...sourceModels].includes(model)) ||
			(op === 'create' && sourceModels.includes(model))
		);
	const canInspect =
		reads.has(op) &&
		[...sourceModels, ...statementModels, 'FoundationSubject', 'FoundationPerspective'].includes(
			model
		);
	if (mode === 'READ_STATEMENT') return canInspect;
	return (
		mode === 'RECORD_STATEMENT' &&
		(canInspect || (op === 'create' && statementModels.includes(model)))
	);
}
// Privacy scopes are issued only by the offline operator service. Keep writes exact and
// separate from the request-facing owner and visitor capabilities.
function privacyOperationAllowed(mode: Boundary['mode'], model: string, op: string, args: any) {
	if (mode === 'PRIVACY_CONTROL') {
		if (model !== 'FoundationEnrollment' && model !== 'FoundationVault') return false;
		if (op === 'findFirst') return true;
		if (op !== 'updateMany') return false;
		const data = args.data;
		if (model === 'FoundationVault')
			return Object.keys(data).length === 1 && data.state === 'LOCKED';
		return (
			Object.keys(data).length === 2 &&
			data.state === 'SUSPENDED' &&
			data.epoch?.increment === 1 &&
			Object.keys(data.epoch).length === 1
		);
	}
	const contentModels = [
		'FoundationExchange',
		'FoundationExchangeChallenge',
		'FoundationExchangeDispatch',
		'FoundationAccountAssociation',
		...sourceModels,
		...statementModels,
		...domainModels,
		'FoundationContext',
		'FoundationContextAssociation'
	];
	if (!contentModels.includes(model)) return false;
	if (mode === 'PRIVACY_REVIEW') return op === 'findMany' || op === 'count';
	if (mode !== 'PRIVACY_ERASE') return false;
	return (
		op === 'deleteMany' ||
		(model === 'FoundationStatement' &&
			op === 'updateMany' &&
			Object.keys(args.data).length === 1 &&
			args.data.state === 'DELETING')
	);
}

// Reject relational traversal anywhere in a legacy query, including _count and nested filters/writes.
// Foundation relations currently exist only on User; derive names from schema to cover additions.
const entryRelations = new Set(
	Prisma.dmmf.datamodel.models
		.filter((m) => !m.name.startsWith('Foundation'))
		.flatMap((m) =>
			m.fields
				.filter((f) => f.kind === 'object' && f.type.startsWith('Foundation'))
				.map((f) => f.name)
		)
);
function forbidKeys(value: unknown, keys: Set<string>) {
	if (!value || typeof value !== 'object') return;
	for (const [key, child] of Object.entries(value)) {
		if (keys.has(key)) throw new FoundationDenied();
		forbidKeys(child, keys);
	}
}

// Used by the one shared client. No context cookie, submitted owner or Prisma include grants access.
export function guardFoundationQuery(model: string | undefined, operation: string, args: any): any {
	const entry = boundary.getStore();
	const scope = entry?.active ? entry.scope : undefined;
	if (!model) {
		// Raw SQL remains a reviewed legacy facility. Foundation SQL is confined to fixed lock statements.
		// Reject foundation references in tagged/unsafe SQL, including PostgreSQL Unicode identifiers.
		const sql =
			args?.sql ??
			(typeof args?.[0] === 'string' ? args[0] : (args?.[0]?.sql ?? args?.[0]?.join?.('?') ?? ''));
		if (/foundation|f202_|U&["']/i.test(sql)) {
			const accountLock = /^SELECT pg_advisory_xact_lock\(hashtextextended\(\?, 0\)\)$/i.test(
				sql.trim()
			);
			const vaultLock =
				/^SELECT "id" FROM "FoundationVault" WHERE "id" = \? AND "ownerUserId" = \? FOR UPDATE$/i.test(
					sql.trim()
				);
			const values = args?.values ?? args?.[0]?.values ?? [];
			if (
				!scope ||
				!(
					accountLock ||
					(vaultLock &&
						['RESOLVE', 'PRIVACY_CONTROL'].includes(scope.mode) &&
						values[1] === scope.ownerUserId)
				)
			)
				throw new FoundationDenied();
		}
		return args;
	}
	if (!model.startsWith('Foundation')) {
		forbidKeys(args, entryRelations);
		return args;
	}
	if (!scope?.ownerUserId) throw new FoundationDenied();
	// Global metadata lookup is confined to exact claim capabilities or privacy dependency IDs.
	if (scope.mode === 'EXCHANGE_LOOKUP') {
		const where = args?.where ?? {};
		const keys = Object.keys(where);
		const selected = args?.select && Object.keys(args.select);
		const fields = ['id', 'ownerUserId', 'vaultId', 'accountId', 'beneficiaryUserId'];
		if (
			operation !== 'findMany' ||
			!selected ||
			!selected.every((k: string) => fields.includes(k)) ||
			keys.length !== 1 ||
			!['continuationHash', 'beneficiaryUserId', 'channelHash', 'accountId'].includes(keys[0]) ||
			typeof where[keys[0]] !== 'string' ||
			!['FoundationExchange', 'FoundationAccountAssociation'].includes(model)
		)
			throw new FoundationDenied();
		return args;
	}
	if (scope.mode === 'EXCHANGE_BUDGET') {
		if (
			model !== 'FoundationClaimBudget' ||
			!['findUnique', 'create', 'updateMany', 'deleteMany'].includes(operation)
		)
			throw new FoundationDenied();
		return args;
	}

	const control =
		scope.mode === 'PROVISION' || scope.mode === 'RESOLVE' || scope.mode === 'PRIVACY_CONTROL';
	// Segment and understanding reads may inspect source eligibility, never a parent payload.
	if (
		model === 'FoundationSourceVersion' &&
		['READ_SEGMENT', 'RECORD_STATEMENT', 'READ_STATEMENT'].includes(scope.mode)
	) {
		const allowed = ['sourceId', 'version', 'processingAdmission'];
		if (!args?.select || Object.keys(args.select).some((k) => !allowed.includes(k)))
			throw new FoundationDenied();
	}
	const exchangeModels = [
		'FoundationExchange',
		'FoundationExchangeChallenge',
		'FoundationExchangeDispatch',
		'FoundationAccountAssociation'
	];
	const evidenceAllowed =
		scope.mode === 'EXCHANGE'
			? (exchangeModels.includes(model) &&
					['findFirst', 'findMany', 'count', 'create', 'updateMany', 'deleteMany'].includes(
						operation
					)) ||
				([
					'FoundationSubject',
					'FoundationSource',
					'FoundationSourceVersion',
					'FoundationEvidenceSegment',
					'FoundationEvidenceSubject'
				].includes(model) &&
					['findFirst', 'findMany', 'create'].includes(operation))
			: scope.mode === 'PUBLIC_CAPTURE'
				? captureOperationAllowed(model, operation, args, scope.capturePrefix)
				: evidenceOperationAllowed(scope.mode, model, operation) ||
					privacyOperationAllowed(scope.mode, model, operation, args);
	if (scope.mode === 'PRIVACY_CONTROL' && !evidenceAllowed) throw new FoundationDenied();
	if (
		!evidenceAllowed &&
		(control
			? !['FoundationEnrollment', 'FoundationVault', 'FoundationSubject'].includes(model)
			: !['READ', 'WRITE'].includes(scope.mode) || !domainModels.has(model))
	)
		throw new FoundationDenied();
	if (
		!evidenceAllowed &&
		!reads.has(operation) &&
		!(scope.mode === 'PROVISION' && operation === 'create') &&
		!(scope.mode === 'WRITE' && ['create', 'update'].includes(operation))
	)
		throw new FoundationDenied();
	// Flat, allowlisted scalar projections only. No nested connect/create/include/relation filters.
	const relations = new Set(
		models
			.get(model)!
			.fields.filter((f) => f.kind === 'object')
			.map((f) => f.name)
	);
	forbidKeys(args, relations);
	if (args?.include) throw new FoundationDenied();
	const custody: Record<string, string> =
		model === 'FoundationEnrollment'
			? { userId: scope.ownerUserId }
			: { ownerUserId: scope.ownerUserId };
	if (!control) {
		if (!scope.vaultId) throw new FoundationDenied();
		custody.vaultId = scope.vaultId;
	}
	if (operation === 'create') {
		for (const [k, v] of Object.entries(custody))
			if (args.data[k] !== undefined && args.data[k] !== v) throw new FoundationDenied();
		return { ...args, data: { ...args.data, ...custody } };
	}
	if (operation === 'update') {
		// F-204 exposes archive only. Later writers must extend this contract with their own tests.
		if (
			model !== 'FoundationSubject' ||
			Object.keys(args.data).some((k) => k !== 'state') ||
			args.data.state !== 'ARCHIVED'
		)
			throw new FoundationDenied();
	}
	const previousAnd = args?.where?.AND;
	return {
		...args,
		where: {
			...args?.where,
			AND: [
				...(Array.isArray(previousAnd) ? previousAnd : previousAnd ? [previousAnd] : []),
				custody
			]
		}
	};
}
